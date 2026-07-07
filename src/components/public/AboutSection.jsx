import React, { useRef, useEffect, useState } from "react";
import { motion, useInView, useMotionValue, useTransform, useScroll, animate } from "framer-motion";
import { Users, Flag, CalendarDays, Trophy } from "lucide-react";
import SectionHeader from "./SectionHeader";

/* ─── Animated counter hook ─────────────────────────────────── */
function useAnimatedCounter(target, isInView, duration = 2) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(count, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });
    const unsubscribe = rounded.on("change", (v) => setDisplay(v));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [isInView, target, count, rounded, duration]);

  return display;
}

/* ─── Stats data ────────────────────────────────────────────── */
const STATS = [
  { key: "supporters", value: 17000, suffix: "", label: "Supporters", icon: Users },
  { key: "legacy", value: 4, suffix: "", label: "Years Running", icon: Flag },
  { key: "days", value: 7, suffix: "", label: "Days of Events", icon: CalendarDays },
];

/* ─── Single stat card ──────────────────────────────────────── */
function StatCard({ stat, index, isInView }) {
  const count = useAnimatedCounter(stat.value, isInView, stat.value > 100 ? 2.4 : 1.6);
  const Icon = stat.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: 0.15 * index, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col items-center gap-2 px-6 py-5"
    >
      {/* Hover glow */}
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-500" />
      
      <Icon className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors duration-300" aria-hidden="true" />
      <span className="font-display text-4xl tabular-nums tracking-tight text-foreground md:text-5xl">
        {count.toLocaleString()}{stat.suffix}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
        {stat.label}
      </span>
    </motion.div>
  );
}

/* ─── Stagger container variants ────────────────────────────── */
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const staggerChild = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 120, damping: 20 },
  },
};

/* ─── AboutSection ──────────────────────────────────────────── */
export default function AboutSection({ settings = {} }) {
  const sectionRef = useRef(null);
  const imageContainerRef = useRef(null);
  const statsRef = useRef(null);
  const textRef = useRef(null);

  const textInView = useInView(textRef, { amount: 0.3, once: true });
  const statsInView = useInView(statsRef, { amount: 0.5, once: true });
  const imageInView = useInView(imageContainerRef, { amount: 0.3, once: true });

  /* Parallax scroll for image */
  const { scrollYProgress } = useScroll({
    target: imageContainerRef,
    offset: ["start end", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.15, 1.05, 1]);

  return (
    <section
      id="about"
      ref={sectionRef}
      className="relative border-t border-border bg-secondary/80 overflow-hidden"
    >
      {/* ── Main grid ─────────────────────────────────────── */}
      <div className="mx-auto grid max-w-7xl items-stretch lg:grid-cols-[1fr_1fr]">

        {/* ── Left: Text column ───────────────────────────── */}
        <div className="relative px-5 py-24 md:px-12 md:py-32 lg:pr-16">
          {/* Grid / noise background texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(0deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          {/* Noise grain */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-soft-light"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />

          <motion.div
            ref={textRef}
            variants={staggerContainer}
            initial="hidden"
            animate={textInView ? "show" : "hidden"}
            className="relative z-10"
          >
            <motion.div variants={staggerChild}>
              <SectionHeader
                eyebrow={settings.about_eyebrow || "About Us"}
                title={settings.about_title || "Built by fans, for fans"}
              >
                {settings.about_description ||
                  "Rugby League Takeover Las Vegas brings together loyal supporter groups for a full-throttle celebration of Australian rugby league culture on the biggest stage in sport entertainment."}
              </SectionHeader>
            </motion.div>

            <motion.div
              variants={staggerChild}
              className="grid gap-4 border-l-2 border-primary/60 pl-6 text-muted-foreground"
            >
              <p>
                {settings.about_body ||
                  "Expect flags, chants, mateship, packed events, Vegas energy and a supporter community that travels hard and backs their team harder."}
              </p>
              <p className="font-semibold text-foreground">
                {settings.about_highlight ||
                  "Join the world's most passionate Rugby League supporter groups."}
              </p>
            </motion.div>

            {/* ── Stats strip ───────────────────────────────── */}
            <motion.div variants={staggerChild}>
              <div
                ref={statsRef}
                className="cmd-accent-bar mt-14 border border-border bg-background/60 backdrop-blur-sm"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
                  {STATS.map((stat, i) => (
                    <StatCard
                      key={stat.key}
                      stat={stat}
                      index={i}
                      isInView={statsInView}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* ── Right: Image column with parallax ───────────── */}
        <div
          ref={imageContainerRef}
          className="group/img relative min-h-[520px] overflow-hidden lg:min-h-0 cursor-pointer"
        >
          {/* Parallax-moving image — grayscale by default, colour on hover */}
          <motion.div
            style={{ y: imageY, scale: imageScale }}
            className="absolute inset-0 will-change-transform"
          >
            <img
              src={
                settings.about_image_url ||
                "https://images.unsplash.com/photo-1569959220744-ff553533f492?auto=format&fit=crop&w=1400&q=80"
              }
              alt="Supporters celebrating"
              loading="lazy"
              className="h-full w-full object-cover md:grayscale transition-[filter] duration-700 ease-out md:group-hover/img:grayscale-0"
            />
          </motion.div>

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#030512]/80 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#030512]/40 to-transparent lg:from-[#030512]/60" />

          {/* Scan line overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)",
            }}
          />

          {/* Caption block */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={imageInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-0 left-0 right-0 p-8 md:p-10"
          >
            <div className="flex items-end gap-4">
              <Trophy className="mb-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
              <p className="font-display text-3xl uppercase leading-none text-foreground md:text-4xl lg:text-5xl">
                {settings.about_image_caption || "Las Vegas will hear us."}
              </p>
            </div>
          </motion.div>

          {/* Corner accent marks */}
          <div className="absolute left-4 top-4 h-8 w-8 border-l-2 border-t-2 border-primary/30" />
          <div className="absolute bottom-4 right-4 h-8 w-8 border-b-2 border-r-2 border-primary/30" />
        </div>
      </div>
    </section>
  );
}