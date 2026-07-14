/**
 * Shared native page-transition constants so the fan shell (NativePublicShell)
 * and the admin shell (NativeAdminShell) animate route changes IDENTICALLY — a
 * quick slide-fade (the canitickit feel). Honoured by MotionConfig
 * reducedMotion="user" (App.jsx), so it self-disables under Reduce Motion, and
 * mode="wait" (at each call site) keeps it out of the way of NativeScrollMemory's
 * before-paint scroll restore.
 */
export const pageVariants = {
  initial: { opacity: 0, x: 12 },
  in: { opacity: 1, x: 0 },
  out: { opacity: 0, x: -12 },
};

export const pageTransition = { type: "tween", ease: "easeOut", duration: 0.18 };
