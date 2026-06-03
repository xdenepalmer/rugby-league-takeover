import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

/* ─── Typewriter Message ─── */
export default function TypewriterMessage({ text, type }) {
  const [displayed, setDisplayed] = useState("");
  const prevTextRef = useRef("");

  useEffect(() => {
    if (text === prevTextRef.current) return;
    prevTextRef.current = text;
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [text]);

  const colorClass = type === "win"
    ? "text-amber-200 font-black uppercase tracking-wider drop-shadow-[0_0_14px_rgba(251,191,36,0.6)]"
    : type === "near"
    ? "text-emerald-300 font-bold"
    : type === "loss"
    ? "text-red-300/80"
    : "text-slate-300";

  return (
    <p className={`mt-3 min-h-[2.5rem] text-center font-mono text-[11px] leading-relaxed ${colorClass}`} aria-live="polite">
      {displayed}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="inline-block w-[2px] h-3 bg-current ml-0.5 align-middle"
      />
    </p>
  );
}
