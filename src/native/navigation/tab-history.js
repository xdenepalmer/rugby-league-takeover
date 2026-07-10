/**
 * Per-tab navigation memory for the native shell. Each fan tab remembers the
 * last route it displayed so switching tabs restores context instead of
 * resetting to the root; reselecting the active tab pops to its root, and
 * reselecting at the root asks the shell to scroll to top. Pure functions —
 * the shell owns the (session-persisted) memory object.
 */
import { tabForPath, tabRoot } from "../app/native-tabs.js";

export const TAB_MEMORY_STORAGE_KEY = "rlt_native_tab_memory";

/** Record `path` as the last location owned by its tab. Returns new memory. */
export function rememberTabPath(memory, path) {
  const owner = tabForPath(typeof path === "string" ? path.split("?")[0] : path);
  if (!owner) return memory || {};
  return { ...(memory || {}), [owner]: path };
}

/**
 * Decide what a tab press does.
 * → { type: "navigate", to }    switch tabs (restoring remembered path)
 * → { type: "pop-to-root", to } active tab pressed while on a child route
 * → { type: "scroll-top" }      active tab pressed at its root
 */
export function resolveTabPress({ pressedTab, currentPath, memory }) {
  const root = tabRoot(pressedTab);
  const activeTab = tabForPath((currentPath || "").split("?")[0]);
  if (pressedTab !== activeTab) {
    const remembered = memory?.[pressedTab];
    return { type: "navigate", to: remembered || root };
  }
  const bare = (currentPath || "").split("?")[0];
  if (bare !== root) return { type: "pop-to-root", to: root };
  return { type: "scroll-top" };
}

export function loadTabMemory(storage) {
  try {
    const raw = (storage || sessionStorage).getItem(TAB_MEMORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveTabMemory(memory, storage) {
  try {
    (storage || sessionStorage).setItem(TAB_MEMORY_STORAGE_KEY, JSON.stringify(memory || {}));
  } catch {
    // Session persistence is best-effort; in-memory state still works.
  }
}
