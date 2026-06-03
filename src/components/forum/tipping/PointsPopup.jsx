import { motion } from "framer-motion";

// ── Points display ──────────────────────────────────────────────────
export default function PointsPopup({ points, show }) {
  if (!show || !points) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.8 }}
      animate={{ opacity: 1, y: -20, scale: 1 }}
      exit={{ opacity: 0, y: -40 }}
      transition={{ duration: 0.6 }}
      className="pointer-events-none absolute left-1/2 top-0 z-40 -translate-x-1/2"
    >
      <span className="font-display text-lg font-black text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.7)]">
        +{points} pts
      </span>
    </motion.div>
  );
}
