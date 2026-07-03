// Supabase-backed data client.
//
// This module keeps the same `base44.*` surface the app was written against
// (entities CRUD, auth, functions.invoke, integrations.Core.UploadFile) but
// every call now hits Supabase: Postgres+RLS for entities, Supabase Auth for
// sessions, Edge Functions for backend actions, and Storage for uploads.
// Keeping the interface identical means the ~80 importing components did not
// need to change during the Base44 → Supabase migration.
import { supabase } from '@/api/supabaseClient';

// Entity name → table. Reads for tables with admin-only fields (ip addresses,
// linked emails) go through sanitising views that mask those columns for
// non-admins; writes go to the base table (admin RLS applies).
const WRITE_TABLES = {
  AchievementUnlock: 'achievement_unlocks',
  Ban: 'bans',
  EventContent: 'event_contents',
  Faq: 'faqs',
  ForumPost: 'forum_posts',
  ForumRewardEvent: 'forum_reward_events',
  GalleryItem: 'gallery_items',
  InterestRegistration: 'interest_registrations',
  Matchup: 'matchups',
  NewsArticle: 'news_articles',
  Notification: 'notifications',
  Partner: 'partners',
  Product: 'products',
  ProductReleaseSubscription: 'product_release_subscriptions',
  SiteAd: 'site_ads',
  SiteSettings: 'site_settings',
  StoreOrder: 'store_orders',
  Team: 'teams',
  Testimonial: 'testimonials',
  TippingEntry: 'tipping_entries',
  TravelPackage: 'travel_packages',
};

const READ_TABLES = {
  ...WRITE_TABLES,
  ForumPost: 'forum_posts_view',
  Testimonial: 'testimonials_view',
  TippingEntry: 'tipping_entries_view',
};

const DEFAULT_LIMIT = 500;

function orderFrom(sort) {
  const s = String(sort || '-created_date');
  return s.startsWith('-')
    ? { column: s.slice(1), ascending: false }
    : { column: s, ascending: true };
}

function throwIf(error) {
  if (error) {
    const err = new Error(error.message || 'Request failed');
    err.status = error.code;
    err.details = error;
    throw err;
  }
}

function makeEntity(name) {
  const readTable = READ_TABLES[name];
  const writeTable = WRITE_TABLES[name];
  return {
    async list(sort, limit) {
      const { column, ascending } = orderFrom(sort);
      const { data, error } = await supabase
        .from(readTable)
        .select('*')
        .order(column, { ascending, nullsFirst: false })
        .limit(limit || DEFAULT_LIMIT);
      throwIf(error);
      return data || [];
    },
    async filter(query, sort, limit) {
      const { column, ascending } = orderFrom(sort);
      const { data, error } = await supabase
        .from(readTable)
        .select('*')
        .match(query || {})
        .order(column, { ascending, nullsFirst: false })
        .limit(limit || DEFAULT_LIMIT);
      throwIf(error);
      return data || [];
    },
    async get(id) {
      const { data, error } = await supabase
        .from(readTable)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      throwIf(error);
      return data;
    },
    async create(payload) {
      const { data, error } = await supabase
        .from(writeTable)
        .insert(payload)
        .select()
        .single();
      throwIf(error);
      return data;
    },
    async update(id, payload) {
      const { error } = await supabase
        .from(writeTable)
        .update(payload)
        .eq('id', id);
      throwIf(error);
      return { id, ...payload };
    },
    async delete(id) {
      const { error } = await supabase.from(writeTable).delete().eq('id', id);
      throwIf(error);
      return { id };
    },
  };
}

const entities = Object.fromEntries(Object.keys(WRITE_TABLES).map((n) => [n, makeEntity(n)]));

// ---------------------------------------------------------------------------
// Auth — wraps Supabase Auth; me() merges the auth session with the app-level
// profile row (role, casino stats, preferences) so callers keep getting the
// flat user object the app expects.
// ---------------------------------------------------------------------------
async function fetchProfile(authUserId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  return data;
}

