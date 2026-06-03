import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Ambient Particles ─── */
export function AmbientParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1.5 + Math.random() * 2.5,
      duration: 3 + Math.random() * 5,
      delay: Math.random() * 4,
    })), []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle, rgba(251,191,36,0.6) 0%, transparent 70%)`,
          }}
          animate={{
            opacity: [0, 0.8, 0],
            scale: [0.5, 1.2, 0.5],
            y: [0, -20, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Neon Border Glow ─── */
export function NeonGlow({ spinning, isWin }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-0"
      animate={{
        boxShadow: isWin
          ? [
              "inset 0 0 60px rgba(251,191,36,0.15), 0 0 40px rgba(251,191,36,0.2)",
              "inset 0 0 80px rgba(251,191,36,0.25), 0 0 60px rgba(251,191,36,0.35)",
              "inset 0 0 60px rgba(251,191,36,0.15), 0 0 40px rgba(251,191,36,0.2)",
            ]
          : spinning
          ? [
              "inset 0 0 30px rgba(168,85,247,0.08), 0 0 20px rgba(168,85,247,0.1)",
              "inset 0 0 50px rgba(168,85,247,0.15), 0 0 35px rgba(168,85,247,0.18)",
              "inset 0 0 30px rgba(168,85,247,0.08), 0 0 20px rgba(168,85,247,0.1)",
            ]
          : "inset 0 0 30px rgba(0,0,0,0.5), 0 0 15px rgba(168,85,247,0.05)",
      }}
      transition={{ duration: isWin ? 0.6 : 2, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/* ─── Win Celebration: massive golden explosion ─── */
export function WinCelebration({ show, isJackpot }) {
  const coins = useMemo(() =>
    Array.from({ length: isJackpot ? 60 : 40 }, (_, i) => ({
      id: i,
      angle: (i / (isJackpot ? 60 : 40)) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
      dist: 120 + Math.random() * (isJackpot ? 240 : 180),
      size: 6 + Math.random() * (isJackpot ? 14 : 10),
      delay: Math.random() * 0.3,
      emoji: ["🪙", "💰", "⭐", "✨", "🎉"][Math.floor(Math.random() * 5)],
    })), [isJackpot]);

  const bursts = useMemo(() =>
    Array.from({ length: isJackpot ? 36 : 24 }, (_, i) => ({
      id: i,
      angle: (i / (isJackpot ? 36 : 24)) * Math.PI * 2,
      dist: 60 + Math.random() * (isJackpot ? 140 : 100),
      delay: i * 0.02,
    })), [isJackpot]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
        >
          {/* Golden flash — more dramatic for jackpot */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isJackpot ? [0, 0.6, 0.15, 0.4, 0.1, 0] : [0, 0.35, 0.1, 0.25, 0] }}
            transition={{ duration: isJackpot ? 2 : 1.5 }}
            className="absolute inset-0 bg-amber-400"
          />

          {/* Screen-wide white flash for jackpot */}
          {isJackpot && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.9, 0] }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 bg-white z-50"
            />
          )}

          {/* Radial burst rings */}
          {(isJackpot ? [0, 0.1, 0.2, 0.35, 0.5] : [0, 0.15, 0.3]).map((delay, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: isJackpot ? 4 : 3, opacity: 0 }}
              transition={{ duration: isJackpot ? 1.5 : 1.2, delay }}
              className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full border-4 border-amber-300/50"
            />
          ))}

          {/* Particle burst */}
          {bursts.map((b) => (
            <motion.div
              key={b.id}
              initial={{ x: "50%", y: "33%", scale: 0, opacity: 1 }}
              animate={{
                x: `calc(50% + ${Math.cos(b.angle) * b.dist}px)`,
                y: `calc(33% + ${Math.sin(b.angle) * b.dist}px)`,
                scale: [0, 1.5, 0],
                opacity: [1, 1, 0],
              }}
              transition={{ duration: 1, delay: b.delay }}
              className="absolute w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,1)]"
            />
          ))}

          {/* Cascading coins */}
          {coins.map((c) => (
            <motion.div
              key={c.id}
              initial={{ x: "50%", y: "33%", scale: 0, opacity: 1 }}
              animate={{
                x: `calc(50% + ${Math.cos(c.angle) * c.dist}px)`,
                y: `calc(33% + ${Math.sin(c.angle) * c.dist + 100}px)`,
                scale: [0, 1.3, 0.8],
                opacity: [1, 1, 0],
                rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
              }}
              transition={{ duration: 1.8, delay: c.delay, ease: "easeOut" }}
              className="absolute text-lg select-none"
              style={{ fontSize: c.size }}
            >
              {c.emoji}
            </motion.div>
          ))}

          {/* JACKPOT text — bigger and more dramatic for new wins */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1.1, 1.2, 1], opacity: [0, 1, 1, 1, 1] }}
            transition={{ duration: isJackpot ? 0.8 : 0.5, delay: 0.2, ease: "backOut" }}
            className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className={`border-2 border-amber-300 bg-black/90 px-6 py-2 text-center ${
                  isJackpot
                    ? "shadow-[0_0_60px_rgba(251,191,36,0.9),0_0_120px_rgba(251,191,36,0.4)]"
                    : "shadow-[0_0_40px_rgba(251,191,36,0.7),0_0_80px_rgba(251,191,36,0.3)]"
                }`}
              >
                <div className={`font-display font-black uppercase tracking-[0.3em] text-amber-200 drop-shadow-[0_0_20px_rgba(251,191,36,0.8)] ${
                  isJackpot ? "text-3xl" : "text-2xl"
                }`}>
                  {isJackpot ? "🎉 Jackpot! 🎉" : "Jackpot!"}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
