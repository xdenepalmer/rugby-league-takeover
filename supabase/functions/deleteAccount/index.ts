// Authenticated self-service account deletion for Google Play compliance.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { json, preflight, serviceClient } from './shared.ts';

// All app uploads use the flat `uploads/` prefix (base44Client.UploadFile).
// Listing runs with the caller's JWT and the owner-only storage policy, so it
// discovers every object that would otherwise prevent auth.users deletion
// without ever trusting a user-editable public URL from a profile or post.
const listOwnedMediaPaths = async (
  // deno-lint-ignore no-explicit-any
  client: any,
) => {
  const paths: string[] = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.storage.from('media').list('uploads', {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    const page = data || [];
    for (const object of page) {
      // Folder placeholders do not have an object id. Current app uploads are
      // flat, but ignoring them keeps this safe if a folder is introduced.
      if (object?.id && object?.name) paths.push(`uploads/${object.name}`);
    }
    if (page.length < pageSize) break;
  }
  return paths;
};

const removeOwnedMedia = async (
  // deno-lint-ignore no-explicit-any
  client: any,
) => {
  const mediaPaths = await listOwnedMediaPaths(client);
  for (let index = 0; index < mediaPaths.length; index += 100) {
    const { error } = await client.storage
      .from('media')
      .remove(mediaPaths.slice(index, index + 100));
    if (error) throw error;
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const svc = serviceClient();
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Login required' }, 401);

    const { data: authData, error: authError } = await svc.auth.getUser(token);
    if (authError || !authData?.user) return json({ error: 'Login required' }, 401);

    const { confirmation } = await req.json().catch(() => ({}));
    if (confirmation !== 'DELETE') {
      return json({ error: 'Type DELETE to confirm permanent account deletion' }, 400);
    }

    const { data: profile, error: profileLookupError } = await svc
      .from('profiles')
      .select('id, email, role, avatar_url')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();
    if (profileLookupError || !profile) return json({ error: 'Account profile not found' }, 404);
    if (profile.role === 'admin') {
      return json({ error: 'Administrator accounts cannot be self-deleted. Transfer or remove the administrator role first.' }, 403);
    }

    // Remove every object owned by this auth user before erasing database URLs
    // or auth.users. Supabase will refuse auth-user deletion while owned
    // Storage objects still exist.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      },
    );
    try {
      await removeOwnedMedia(userClient);
    } catch (storageError) {
      console.error('deleteAccount storage cleanup error:', storageError);
      return json({ error: 'Uploaded media could not be removed. Please try again.' }, 500);
    }

    const { data: rows, error: cleanupError } = await svc.rpc('delete_account_data', {
      p_auth_user_id: authData.user.id,
    });
    if (cleanupError) {
      const isAdminGuard = cleanupError.message?.includes('Administrator accounts');
      return json({
        error: isAdminGuard
          ? 'Administrator accounts cannot be self-deleted. Transfer or remove the administrator role first.'
          : cleanupError.message || 'Account cleanup failed',
      }, isAdminGuard ? 403 : 500);
    }

    const result = Array.isArray(rows) ? rows[0] : rows;

    // The RPC has now disabled the profile, so the tightened upload policy
    // blocks new objects. Clear anything created during the first cleanup
    // window before asking Auth to remove the object owner.
    try {
      await removeOwnedMedia(userClient);
    } catch (storageError) {
      console.error('deleteAccount final storage cleanup error:', storageError);
      return json({ error: 'Uploaded media could not be removed. Please try again.' }, 500);
    }

    const { error: deleteAuthError } = await svc.auth.admin.deleteUser(authData.user.id);
    if (deleteAuthError) throw deleteAuthError;

    if (result?.profile_id) {
      const { error: profileError } = await svc.from('profiles').delete().eq('id', result.profile_id);
      if (profileError) console.error('deleteAccount profile tombstone cleanup error:', profileError);
    }

    return json({ ok: true, retainedOrderCount: Number(result?.retained_order_count || 0) });
  } catch (error) {
    console.error('deleteAccount error:', error);
    return json({ error: (error as Error).message || 'Account deletion failed' }, 500);
  }
});
