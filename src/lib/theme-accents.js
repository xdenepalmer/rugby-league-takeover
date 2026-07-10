/**
 * Canonical accent-theme registry. App.jsx applies these as `--primary` /
 * `--primary-foreground` CSS variables and listens for the
 * `rlt_theme_change` CustomEvent; the native More sheet (and any future web
 * picker) dispatches that event. Persisted under localStorage
 * "rlt_theme_accent". Values are HSL triples matching src/index.css tokens.
 */
export const THEME_ACCENT_STORAGE_KEY = "rlt_theme_accent";
export const THEME_ACCENT_EVENT = "rlt_theme_change";
export const DEFAULT_THEME_ACCENT = "sincity";

export const THEME_ACCENTS = {
  sincity: { label: "Sin City", primary: "15 95% 55%", foreground: "0 0% 100%" },
  flamingo: { label: "Flamingo", primary: "330 95% 60%", foreground: "0 0% 100%" },
  highroller: { label: "High Roller", primary: "280 80% 55%", foreground: "0 0% 100%" },
  emerald: { label: "Emerald", primary: "140 75% 45%", foreground: "0 0% 100%" },
  jackpot: { label: "Jackpot", primary: "45 93% 47%", foreground: "0 0% 0%" },
};

export function getStoredThemeAccent(storage) {
  try {
    const stored = (storage || localStorage).getItem(THEME_ACCENT_STORAGE_KEY);
    return stored && THEME_ACCENTS[stored] ? stored : DEFAULT_THEME_ACCENT;
  } catch {
    return DEFAULT_THEME_ACCENT;
  }
}

/** Dispatch the accent-change event App.jsx listens for. */
export function requestThemeAccent(themeKey) {
  if (!THEME_ACCENTS[themeKey] || typeof window === "undefined") return false;
  window.dispatchEvent(new CustomEvent(THEME_ACCENT_EVENT, { detail: { theme: themeKey } }));
  return true;
}
