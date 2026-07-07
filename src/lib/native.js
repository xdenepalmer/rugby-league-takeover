// Capacitor native-shell integration.
//
// The same web build runs on the web AND inside the native iOS app (Capacitor).
// Everything here is a no-op on the web — guarded by `isNative()` — so importing
// it is always safe. On device it wires up the bits a wrapped web app needs to
// feel native: splash handoff, status bar, in-app browser for external links,
// and deep-link handling so OAuth (Google) can return into the app.

import { Capacitor } from '@capacitor/core';

export function isNative() {
  try {
    return Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

// Custom URL scheme the app is registered for (see ios Info.plist
// CFBundleURLTypes). Supabase redirects OAuth back to this, and the
// `appUrlOpen` listener below turns it into a session.
export const AUTH_CALLBACK_URL = 'com.rugbyleaguetakeover.app://auth/callback';

// Open an external URL. On device we use an in-app Safari view (SFSafariVC)
// so the user stays in-context and returns to the app on dismiss; on the web
// we just navigate. Used for the Stripe checkout hand-off.
export async function openExternal(url) {
  if (!url) return;
  if (!isNative()) {
    window.location.href = url;
    return;
  }
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url, presentationStyle: 'fullscreen' });
}

// Complete a Supabase OAuth sign-in from a deep-link URL. Handles both the
// implicit flow (tokens in the URL fragment) and the PKCE flow (?code=...),
// so it keeps working regardless of the client's flowType. Returns true if a
// session was established.
async function completeOAuthFromUrl(rawUrl) {
  const { supabase } = await import('@/api/supabaseClient');
  let handled = false;
  try {
    const url = new URL(rawUrl);

    // PKCE: ?code=...
    const code = url.searchParams.get('code');
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) handled = true;
    }

    // Implicit: #access_token=...&refresh_token=...
    if (!handled && url.hash && url.hash.length > 1) {
      const frag = new URLSearchParams(url.hash.slice(1));
      const access_token = frag.get('access_token');
      const refresh_token = frag.get('refresh_token');
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (!error) handled = true;
      }
    }
  } catch {
    /* not an auth deep link — ignore */
  }
  return handled;
}

let initialised = false;

// Called once at boot (main.jsx). Safe to call on the web (no-op).
export async function initNative() {
  if (initialised || !isNative()) return;
  initialised = true;

  document.documentElement.classList.add('capacitor-native');

  // Status bar: light content on the app's dark background, don't overlay.
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch { /* plugin unavailable */ }

  // Hide the splash once the web app has actually painted.
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch { /* plugin unavailable */ }

  // Deep links: finish OAuth and dismiss the in-app browser.
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('appUrlOpen', async ({ url }) => {
      if (!url) return;
      const isAuth = url.includes('auth/callback') || url.includes('access_token') || url.includes('code=');
      if (!isAuth) return;
      const ok = await completeOAuthFromUrl(url);
      try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.close();
      } catch { /* browser may already be closed */ }
      if (ok) {
        // Land the user in their account area with a fresh session.
        window.location.assign('/account');
      }
    });
  } catch { /* plugin unavailable */ }
}
