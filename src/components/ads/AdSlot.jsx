import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, AlertTriangle } from "lucide-react";

/* ── Size presets ── */
const SIZE_MAP = {
  leaderboard:        { w: 728, h: 90,  label: "728 × 90" },
  "medium-rectangle": { w: 300, h: 250, label: "300 × 250" },
  "wide-skyscraper":  { w: 160, h: 600, label: "160 × 600" },
  "mobile-banner":    { w: 320, h: 50,  label: "320 × 50" },
};

/* ── Safe localStorage helpers ── */
function getAdsEnabled() {
  try { return localStorage.getItem("rlt_ads_enabled") === "true"; } catch { return false; }
}

function getAdConfig() {
  try { return JSON.parse(localStorage.getItem("rlt_ad_config") || "[]"); } catch { return []; }
}

/* ── Date-range validation ── */
function isAdScheduleActive(ad) {
  if (!ad) return false;
  if (ad.is_active === false) return false;
  const now = new Date();
  const today = now.toISOString().split("T")[0]; // YYYY-MM-DD
  if (ad.start_date && today < ad.start_date) return false;
  if (ad.end_date && today > ad.end_date) return false;
  return true;
}

/* ── Stat tracking with batched writes ── */
const pendingStats = {};
let flushTimer = null;

function flushStats() {
  try {
    const existing = JSON.parse(localStorage.getItem("rlt_ad_stats") || "{}");
    for (const [key, delta] of Object.entries(pendingStats)) {
      if (!existing[key]) existing[key] = { impressions: 0, clicks: 0 };
      existing[key].impressions += delta.impressions || 0;
      existing[key].clicks += delta.clicks || 0;
    }
    localStorage.setItem("rlt_ad_stats", JSON.stringify(existing));
    Object.keys(pendingStats).forEach((k) => delete pendingStats[k]);
  } catch { /* noop */ }
}

function trackStat(position, adId, type) {
  const key = `${position}__${adId}`;
  if (!pendingStats[key]) pendingStats[key] = { impressions: 0, clicks: 0 };
  pendingStats[key][type] += 1;
  // Debounce writes to avoid hammering localStorage
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flushStats, 500);

  try {
    window.dispatchEvent(
      new CustomEvent(type === "impressions" ? "rlt_ad_impression" : "rlt_ad_click", {
        detail: { position, ad_id: adId },
      })
    );
  } catch { /* noop */ }
}

// Flush on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushStats);
}

/* ── URL validation ── */
function isValidUrl(url) {
  if (!url) return false;
  try { new URL(url); return true; } catch { return false; }
}

/* ── Component ── */
export default function AdSlot({ position, size, isAdmin = false, className = "" }) {
  const [ad, setAd] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const tracked = useRef(false);
  const containerRef = useRef(null);

  /* Resolve ad on mount & listen for config changes (cross-tab AND same-tab) */
  const resolve = useCallback(() => {
    setEnabled(getAdsEnabled());
    const config = getAdConfig();
    // Find best match: active + in date range
    const match = config.find(
      (a) => a.position === position && isAdScheduleActive(a)
    );
    setAd(match || null);
    setImgError(false);
    setImgLoaded(false);
    tracked.current = false;
  }, [position]);

  useEffect(() => {
    resolve();

    // Cross-tab changes
    const onStorage = (e) => {
      if (e.key === "rlt_ads_enabled" || e.key === "rlt_ad_config") resolve();
    };
    window.addEventListener("storage", onStorage);

    // Same-tab changes (admin saves while on same page)
    const onConfigUpdate = () => resolve();
    window.addEventListener("rlt_ad_config_updated", onConfigUpdate);

    // Re-check schedule every 60s for date-based ads
    const interval = setInterval(resolve, 60000);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("rlt_ad_config_updated", onConfigUpdate);
      clearInterval(interval);
    };
  }, [resolve]);

  /* Viewability tracking: Only count impression when >50% visible for 1s */
  useEffect(() => {
    if (!ad || !enabled || tracked.current || !containerRef.current) return;

    let viewTimer = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          viewTimer = setTimeout(() => {
            if (!tracked.current) {
              tracked.current = true;
              trackStat(position, ad.id, "impressions");
            }
          }, 1000);
        } else {
          clearTimeout(viewTimer);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      clearTimeout(viewTimer);
    };
  }, [ad, enabled, position]);

  /* ── Disabled globally ── */
  if (!enabled) return null;

  const preset = SIZE_MAP[size] || SIZE_MAP[ad?.size] || null;

  /* ── No ad configured for this slot ── */
  if (!ad) {
    if (!isAdmin) return null;
    return (
      <div
        className={`relative flex items-center justify-center border border-dashed border-primary/20 bg-primary/[0.03] ${className}`}
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

  /* ── Broken image fallback ── */
  if (imgError) {
    if (!isAdmin) return null;
    return (
      <div
        className={`relative flex items-center justify-center border border-red-500/20 bg-red-500/[0.03] ${className}`}
        style={{
          maxWidth: preset ? preset.w : "100%",
          aspectRatio: preset ? `${preset.w}/${preset.h}` : "auto",
          minHeight: preset ? undefined : 90,
          width: "100%",
        }}
      >
        <div className="flex flex-col items-center gap-1 opacity-60">
          <AlertTriangle className="h-5 w-5 text-red-400/60" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-red-400/70 font-mono">
            Image Failed
          </span>
          <span className="text-[8px] text-muted-foreground/40 font-mono truncate max-w-[200px]">
            {ad.title || "Untitled ad"}
          </span>
        </div>
      </div>
    );
  }

  /* ── Click handler ── */
  const handleClick = (e) => {
    trackStat(position, ad.id, "clicks");
    if (!ad.target_url || !isValidUrl(ad.target_url)) {
      e.preventDefault();
    }
  };

  /* ── Active ad ── */
  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        key={ad.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`group/ad relative overflow-hidden border border-border/40 cmd-glass ${className}`}
        style={{ maxWidth: preset ? preset.w : "100%", width: "100%" }}
        role="complementary"
        aria-label={`Sponsored: ${ad.title || "Advertisement"}`}
      >
        {/* Shimmer overlay on hover */}
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

        {/* Loading skeleton */}
        {!imgLoaded && (
          <div
            className="absolute inset-0 bg-muted/20 animate-pulse"
            style={{ aspectRatio: preset ? `${preset.w}/${preset.h}` : undefined }}
          />
        )}

        {/* Ad creative */}
        <a
          href={ad.target_url && isValidUrl(ad.target_url) ? ad.target_url : "#"}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={handleClick}
          className="block"
          aria-label={`Visit ${ad.title || "sponsor"}`}
        >
          <img
            src={ad.image_url}
            alt={ad.title || "Advertisement"}
            className={`block w-full object-cover transition-all duration-500 group-hover/ad:scale-[1.02] ${
              imgLoaded ? "opacity-100" : "opacity-0"
            }`}
            style={{ aspectRatio: preset ? `${preset.w}/${preset.h}` : undefined }}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        </a>

        {/* Glassmorphic bottom border glow */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </motion.div>
    </AnimatePresence>
  );
}
