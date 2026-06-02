import React from "react";
import { motion } from "framer-motion";
import { ArrowDown, Sparkles } from "lucide-react";

const logoUrl = "https://media.base44.com/images/public/6a18d49a2b8f40f0f81cc26e/24c67d277_LASVEGAS.png";

// Text reveal animations variants
const titleContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.45,
    }
  }
};

const wordVariants = {
  hidden: { y: "40%", opacity: 0 },
  show: { 
    y: 0, 
    opacity: 1, 
    transition: { 
      type: "spring", 
      stiffness: 140, 
      damping: 18 
    } 
  }
};
export default function HeroSection({ settings = {} }) {
  const title = settings.hero_title || "The annual\nVegas takeover";
  const logo = settings.site_logo_url || logoUrl;

  // Split title lines and words for staggered reveals
  const titleLines = title.split("\n");

  return (
    <section id="home" className="relative min-h-screen overflow-hidden flex items-center justify-center bg-transparent">
      {/* Background Gradients and scan overlays */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#030512]/40 to-[#030512] z-10" />
        {/* Obsidian background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:80px_80px] opacity-25 z-0 cmd-grid-bg" />
      </div>

      {/* Floating Ambient Glowing Orbs */}
      <motion.div
        animate={{ 
          y: [0, -30, 0], 
          x: [0, 20, 0], 
          scale: [1, 1.15, 1] 
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-10 w-48 h-48 rounded-full bg-primary/5 blur-3xl z-0 pointer-events-none hidden md:block"
      />
      <motion.div
        animate={{ 
          y: [0, 25, 0], 
          x: [0, -25, 0],
          scale: [1, 1.1, 1] 
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-1/4 right-10 w-72 h-72 rounded-full bg-accent/5 blur-3xl z-0 pointer-events-none hidden md:block"
      />

      {/* 3D Floating Shapes with cmd-float */}
      <div className="absolute top-1/3 left-1/6 w-8 h-8 border border-primary/20 bg-primary/5 cmd-float hidden md:block" style={{ animationDelay: "1s" }} />
      <div className="absolute bottom-1/3 right-1/6 w-12 h-12 border border-accent/20 bg-accent/5 cmd-float hidden md:block" style={{ animationDelay: "2s" }} />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-5 pb-16 pt-28 text-center md:px-8 md:pb-24">
        
        {/* Site Logo with smooth spring entry */}
        <motion.img
          src={logo}
          alt="Rugby League Takeover Las Vegas"
          initial={{ opacity: 0, y: -80, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 w-52 drop-shadow-[0_15px_30px_rgba(249,115,22,0.25)] sm:w-64 md:w-80 select-none pointer-events-none"
        />

        {/* Title & Subtext block */}
        <div className="space-y-4 max-w-4xl">
          <motion.p 
            initial={{ opacity: 0, letterSpacing: "0.2em" }}
            animate={{ opacity: 1, letterSpacing: "0.35em" }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-[10px] font-bold uppercase tracking-[0.32em] text-primary sm:text-xs md:text-sm md:tracking-[0.42em] flex items-center justify-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-accent" />
            <span>{settings.hero_eyebrow || "Las Vegas • Rugby League • Supporter Takeover"}</span>
          </motion.p>

          {/* Staggered Heading Revealer */}
          <motion.h1 
            variants={titleContainerVariants}
            initial="hidden"
            animate="show"
            className="font-display text-5xl uppercase leading-[0.9] tracking-tight text-foreground sm:text-6xl md:text-8xl lg:text-9xl overflow-hidden py-1"
          >
            {titleLines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {lIdx > 0 && <br />}
                <span className="inline-block overflow-hidden py-1">
                  {line.split(" ").map((word, wIdx) => (
                    <motion.span 
                      key={wIdx} 
                      variants={wordVariants}
                      className="inline-block mr-[0.2em] last:mr-0 text-foreground hover:text-primary transition-colors duration-300"
                    >
                      {word}
                    </motion.span>
                  ))}
                </span>
              </React.Fragment>
            ))}
          </motion.h1>

          {/* Descriptive text */}
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl"
          >
            {settings.hero_description || "Join the world’s most passionate and loyal Rugby League supporter groups for an unforgettable global footy invasion of Las Vegas."}
          </motion.p>
        </div>

        {/* Pulsing CTA Action Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="mt-12"
        >
          <a 
            href="#news" 
            className="group inline-flex items-center gap-3 border border-primary px-8 py-4 text-xs font-bold uppercase tracking-[0.25em] text-foreground bg-primary/5 hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_25px_rgba(249,115,22,0.4)] transition-all duration-300 rounded-none relative overflow-hidden cursor-pointer"
          >
            <span>{settings.hero_button_label || "Enter the site"}</span> 
            <ArrowDown aria-hidden="true" className="h-4 w-4 animate-bounce text-primary group-hover:text-primary-foreground" />
          </a>
        </motion.div>

      </div>
    </section>
  );
}