/**
 * Shared broken-image handler. Remote images (Supabase Storage, Unsplash) can
 * 404 or fail to load — especially on a cold native launch or a flaky mobile
 * connection. Hiding the failed <img> reveals the branded container behind it
 * (each call site sits in a fixed-aspect box with a dark brand background)
 * instead of the browser's broken-image glyph.
 *
 * Usage: <img src={remoteUrl} onError={hideBrokenImage} ... />
 */
export function hideBrokenImage(event) {
  const img = event?.currentTarget;
  if (img && img.style) img.style.display = "none";
}
