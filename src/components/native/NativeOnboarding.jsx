/**
 * NativeOnboarding — the first-launch welcome experience for the native iOS app.
 *
 * NATIVE-ONLY: a full-screen, safe-area-aware paged intro that sells the
 * Rugby League Takeover app (the Vegas / NRL takeover, the countdown & travel,
 * chips / XP / fan rewards, and the community forum & games) before dropping the
 * fan into Takeover HQ. It renders as a fixed inset-0 z-[300] overlay above
 * everything and calls `onDone` so the maintainer can unmount it.
 *
 * Shown once only: gated on the localStorage flag `rlt_native_onboarded` ("1").
 * The maintainer decides WHEN to mount via shouldShowOnboarding() (below); the
 * component itself writes the flag on finish/skip so it never re-appears.
 *
 * Slides use framer-motion, honouring prefers-reduced-motion (no slide/drag
 * animation when reduced). Haptics: selectionChanged on page change,
 * successImpact on completion.
 */
import React, { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarDays, Coins, MessageSquare, Trophy } from "lucide-react";
import { isNativeApp } from "@/lib/native/native-env";
import { selectionChanged, successImpact } from "@/lib/native/haptics";

const ONBOARDED_KEY = "rlt_native_onboarded";

/**
 * True only inside the native app when the user has not been onboarded yet.
 * localStorage access is guarded — a throwing/absent store simply means "show".
 */
export function shouldShowOnboarding() {
  if (!isNativeApp()) return false;
  try {
    return window.localStorage.getItem(ONBOARDED_KEY) !== "1";
  } catch {
    return true;
  }
}

function markOnboarded() {
  try {
    window.localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    // Private mode / disabled storage — worst case the intro shows again.
  }
}

const SLIDES = [
  {
    key: "welcome",
    icon: Trophy,
    eyebrow: "Las Vegas • NRL Takeover",
    title: "Welcome to the Takeover",
    body: "Your all-access pass to the biggest rugby league invasion of Sin City. The whole trip, in your pocket.",
    tone: "text-primary",
    ring: "border-primary/30 bg-primary/10 text-primary",
    glow: "hsl(var(--primary)/0.18)",
  },
  {
    key: "countdown",
    icon: CalendarDays,
    eyebrow: "Countdown & Travel",
    title: "Every minute to kickoff",
    body: "Watch the countdown tick down, lock in travel packages, and keep match days, venues and tickets one tap away.",
    tone: "text-accent",
    ring: "border-accent/30 bg-accent/10 text-accent",
    glow: "hsl(var(--accent)/0.20)",
  },
  {
    key: "rewards",
    icon: Coins,
    eyebrow: "Chips • XP • Fan Rewards",
    title: "Earn your stripes",
    body: "Rack up chips, climb the XP ranks and build your streak. The more you play along, the bigger the fan rewards.",
    tone: "text-orange-400",
    ring: "border-orange-500/30 bg-orange-500/10 text-orange-400",
    glow: "hsl(24 95% 53% / 0.20)",
  },
  {
    key: "community",
    icon: MessageSquare,
    eyebrow: "Forum & Games",
    title: "Join the away end",
    body: "Talk footy with the faithful, call the scores, and jump into the games. This takeover is better with your mob.",
    tone: "text-primary",
    ring: "border-primary/30 bg-primary/10 text-primary",
    glow: "hsl(var(--primary)/0.18)",
  },
];

/**
 * @param {object} props
 * @param {() => void} [props.onDone] Called after the flag is set on finish/skip.
 */
export default function NativeOnboarding({ onDone }) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const isLast = index === SLIDES.length - 1;

  const goTo = useCallback(
    (next) => {
      const clamped = Math.max(0, Math.min(SLIDES.length - 1, next));
      if (clamped === index) return;
      setDirection(clamped > index ? 1 : -1);
      setIndex(clamped);
      selectionChanged();
    },
    [index]
  );

  const complete = useCallback(() => {
    markOnboarded();
    successImpact();
    onDone?.();
  }, [onDone]);

  const skip = useCallback(() => {
    markOnboarded();
    selectionChanged();
    onDone?.();
  }, [onDone]);

  const variants = useMemo(
    () => ({
      enter: (dir) => ({ opacity: 0, x: reduceMotion ? 0 : dir * 48 }),
      center: { opacity: 1, x: 0 },
      exit: (dir) => ({ opacity: 0, x: reduceMotion ? 0 : dir * -48 }),
    }),
    [reduceMotion]
  );

  const slide = SLIDES[index];
  const Icon = slide.icon;

  return (
    <div
      className="nt-legible-floor fixed inset-0 z-[300] flex flex-col bg-background text-foreground"
      style={{
        paddingTop: "var(--safe-top)",
        paddingBottom: "max(1.25rem, var(--safe-bottom))",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Rugby League Takeover"
    >
      {/* Ambient brand glow that shifts with the active slide. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{ background: `radial-gradient(circle at 50% 22%, ${slide.glow}, transparent 62%)` }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.6 }}
      />

      {/* Skip */}
      <div className="relative flex justify-end nt-gutter-x pt-3">
        <button
          type="button"
          onClick={skip}
          className="ios-pressable nt-footnote font-bold uppercase tracking-wider text-muted-foreground"
        >
          Skip
        </button>
      </div>

      {/* Paged content */}
      <div className="relative flex min-h-0 flex-1 items-center">
        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
          <motion.div
            key={slide.key}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "tween", duration: 0.34, ease: [0.32, 0.72, 0, 1] }
            }
            drag={reduceMotion ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              if (info.offset.x < -64 || info.velocity.x < -400) goTo(index + 1);
              else if (info.offset.x > 64 || info.velocity.x > 400) goTo(index - 1);
            }}
            className="flex w-full flex-col items-center px-8 text-center"
          >
            <div
              className={`mb-7 flex h-20 w-20 items-center justify-center rounded-3xl border ${slide.ring}`}
            >
              <Icon className="h-9 w-9" />
            </div>
            <p className={`nt-caption font-bold uppercase tracking-[0.22em] ${slide.tone}`}>
              {slide.eyebrow}
            </p>
            <h1 className="nt-large-title mt-2 max-w-[15ch] text-foreground">{slide.title}</h1>
            <p className="nt-body mt-4 max-w-[34ch] text-muted-foreground">{slide.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots + CTA */}
      <div className="relative nt-gutter-x">
        <div className="flex items-center justify-center gap-2 pb-6">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              onClick={() => goTo(i)}
              className="ios-pressable p-1.5"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/35"
                }`}
              />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => (isLast ? complete() : goTo(index + 1))}
          className="ios-pressable flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary nt-callout font-bold uppercase tracking-wider text-white"
        >
          {isLast ? "Get started" : "Continue"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
