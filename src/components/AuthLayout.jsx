import React from "react";
import { motion } from "framer-motion";
import { Hexagon, Sparkles } from "lucide-react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-2 bg-background relative overflow-hidden">
      {/* ── LEFT HALF: ATMOSPHERIC VEGAS STREAM (Hidden on mobile) ── */}
      <div className="relative hidden lg:flex flex-col items-center justify-center p-12 overflow-hidden border-r border-border/40 select-none">
        
        {/* Animated Gradient Background */}
        <motion.div 
          animate={{
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{ backgroundSize: "300% 300%" }}
          className="absolute inset-0 bg-gradient-to-br from-background via-primary/10 to-accent/15 z-0"
        />

        {/* Backdrop Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px] opacity-40 z-0 cmd-grid-bg" />

        {/* Scan Line Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none cmd-scan-line z-10" />

        {/* Floating Particles/Shapes */}
        <motion.div
          animate={{ y: [0, -25, 0], x: [0, 15, 0], rotate: [0, 360] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-12 h-12 border border-primary/20 bg-primary/5 blur-[2px] z-0"
        />
        <motion.div
          animate={{ y: [0, 30, 0], x: [0, -18, 0], rotate: [0, -360] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/4 right-1/4 w-16 h-16 border border-accent/20 bg-accent/5 blur-[3px] z-0"
        />
        <motion.div
          animate={{ scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 right-1/3 w-3 h-3 rounded-full bg-primary/20 shadow-[0_0_15px_rgba(249,115,22,0.4)] z-0"
        />

        {/* Text Container */}
        <div className="relative z-10 text-center max-w-lg">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex justify-center mb-6"
          >
            <div className="inline-flex p-3 bg-card/60 border border-border cmd-glass shadow-lg">
              <Sparkles className="w-8 h-8 text-accent animate-pulse" />
            </div>
          </motion.div>

          <motion.h2 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-5xl xl:text-6xl uppercase tracking-wider text-foreground leading-[1.05]"
          >
            RUGBY LEAGUE <span className="text-primary drop-shadow-[0_0_15px_rgba(249,115,22,0.35)]">TAKEOVER</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-xs uppercase tracking-[0.45em] text-accent mt-4 font-mono font-bold"
          >
            LAS VEGAS 2026
          </motion.p>
        </div>
      </div>

      {/* ── RIGHT HALF: AUTH FORM (Full-width on mobile) ── */}
      <div className="flex max-h-dvh items-center justify-center overflow-y-auto p-6 sm:p-10 md:p-16 z-10 relative">
        {/* Mobile Background visual (Atmospheric Gradient behind card) */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-accent/5 z-0 lg:hidden" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:48px_48px] opacity-30 z-0 lg:hidden" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md relative z-10"
        >
          {/* Header Block */}
          <div className="text-center mb-8">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.15 }}
              className="inline-flex items-center justify-center relative w-16 h-16 mb-4 group"
            >
              {/* Hexagonal decorative backing */}
              <Hexagon className="absolute inset-0 w-full h-full text-primary fill-primary/5 stroke-[1px] group-hover:rotate-45 transition-transform duration-500 shadow-md" />
              {Icon && <Icon className="w-6 h-6 text-foreground relative z-10" aria-hidden="true" />}
            </motion.div>
            
            <h1 className="text-3xl font-display uppercase tracking-wider text-foreground">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{subtitle}</p>}
          </div>

          {/* Glassmorphic Form Wrapper Card */}
          <div className="bg-card/50 border border-border cmd-glass p-8 relative overflow-hidden shadow-2xl">
            {/* Top Accent Streamer Line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] cmd-accent-bar" />
            
            {children}
          </div>

          {footer && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center text-sm text-muted-foreground mt-6"
            >
              {footer}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
