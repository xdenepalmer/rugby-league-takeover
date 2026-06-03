import { useMemo } from "react";
import { motion } from "framer-motion";

// ── Confetti burst on tip lock ──────────────────────────────────────
export default function ConfettiBurst({ active }) {
  const particles = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 300,
    y: -(Math.random() * 180 + 50),
    r: Math.random() * 720,
    color: ["#00ff88", "#ff6b35", "#00d4ff", "#ffd700", "#ff3366", "#a855f7", "#34d399", "#f472b6"][i % 8],
    size: 3 + Math.random() * 6,
    shape: i % 3 === 0 ? "circle" : i % 3 === 1 ? "square" : "diamond",
    delay: Math.random() * 0.15,
  })), []);
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: "50%", y: "70%", opacity: 1, scale: 1, rotate: 0 }}
          animate={{ x: `calc(50% + ${p.x}px)`, y: `calc(70% + ${p.y}px)`, opacity: 0, scale: 0.2, rotate: p.r }}
          transition={{ duration: 1.3, ease: "easeOut", delay: p.delay }}
          style={{
            position: "absolute", width: p.size, height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === "circle" ? "50%" : 1,
          }}
        />
      ))}
    </div>
  );
}
