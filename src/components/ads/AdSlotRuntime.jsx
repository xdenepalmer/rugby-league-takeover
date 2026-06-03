import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, AlertTriangle, X, ChevronRight, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";

/* ── Size presets ── */
const SIZE_MAP = {
  leaderboard:        { w: 728, h: 90,  label: "728 × 90" },
  "medium-rectangle": { w: 300, h: 250, label: "300 × 250" },
  "wide-skyscraper":  { w: 160, h: 600, label: "160 × 600" },
  "mobile-banner":    { w: 320, h: 50,  label: "320 × 50" },
};

/* ── Session ID (per browser session, survives SPA navigations) ── */
let _sessionId = null;
function getSessionId() {
  if (_sessionId) return _sessionId;
  try {
    _sessionId = sessionStorage.getItem("rlt_ad_session_id");
    if (!_sessionId) {
      _sessionId = crypto.randomUUID();
      sessionStorage.setItem("rlt_ad_session_id", _sessionId);
    }
  } catch {
    _sessionId = crypto.randomUUID();
  }
  return _sessionId;
}

/* ── Date-range validation ── */
function isAdScheduleActive(ad) {
  if (!ad) return false;
  if (ad.is_active === false || ad.is_active === "false") return false;
  const now = new Date();
  const today = now.toISOString().split("T")[0]; // YYYY-MM-DD
  if (ad.start_date && today < ad.start_date) return false;
  if (ad.end_date && today > ad.end_date) return false;
  return true;
}

/* ── Device targeting ── */
function matchesDevice(ad) {
  const target = ad?.device_target || "all";
  if (target === "all") return true;
  if (typeof window === "undefined" || !window.matchMedia) return true;
  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  return target === (isMobile ? "mobile" : "desktop");
}

/* ── Frequency capping (session-scoped) ── */
const FREQUENCY_CAP = 10;

function getSessionImpressions() {
  try {
    const raw = sessionStorage.getItem("rlt_ad_freq");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch { return {}; }
}

function recordSessionImpression(adId) {
  try {
    const freq = getSessionImpressions();
    freq[adId] = (freq[adId] || 0) + 1;
    sessionStorage.setItem("rlt_ad_freq", JSON.stringify(freq));
    return freq[adId];
  } catch { return 0; }
}

/* ── Click fraud prevention ── */
const CLICK_CAP_PER_HOUR = 3;

function getClickLog() {
  try {
    const raw = sessionStorage.getItem("rlt_ad_clicks");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch { return {}; }
}

function canCountClick(adId) {
  try {
    const log = getClickLog();
    const now = Date.now();
    const hourAgo = now - 3600000;
    const recent = (log[adId] || []).filter((t) => t > hourAgo);
    return recent.length < CLICK_CAP_PER_HOUR;
  } catch { return true; }
}

function recordClick(adId) {
  try {
    const log = getClickLog();
    const now = Date.now();
    const hourAgo = now - 3600000;
    const recent = (log[adId] || []).filter((t) => t > hourAgo);
    recent.push(now);
    log[adId] = recent;
    sessionStorage.setItem("rlt_ad_clicks", JSON.stringify(log));
  } catch { /* noop */ }
}

/* ── Stat tracking ── */
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
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flushStats, 500);

  if (appParams.hasBase44Config) {
    try {
      base44.functions.invoke("recordAdEvent", { adId, type }).catch(() => {});
    } catch { /* noop */ }
  }

  try {
    window.dispatchEvent(
      new CustomEvent(type === "impressions" ? "rlt_ad_impression" : "rlt_ad_click", {
        detail: { position, ad_id: adId, session_id: getSessionId() },
      })
    );
  } catch { /* noop */ }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushStats);
}

function isValidUrl(url) {
  if (!url) return false;
  try { new URL(url); return true; } catch { return false; }
}

/* ── Weighted ad selection ── */
function selectAdWeighted(candidates) {
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const freq = getSessionImpressions();
  const counts = candidates.map((ad) => freq[ad.id] || 0);
  const maxCount = Math.max(...counts, 1);

  const weights = counts.map((c) => Math.max(1, maxCount + 1 - c));
  const adjusted = weights.map((w, i) =>
    counts[i] >= FREQUENCY_CAP ? 0.01 : w
  );

  const totalWeight = adjusted.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < candidates.length; i++) {
    random -= adjusted[i];
    if (random <= 0) return candidates[i];
  }

  return candidates[candidates.length - 1];
}

