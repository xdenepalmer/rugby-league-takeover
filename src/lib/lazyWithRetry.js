import { lazy } from "react";

/**
 * React.lazy that survives a stale-chunk fetch after a deploy.
 *
 * On a launch night of repeated deploys this matters: /assets is
 * immutable-cached, so an already-open tab that navigates to a COLD route
 * (one whose chunk it never fetched) after a new deploy asks for an old-hash
 * file that now 404s. The dynamic import() rejects and, without this, the whole
 * SPA falls into RootErrorBoundary. Here we reload ONCE (the new HTML points at
 * the new hashes) and, guarded by sessionStorage, never loop: a genuinely
 * broken deploy degrades to a single reload and then the real error.
 *
 * Extracted verbatim from Admin.jsx, where it has run in production; now shared
 * so the public routes get the same protection.
 */
export const lazyWithRetry = (factory, key) => lazy(async () => {
  try {
    const module = await factory();
    try { sessionStorage.removeItem(`rlt_lazy_reload_${key}`); } catch { /* noop */ }
    return module;
  } catch (error) {
    const message = String(error?.message || error || "");
    const isChunkLoadError = message.includes("Failed to fetch dynamically imported module") || message.includes("Importing a module script failed");
    const storageKey = `rlt_lazy_reload_${key}`;
    let alreadyRetried = false;

    try {
      alreadyRetried = sessionStorage.getItem(storageKey) === "1";
      if (isChunkLoadError && !alreadyRetried) sessionStorage.setItem(storageKey, "1");
    } catch { /* noop */ }

    if (isChunkLoadError && !alreadyRetried) {
      window.location.reload();
      return new Promise(() => {});
    }

    throw error;
  }
});
