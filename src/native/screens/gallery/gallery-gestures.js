/**
 * Pure gesture math for the native media viewer: which action a completed
 * drag maps to, and pinch-zoom scale handling. Kept free of DOM/react so
 * the policy is unit-testable.
 */
export const SWIPE_DISTANCE = 64; // px of horizontal travel to change item
export const DISMISS_DISTANCE = 110; // px of downward travel to close
export const MAX_ZOOM = 4;
export const MIN_ZOOM = 1;

/**
 * Resolve a completed single-pointer drag. Vertical-down wins when the
 * gesture is clearly vertical (drag-to-dismiss); horizontal wins when
 * clearly horizontal (next/prev). Zoomed-in images pan instead of swiping.
 */
export function resolveDragEnd({ dx, dy, zoom = 1 }) {
  if (zoom > 1.05) return null; // panning while zoomed — never navigate
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (dy > DISMISS_DISTANCE && absY > absX * 1.2) return "dismiss";
  if (absX > SWIPE_DISTANCE && absX > absY * 1.2) return dx < 0 ? "next" : "prev";
  return null;
}

export function clampZoom(scale) {
  if (!Number.isFinite(scale)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/** Distance between two pointers — pinch base measurement. */
export function pointerDistance(a, b) {
  const dx = (a?.x ?? 0) - (b?.x ?? 0);
  const dy = (a?.y ?? 0) - (b?.y ?? 0);
  return Math.hypot(dx, dy);
}

/** Neighbouring indices to prefetch (wrapping), excluding the active one. */
export function adjacentIndices(index, length) {
  if (!Number.isInteger(index) || !Number.isInteger(length) || length <= 1) return [];
  const prev = (index - 1 + length) % length;
  const next = (index + 1) % length;
  return prev === next ? [next] : [prev, next];
}