function getMinimized(position) {
  try { return sessionStorage.getItem(`rlt_ad_min_${position}`) === "1"; } catch { return false; }
}
function setMinimized(position, val) {
  try { sessionStorage.setItem(`rlt_ad_min_${position}`, val ? "1" : "0"); } catch { /* noop */ }
}

const ROTATION_INTERVAL = 12000;

export default function AdSlotRuntime({ position, size, isAdmin, className, effectiveSize, preset, onAdsLoadState }) {
  const [ads, setAds] = useState([]);
  const [currentAd, setCurrentAd] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgRetried, setImgRetried] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);
  const [minimized, setMinimizedState] = useState(() => getMinimized(position));
  const [isHovered, setIsHovered] = useState(false);
  const [viewable, setViewable] = useState(false);
  const tracked = useRef(false);
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const rotationTimer = useRef(null);
  const mountedRef = useRef(true);
  const viewabilityTimerRef = useRef(null);

  /* ── Fetch all ads ── */
  const { data: allAds = [] } = useQuery({
    queryKey: ["siteAds"],
    queryFn: () => base44.entities.SiteAd.list("-created_date", 200),
    staleTime: 30000,
    refetchInterval: 60000,
    retry: 1,
    enabled: appParams.hasBase44Config,
    meta: { silent: true },
  });

  /* ── Fetch SiteSettings for global ads_enabled flag ── */
  const { data: settingsRecords = [] } = useQuery({
    queryKey: ["siteSettings"],
    queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1),
    staleTime: 30000,
    retry: 1,
    enabled: appParams.hasBase44Config,
    meta: { silent: true },
  });
  const globalEnabled = settingsRecords[0]?.ads_enabled !== false && settingsRecords[0]?.ads_enabled !== "false";

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* ── Sync status with parent for visibility toggling ── */
  useEffect(() => {
    setEnabled(globalEnabled);
    if (onAdsLoadState) {
      onAdsLoadState({
        enabled: globalEnabled,
        hasAd: ads.length > 0 || isAdmin
      });
    }
  }, [globalEnabled, ads, isAdmin, onAdsLoadState]);

  /* ── Filter candidates for this slot ── */
  const resolve = useCallback(() => {
    if (!mountedRef.current) return;
    const candidates = allAds.filter(
      (a) => a.position === position && isAdScheduleActive(a) && matchesDevice(a)
    );
    setAds(candidates);

    setCurrentAd((prev) => {
      const prevStillValid = prev && candidates.some((c) => c.id === prev.id);
      if (prevStillValid) return prev;
      const picked = selectAdWeighted(candidates);
      if (picked?.id !== prev?.id) {
        setImgError(false);
        setImgRetried(false);
        setImgLoaded(false);
        setImgSrc(null);
        setViewable(false);
        tracked.current = false;
      }
      return picked || null;
    });
  }, [position, allAds]);

  useEffect(() => {
    resolve();
  }, [resolve]);

  /* ── Ad Rotation ── */
  useEffect(() => {
    clearTimeout(rotationTimer.current);
    if (ads.length <= 1 || !enabled) return;

    rotationTimer.current = setTimeout(() => {
      if (!mountedRef.current) return;
      const next = selectAdWeighted(ads);
      if (next && next.id !== currentAd?.id) {
        setCurrentAd(next);
        setImgError(false);
        setImgRetried(false);
        setImgLoaded(false);
        setImgSrc(null);
        setViewable(false);
        tracked.current = false;
      }
    }, ROTATION_INTERVAL);

    return () => clearTimeout(rotationTimer.current);
  }, [ads, currentAd, enabled]);

  /* ── Set image source (shell already intersected, so we load immediately) ── */
  useEffect(() => {
    if (currentAd?.image_url) {
      setImgSrc(currentAd.image_url);
    }
  }, [currentAd?.image_url]);

  /* ── Impression Tracking ── */
  useEffect(() => {
    if (!currentAd || !enabled || tracked.current || !containerRef.current) return;

    let viewTimer = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          viewTimer = setTimeout(() => {
            if (!tracked.current && mountedRef.current) {
              tracked.current = true;
              recordSessionImpression(currentAd.id);
              trackStat(position, currentAd.id, "impressions");
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
  }, [currentAd, enabled, position]);

  /* ── Viewability badge (Admin only) ── */
  useEffect(() => {
    if (!isAdmin || !currentAd || !containerRef.current) return;
    clearTimeout(viewabilityTimerRef.current);
    setViewable(false);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          viewabilityTimerRef.current = setTimeout(() => {
            if (mountedRef.current) setViewable(true);
          }, 2000);
        } else {
          clearTimeout(viewabilityTimerRef.current);
          if (mountedRef.current) setViewable(false);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      clearTimeout(viewabilityTimerRef.current);
    };
  }, [isAdmin, currentAd]);

  const handleMinimize = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setMinimizedState(true);
    setMinimized(position, true);
  }, [position]);

  const handleRestore = useCallback(() => {
    setMinimizedState(false);
    setMinimized(position, false);
  }, [position]);

  const handleImgError = useCallback(() => {
    if (!mountedRef.current) return;
    if (!imgRetried && currentAd?.image_url) {
      setImgRetried(true);
      setImgSrc(currentAd.image_url + (currentAd.image_url.includes("?") ? "&" : "?") + "_retry=1");
    } else {
      setImgError(true);
    }
  }, [imgRetried, currentAd?.image_url]);

  if (!enabled) return null;

  /* ── No Ad configured (Admin view) ── */
  if (!currentAd) {
    if (!isAdmin) return null;
    return (
      <div
        ref={wrapperRef}
        className={`relative flex items-center justify-center border border-dashed border-primary/20 bg-primary/[0.03] ${className}`}
        style={{
          contain: "layout style",
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

  /* ── Image loading error fallback ── */
  if (imgError) {
    return (
      <div
        ref={wrapperRef}
        className={`relative overflow-hidden border border-border/30 cmd-glass ${className}`}
        style={{
          contain: "layout style",
          maxWidth: preset ? preset.w : "100%",
          aspectRatio: preset ? `${preset.w}/${preset.h}` : "auto",
          minHeight: preset ? undefined : 90,
          width: "100%",
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-2 opacity-50">
            <AlertTriangle className="h-4 w-4 text-amber-400/60" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 font-mono">
              Ad Unavailable
            </span>
          </div>
          {currentAd.title && (
            <span className="text-[8px] text-muted-foreground/30 font-mono truncate max-w-[200px]">
              {currentAd.title}
            </span>
          )}
          {currentAd.target_url && isValidUrl(currentAd.target_url) && (
            <a
              href={currentAd.target_url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={(e) => {
                if (canCountClick(currentAd.id)) {
                  recordClick(currentAd.id);
                  trackStat(position, currentAd.id, "clicks");
                }
              }}
              className="mt-1 text-[8px] font-mono text-primary/50 hover:text-primary/80 underline underline-offset-2 transition-colors"
            >
              Visit sponsor →
            </a>
          )}
        </div>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, currentColor 2px, currentColor 3px)",
          }}
        />
      </div>
    );
  }

  const handleClick = (e) => {
    if (canCountClick(currentAd.id)) {
      recordClick(currentAd.id);
      trackStat(position, currentAd.id, "clicks");
    }
    if (!currentAd.target_url || !isValidUrl(currentAd.target_url)) {
      e.preventDefault();
    }
  };

  const hasMultiple = ads.length > 1;

  if (minimized) {
    return (
      <div
        ref={wrapperRef}
        className={`relative ${className}`}
        style={{ contain: "layout style", maxWidth: preset ? preset.w : "100%", width: "100%" }}
      >
        <motion.button
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          onClick={handleRestore}
          className="flex w-full items-center justify-center gap-2 py-1 border border-border/30 bg-card/30 backdrop-blur-sm hover:bg-card/50 transition-colors cursor-pointer group"
          aria-label="Show advertisement"
        >
          <ChevronRight className="h-3 w-3 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground/40 font-mono group-hover:text-muted-foreground/60 transition-colors">
            Show Ad
          </span>
        </motion.button>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative ${className}`}
      style={{
        contain: "layout style",
        width: "100%",
        margin: "0 auto",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          ref={containerRef}
          key={currentAd.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="group/ad relative overflow-hidden border border-border/40 cmd-glass"
          style={{
            width: "100%",
            transition: "box-shadow 0.4s ease, border-color 0.4s ease",
            boxShadow: isHovered ? "0 0 20px -4px hsl(var(--primary) / 0.15)" : "none",
            borderColor: isHovered ? "hsl(var(--primary) / 0.3)" : undefined,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          role="complementary"
          aria-label={`Sponsored: ${currentAd.title || "Advertisement"}`}
        >
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

          <span
            className="absolute top-0 right-0 z-20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] font-mono pointer-events-none"
            style={{
              background: "hsl(var(--background) / 0.7)",
              color: "hsl(var(--muted-foreground) / 0.6)",
              borderLeft: "1px solid hsl(var(--border) / 0.3)",
              borderBottom: "1px solid hsl(var(--border) / 0.3)",
            }}
          >
            Sponsored
          </span>

          <button
            onClick={handleMinimize}
            className="absolute top-1 left-1 z-30 flex h-7 w-7 items-center justify-center bg-black/50 backdrop-blur-sm hover:bg-black/70 active:bg-black/80 transition-colors cursor-pointer opacity-60 hover:opacity-100 sm:opacity-0 sm:group-hover/ad:opacity-80"
            aria-label="Minimize advertisement"
            title="Minimize ad"
          >
            <X className="h-3 w-3 text-white/80" />
          </button>

          {hasMultiple && (
            <div className="absolute top-0 left-7 z-20 flex gap-[3px] px-2 py-1.5">
              {ads.map((a) => (
                <span
                  key={a.id}
                  className="block h-[3px] w-3 transition-colors duration-300"
                  style={{
                    background: a.id === currentAd.id
                      ? "hsl(var(--primary))"
                      : "hsl(var(--foreground) / 0.15)",
                  }}
                />
              ))}
            </div>
          )}

          {isAdmin && (
            <AnimatePresence>
              {viewable && (
                <motion.span
                   initial={{ opacity: 0, scale: 0.8, x: 8 }}
                   animate={{ opacity: 1, scale: 1, x: 0 }}
                   exit={{ opacity: 0, scale: 0.8, x: 8 }}
                   transition={{ duration: 0.3, ease: "easeOut" }}
                   className="absolute bottom-1.5 right-1.5 z-20 flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-sm"
                >
                  <Eye className="h-2.5 w-2.5 text-emerald-400" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 font-mono">
                    100% Viewable
                  </span>
                </motion.span>
              )}
            </AnimatePresence>
          )}

          {!imgLoaded && (
            <div
              className="absolute inset-0"
              style={{
                height: preset ? preset.h : 90,
                background: "linear-gradient(90deg, hsl(var(--muted) / 0.08) 25%, hsl(var(--muted) / 0.18) 50%, hsl(var(--muted) / 0.08) 75%)",
                backgroundSize: "400% 100%",
                animation: "ad-shimmer-placeholder 1.8s ease-in-out infinite",
              }}
            />
          )}

          <a
            href={currentAd.target_url && isValidUrl(currentAd.target_url) ? currentAd.target_url : "#"}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={handleClick}
            className="block"
            aria-label={`Visit ${currentAd.title || "sponsor"}`}
          >
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={currentAd.title || "Advertisement"}
                className="block mx-auto object-contain"
                style={{
                  maxWidth: "100%",
                  maxHeight: position?.startsWith("banner") ? 120 : 250,
                  width: "auto",
                  height: "auto",
                  opacity: imgLoaded ? 1 : 0,
                  transform: isHovered ? "scale(1.01)" : "scale(1)",
                  transition: "opacity 0.5s ease, transform 0.4s ease",
                }}
                decoding="async"
                onLoad={() => { if (mountedRef.current) setImgLoaded(true); }}
                onError={handleImgError}
              />
            ) : (
              <div
                className="w-full"
                style={{
                  height: preset ? preset.h : 90,
                  background: "hsl(var(--muted) / 0.1)",
                }}
              />
            )}
          </a>

          <div
            className="absolute bottom-0 left-0 right-0 h-[1px]"
            style={{
              background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.3), transparent)",
            }}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