const auth = {
  async isAuthenticated() {
    const { data } = await supabase.auth.getSession();
    return !!data?.session;
  },

  async me() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      const err = new Error('Not authenticated');
      err.status = 401;
      throw err;
    }
    const profile = await fetchProfile(data.user.id);
    if (!profile) {
      // Profile row is created by a DB trigger; brief race after signup.
      return {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name || String(data.user.email || '').split('@')[0],
        role: 'user',
      };
    }
    if (profile.disabled) {
      await supabase.auth.signOut();
      const err = new Error('Account disabled');
      err.status = 403;
      throw err;
    }
    return { ...profile, auth_user_id: data.user.id };
  },

  async loginViaEmailPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message || 'Invalid email or password');
    return { access_token: data?.session?.access_token };
  },

  // Token persistence is handled by supabase-js itself.
  setToken() {},

  async register({ email, password }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/account` },
    });
    if (error) throw new Error(error.message || 'Registration failed');
    return data;
  },

  // Email-confirmation code entry. If sign-up already produced a live session
  // (confirmations disabled) any code succeeds immediately.
  async verifyOtp({ email, otpCode }) {
    const { data: sess } = await supabase.auth.getSession();
    if (sess?.session) return { access_token: sess.session.access_token };
    let result = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'signup' });
    if (result.error) {
      result = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'email' });
    }
    if (result.error) throw new Error(result.error.message || 'Invalid verification code');
    return { access_token: result.data?.session?.access_token };
  },

  async resendOtp(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw new Error(error.message || 'Failed to resend code');
    return { ok: true };
  },

  async resetPasswordRequest(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(error.message || 'Failed to send reset email');
    return { ok: true };
  },

  // The recovery link signs the user in via URL hash (handled by supabase-js);
  // by the time this runs we just set the new password on that session.
  async resetPassword({ newPassword }) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message || 'Failed to reset password');
    return { ok: true };
  },

  async changePassword({ currentPassword, newPassword }) {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email;
    if (!email) throw new Error('Not authenticated');
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (verifyError) throw new Error('Current password is incorrect');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message || 'Failed to change password');
    return { ok: true };
  },

  async updateMe(data) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('Not authenticated');
    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('auth_user_id', userData.user.id);
    throwIf(error);
    return { ok: true };
  },

  loginWithProvider(provider, nextUrl) {
    const next = typeof nextUrl === 'string' && nextUrl.startsWith('/') ? nextUrl : '/account';
    return supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${next}` },
    });
  },

  async logout(redirectUrl) {
    await supabase.auth.signOut();
    if (typeof redirectUrl === 'string' && redirectUrl) {
      window.location.assign(redirectUrl.startsWith('/') ? redirectUrl : '/');
    }
  },

  redirectToLogin(fromUrl) {
    let next = '/account';
    try {
      const url = new URL(fromUrl || window.location.href);
      next = `${url.pathname}${url.search}`;
    } catch {
      /* keep default */
    }
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  },
};

// ---------------------------------------------------------------------------
// Edge function invocation — returns an axios-like { data } envelope, matching
// what the Base44 SDK returned, so call sites keep reading response.data.
// ---------------------------------------------------------------------------
const functions = {
  async invoke(name, body) {
    const { data, error } = await supabase.functions.invoke(name, { body: body ?? {} });
    if (error) {
      let message = error.message || `${name} failed`;
      let payload = null;
      try {
        if (error.context && typeof error.context.json === 'function') {
          payload = await error.context.json();
          if (payload?.error) message = payload.error;
        }
      } catch {
        /* non-JSON error body */
      }
      const err = new Error(message);
      err.data = payload;
      err.status = error.context?.status;
      throw err;
    }
    return { data };
  },
};

// ---------------------------------------------------------------------------
// File uploads → Supabase Storage (public "media" bucket).
// ---------------------------------------------------------------------------
const integrations = {
  Core: {
    async UploadFile({ file }) {
      if (!file) throw new Error('No file provided');
      const safeName = String(file.name || 'upload')
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .slice(-80);
      const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      const { error } = await supabase.storage.from('media').upload(path, file, {
        cacheControl: '31536000',
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) throw new Error(error.message || 'Upload failed');
      const { data } = supabase.storage.from('media').getPublicUrl(path);
      return { file_url: data.publicUrl };
    },
  },
};

// ---------------------------------------------------------------------------
// User management helpers (admin panel).
// ---------------------------------------------------------------------------
const users = {
  async inviteUser(email, role = 'user') {
    const { data } = await functions.invoke('inviteUser', { email, role });
    return data;
  },
};

export const base44 = { entities, auth, functions, integrations, users };
