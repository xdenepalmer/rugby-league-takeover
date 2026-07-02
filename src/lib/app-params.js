// App configuration flags.
//
// Post-migration, the backend is Supabase. `hasBase44Config` keeps its name
// (dozens of components gate their queries on it) but now answers "is the
// Supabase backend configured?" — which is always true because the project URL
// and publishable key ship as safe client-side defaults in supabaseClient.js.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/api/supabaseClient';

export const appParams = {
  hasBase44Config: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  supabaseUrl: SUPABASE_URL,
};
