import { createClient } from '@supabase/supabase-js';

// Supabase project connection. The publishable (anon) key is safe to ship in
// client code — all data access is enforced by Row Level Security.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://ohytlrgfpcpvnqgdpqap.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oeXRscmdmcGNwdm5xZ2RwcWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5OTY0MDEsImV4cCI6MjA5ODU3MjQwMX0.Wp7FG7xZNYRu8LOUnl4-e0olnELKAtZ_nB4t4MJMWUI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
