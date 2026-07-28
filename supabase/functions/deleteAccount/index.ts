// Authenticated self-service account deletion for Google Play compliance.
import { json, preflight, serviceClient } from './shared.ts';

const storagePathFromPublicUrl = (raw: unknown) => {
  try {
    const url = new URL(String(raw || ''));
    const marker = '/storage/v1/object/public/media/';
    const index = url.pathname.indexOf(marker);
    if (index < 0) return '';
    return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    return '';
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

    const { data: rows, error: cleanupError } = await svc.rpc('delete_account_data', {
      p_auth_user_id: authData.user.id,
    });
    if (cleanupError) {
      const message = cleanupError.message?.includes('Administrator accounts')
        ? 'Administrator accounts cannot be self-deleted. Transfer or remove the administrator role first.'
        : cleanupError.message || 'Account cleanup failed';
      return json({ error: message }, cleanupError.message?.includes('Administrator accounts') ? 403 : 500);
    }

    const result = Array.isArray(rows) ? rows[0] : rows;
    const mediaPaths = [...new Set((result?.media_urls || []).map(storagePathFromPublicUrl).filter(Boolean))];
    if (mediaPaths.length) {
      const { error: storageError } = await svc.storage.from('media').remove(mediaPaths);
      if (storageError) console.error('deleteAccount storage cleanup error:', storageError);
    }

    const { error: deleteAuthError } = await svc.auth.admin.deleteUser(authData.user.id);
    if (deleteAuthError) throw deleteAuthError;

    if (result?.profile_id) {
      const { error: profileError } = await svc.from('profiles').delete().eq('id', result.profile_id);
      if (profileError) console.error('deleteAccount profile tombstone cleanup error:', profileError);
    }

    return json({
      ok: true,
      retainedOrderCount: Number(result?.retained_order_count || 0),
    });
  } catch (error) {
    console.error('deleteAccount error:', error);
    return json({ error: (error as Error).message || 'Account deletion failed' }, 500);
  }
});
