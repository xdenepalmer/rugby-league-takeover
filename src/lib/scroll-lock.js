// Ref-counted body scroll lock.
//
// Two overlays (the thread modal and the compose sheet) used to write
// `document.body.style.overflow` independently. Opening the composer from
// inside the modal interleaved their effects: the modal's delayed cleanup
// (AnimatePresence exit) ran ~300ms after the sheet's lock, unlocking the
// page while the sheet was still open — the background scrolled under it and
// iOS lost the scroll position. A counter means the body stays locked until
// the LAST overlay releases.
let lockCount = 0;

export function lockBodyScroll() {
  if (typeof document === "undefined") return () => {};
  lockCount += 1;
  document.body.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return; // effect cleanups can be defensive-called twice
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) document.body.style.overflow = "";
  };
}
