import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone } from "lucide-react";

/* ── size presets ── */
const SIZE_MAP = {
  leaderboard:       { w: 728, h: 90,  label: "728 × 90" },
  "medium-rectangle": { w: 300, h: 250, label: "300 × 250" },
  "wide-skyscraper":  { w: 160, h: 600, label: "160 × 600" },
  "mobile-banner":    { w: 320, h: 50,  label: "320 × 50" },
};

/* ── helpers ── */
function getAdsEnabled() {
  try { return localStorage.getItem("rlt_ads_enabled") === "true"; } catch { return false; }
}

function getAdConfig() {
  try { return JSON.parse(localStorage.getItem("rlt_ad_config") || "[]"); } catch { return []; }
}

function trackStat(position, adId, type) {
  try {
    const stats = JSON.parse(localStorage.getItem("rlt_ad_stats") || "{}");
    const key = `${position}__${adId}`;
    if (!stats[key]) stats[key] = { impressions: 0, clicks: 0 };
    stats[key][type] += 1;
    localStorage.setItem("rlt_ad_stats", JSON.stringify(stats));
  } catch { /* noop */ }
}

export default function AdSlot({ position, size, isAdmin = false }) {
  const [ad, setAd] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const tracked = useRef(false);

  /* Resolve ad on mount & listen for config changes */
  useEffect(() => {
    const resolve = () => {
      setEnabled(getAdsEnabled());
      const config = getAdConfig();
      const match = config.find(
        (a) => a.position === position && a.is_active !== false
      );
      setAd(match || null);
    };
    resolve();

    const onStorage = (e) => {
      if (e.key === "rlt_ads_enabled" || e.key === "rlt_ad_config") resolve();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [position]);

  /* Fire impression once */
  useEffect(() => {
    if (!ad || tracked.current) return;
    tracked.current = true;
    trackStat(position, ad.id, "impressions");
    window.dispatchEvent(
      new CustomEvent("rlt_ad_impression", { detail: { position, ad_id: ad.id } })
    );
  }, [ad, position]);

  /* ── Nothing to render ── */
  if (!enabled) return null;

  const preset = SIZE_MAP[size] || SIZE_MAP[ad?.size] || null;

  /* No ad configured */
  if (!ad) {
    if (!isAdmin) return null;
    return (
      <div
        className="relative flex items-center justify-center border border-dashed border-primary/20 bg-primary/[0.03]"
        style={{
          maxWidth: preset ? preset.w : "100%",
          aspectRatio: preset ? `${preset.w}/${preset.h}` : "auto",
          minHeight: preset ? undefined : 90,
          width: "100%",
        }}
      >
        <div className="flex flex-col items-center gap-1 opacity-50">
          <Megaphone className="h-5 w-5 text-primary/40" />
          <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-primary/50 font-mono">
            Ad Space Available
          </span>
          <span className="text-[8px] text-muted-foreground/40 font-mono">
            {position} {preset ? `· ${preset.label}` : ""}
          </span>
        </div>
      </div>
    );
  }

  /* ── Active ad ── */
  const handleClick = () => {
    trackStat(position, ad.id, "clicks");
    window.dispatchEvent(
      new CustomEvent("rlt_ad_click", { detail: { position, ad_id: ad.id } })
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        key={ad.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="group/ad relative overflow-hidden border border-border/40 cmd-glass"
        style={{
          maxWidth: preset ? preset.w : "100%",
          width: "100%",
        }}
      >
        {/* Shimmer overlay */}
        <div className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-500 group-hover/ad:opacity-100">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 55%, transparent 60%)",
              backgroundSize: "250% 100%",
              animation: "ad-shimmer 2.4s ease-in-out infinite",
            }}
          />
        </div>

        {/* "Sponsored" label */}
        <span className="absolute top-0 right-0 z-20 bg-black/50 px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.2em] text-white/70 font-mono backdrop-blur-sm">
          Sponsored
        </span>

        {/* Ad creative */}
        <a
          href={ad.target_url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="block"
        >
          <img
            src={ad.image_url}
            alt={ad.title || "Advertisement"}
            className="block w-full object-cover transition-transform duration-500 group-hover/ad:scale-[1.02]"
            style={{
              aspectRatio: preset ? `${preset.w}/${preset.h}` : undefined,
            }}
          />
        </a>

        {/* Glassmorphic bottom border glow */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </motion.div>
    </AnimatePresence>
  );
}
