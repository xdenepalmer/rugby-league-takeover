/**
 * Shared motion vocabulary. framer-motion is used in ~100 files with no
 * consistent durations/eases/springs; this is the single source so the app
 * feels like one system. Pair with <MotionConfig reducedMotion="user"> at the
 * app root (src/App.jsx) so every motion component honours the OS "Reduce
 * Motion" setting automatically (framer animates via inline transforms that
 * bypass the CSS reduced-motion reset).
 */

// Durations (seconds) — four tiers, nothing else.
export const DUR = { fast: 0.15, base: 0.25, slow: 0.4, slower: 0.6 };

// Eases — three named curves cover every case.
export const EASE = {
  out: [0.22, 1, 0.36, 1], // standard entrances (iOS ease-out-quint)
  inOut: [0.65, 0, 0.35, 1], // symmetric moves
  standard: [0.2, 0.8, 0.2, 1], // matches the .ios-pressable CSS curve
};

// Springs — three presets named by feel.
export const SPRING = {
  sheet: { type: "spring", stiffness: 300, damping: 30 }, // sheets/drawers
  pop: { type: "spring", stiffness: 400, damping: 28 }, // badges/chips
  gentle: { type: "spring", stiffness: 120, damping: 20 }, // hero/section
};

// Common variants.
export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.slow, ease: EASE.out } },
};

export const staggerParent = (stagger = 0.06) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger } },
});
