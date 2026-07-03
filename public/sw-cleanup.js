// Prevent stale service-worker/dev caches from serving mismatched React chunks in preview.
// Lives in its own file (not inline in index.html) so the Content-Security-Policy
// can use script-src 'self' without an unsafe-inline carve-out.
if (
  location.hostname.includes('preview') ||
  location.search.includes('_preview_token') ||
  location.search.includes('base44_data_env') ||
  location.search.includes('app_id') ||
  location.search.includes('access_token')
) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
  }
  if ('caches' in window) {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
  }
}
