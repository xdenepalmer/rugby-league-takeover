/**
 * Auth-provider availability inside the native shell.
 *
 * Google OAuth via supabase-js navigates the WebView to Google's authorize
 * page; Google blocks WebView logins (disallowed_useragent) and the redirect
 * would land the session on the web origin, not in the app. Until the
 * dedicated auth story ships a Capacitor Browser + deep-link return flow,
 * Google sign-in is hidden in native — email/password works natively today.
 */
export function canUseGoogleOAuth({ isNative = false } = {}) {
  return !isNative;
}
