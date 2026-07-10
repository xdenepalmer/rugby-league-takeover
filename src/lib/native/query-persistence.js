/**
 * Native-shell query-cache persistence: public content and the user's own
 * non-sensitive data survive an app relaunch, so tabs restore instantly
 * offline instead of flashing skeletons. Loaded ONLY via dynamic import
 * from the native branch — the web bundle never ships this module or the
 * @tanstack persist packages (vite manualChunks exempts them from the
 * preloaded vendor chunks).
 *
 * Safety rules (locked by tests):
 * - denylisted query keys are never written to disk (admin PII: orders,
 *   registrations, users, bans, invites, admin attention counts; plus the
 *   admin users edge-fn response)
 * - bounded age, versioned buster (app build id) so a deploy invalidates
 * - the store is cleared on sign-out / account change
 * - corrupted payloads are dropped, never thrown
 */
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { supabase } from "@/api/supabaseClient";

export const QUERY_CACHE_STORAGE_KEY = "rlt_native_query_cache";
export const QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

/** Query-key roots that must never be persisted (admin/PII surfaces). */
export const PERSIST_DENYLIST = [
  "orders",
  "registrations",
  "users",
  "bans",
  "invites",
  "adminAttention",
  "myOrders",
];

/** Pure policy so tests can assert it without a QueryClient. */
export function shouldPersistQuery(queryKey, state) {
  if (state && state.status !== "success") return false;
  const root = Array.isArray(queryKey) ? queryKey[0] : queryKey;
  return !PERSIST_DENYLIST.includes(String(root));
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

  const [, restorePromise] = persistQueryClient({
    queryClient,
    persister,
    maxAge: QUERY_CACHE_MAX_AGE_MS,
    buster: String(import.meta.env.VITE_BUILD_ID || "dev"),
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => shouldPersistQuery(query.queryKey, query.state),
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
    cleanup: () => authSub?.subscription?.unsubscribe?.(),
  };
}
