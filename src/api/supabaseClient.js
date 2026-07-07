import { createClient } from '@supabase/supabase-js';

// Supabase project connection. The publishable (anon) key is safe to ship in
// client code — all data access is enforced by Row Level Security.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://ohytlrgfpcpvnqgdpqap.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oeXRscmdmcGNwdm5xZ2RwcWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5OTY0MDEsImV4cCI6MjA5ODU3MjQwMX0.Wp7FG7xZNYRu8LOUnl4-e0olnELKAtZ_nB4t4MJMWUI';

// supabase-js does not time out a hung socket, so a stalled request (mobile
// dead-zone, black-holed proxy) would otherwise leave queries loading forever.
// Apply a request timeout when the caller hasn't supplied its own signal.
// Guarded: AbortSignal.timeout is iOS 16+/modern-browser only; on older
// engines we fall back to plain fetch (no regression from today's behaviour).
const REQUEST_TIMEOUT_MS = 20000;
const canTimeout =
  typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function';

const timeoutFetch = (input, init = {}) => {
  if (init.signal || !canTimeout) return fetch(input, init);
  return fetch(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: { fetch: timeoutFetch },
});
