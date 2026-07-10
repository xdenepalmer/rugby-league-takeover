/**
 * Native-shell query-cache persistence: public, non-PII content survives an
 * app relaunch, so tabs restore instantly offline instead of flashing
 * skeletons. Loaded ONLY via dynamic import from the native branch — the web
 * bundle never ships this module or the @tanstack persist packages (vite
 * manualChunks exempts them from the preloaded vendor chunks).
 *
 * Safety rules (locked by tests):
 * - ALLOWLIST persistence: only public content roots are ever written to
 *   disk. Everything else — forum posts (admin projections carry
 *   ip_address/user_email/reported_by), notifications, orders, all
 *   user-scoped and admin queries — is never persisted, secure by default.
 * - mutations are never dehydrated (a paused offline mutation could carry
 *   ban emails/IPs)
 * - bounded age, versioned buster (app build id) so a deploy invalidates
 * - the store is cleared on sign-out / account change
 * - corrupted payloads are dropped, never thrown
 */
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { supabase } from "@/api/supabaseClient";

export const QUERY_CACHE_STORAGE_KEY = "rlt_native_query_cache";
export const QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Query-key roots that MAY be persisted: public, non-PII content whose RLS
 * returns the same rows for every caller. Anything not on this list
 * (forumPosts, testimonials, tippingEntries, notifications, orders,
 * registrations, users, bans, invites, adminAttention, myOrders,
 * myInterest, myPosts, fanRewardEvents, user, …) is never written to disk.
 *
 * Deliberately NOT allowlisted despite being "public" feeds: `events` and
 * `matchups` — their RLS widens to unpublished rows for admins
 * (`is_published or is_admin()`), and the native admin modules query the
 * SAME roots, so allowlisting them would persist unpublished admin content
 * on an admin device (and hydrate it into the fan UI at next cold start).
 */
export const PERSIST_ALLOWLIST = [
  "siteSettings",
  "news",
  "products",
  "gallery",
  "teams",
  "partners",
  "faqs",
];

/** Pure policy so tests can assert it without a QueryClient. */
export function shouldPersistQuery(queryKey, state) {
  if (!state || state.status !== "success") return false;
  const root = Array.isArray(queryKey) ? queryKey[0] : queryKey;
  return PERSIST_ALLOWLIST.includes(String(root));
}

export function clearPersistedQueryCache(storage) {
  try {
    (storage || window.localStorage).removeItem(QUERY_CACHE_STORAGE_KEY);
  } catch {
    // best-effort
  }
}

export function initNativeQueryPersistence(queryClient) {
  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: QUERY_CACHE_STORAGE_KEY,
    throttleTime: 2000,
  });

  const [stopPersistence, restorePromise] = persistQueryClient({
    queryClient,
    persister,
    maxAge: QUERY_CACHE_MAX_AGE_MS,
    buster: String(import.meta.env.VITE_BUILD_ID || "dev"),
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => shouldPersistQuery(query.queryKey, query.state),
      // Never serialize mutations: a paused offline mutation (e.g. a ban)
      // could carry emails/IPs to disk.
      shouldDehydrateMutation: () => false,
    },
  });

  // Account change / sign-out: drop everything user-scoped.
  const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      clearPersistedQueryCache();
      queryClient.removeQueries();
    }
  });

  return {
    restorePromise,
    cleanup: () => {
      stopPersistence?.();
      authSub?.subscription?.unsubscribe?.();
    },
  };
}
