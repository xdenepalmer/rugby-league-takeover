import React, { useEffect, useRef } from "react";
import { motion, useMotionValue, useMotionTemplate, useSpring } from "framer-motion";

/**
 * Desktop-only ambient spotlight that trails the cursor inside its parent
 * section. Driven entirely by motion values (zero React re-renders) and a
 * single composited radial-gradient layer — flawless performance.
 */
export default function CursorSpotlight() {
  const ref = useRef(null);
  const rawX = useMotionValue(-600);
  const rawY = useMotionValue(-600);
  const x = useSpring(rawX, { stiffness: 120, damping: 25, restDelta: 0.5 });
  const y = useSpring(rawY, { stiffness: 120, damping: 25, restDelta: 0.5 });
  const background = useMotionTemplate`radial-gradient(480px circle at ${x}px ${y}px, rgba(249,115,22,0.09), rgba(245,158,11,0.04) 45%, transparent 70%)`;

  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    // Pointer-fine devices only — never runs on touch.
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const handleMove = (e) => {
      const rect = parent.getBoundingClientRect();
      rawX.set(e.clientX - rect.left);
      rawY.set(e.clientY - rect.top);
    };
    parent.addEventListener("pointermove", handleMove, { passive: true });
    return () => parent.removeEventListener("pointermove", handleMove);
  }, [rawX, rawY]);

  return (
    <motion.div
      ref={ref}
      aria-hidden="true"
      style={{ background }}
      className="pointer-events-none absolute inset-0 z-[6] hidden lg:block"
    />
  );
}