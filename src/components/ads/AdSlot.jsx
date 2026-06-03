import React, { useEffect, useState, useRef, lazy, Suspense } from "react";

/* ── Size presets with responsive fallback chain ── */
const SIZE_MAP = {
  leaderboard:        { w: 728, h: 90,  label: "728 × 90" },
  "medium-rectangle": { w: 300, h: 250, label: "300 × 250" },
  "wide-skyscraper":  { w: 160, h: 600, label: "160 × 600" },
  "mobile-banner":    { w: 320, h: 50,  label: "320 × 50" },
};

const RESPONSIVE_FALLBACKS = {
  leaderboard:        [{ minW: 728, key: "leaderboard" }, { minW: 300, key: "medium-rectangle" }, { minW: 0, key: "mobile-banner" }],
  "medium-rectangle": [{ minW: 300, key: "medium-rectangle" }, { minW: 0, key: "mobile-banner" }],
  "wide-skyscraper":  [{ minW: 160, key: "wide-skyscraper" }],
  "mobile-banner":    [{ minW: 0, key: "mobile-banner" }],
};

// Lazy load the runtime so it's not part of the initial app bundle
const AdSlotRuntime = lazy(() => import("./AdSlotRuntime"));

export default function AdSlot({ position, size, isAdmin = false, className = "" }) {
  const [effectiveSize, setEffectiveSize] = useState(size || "leaderboard");
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [adsLoadState, setAdsLoadState] = useState({ enabled: true, hasAd: true });
  const wrapperRef = useRef(null);

  /* ── Responsive size detection ── */
  useEffect(() => {
    if (!wrapperRef.current) return;

    const detectSize = () => {
      if (!wrapperRef.current) return;
      const containerWidth = wrapperRef.current.offsetWidth;
      const sizeKey = size || "leaderboard";
      const chain = RESPONSIVE_FALLBACKS[sizeKey] || RESPONSIVE_FALLBACKS.leaderboard;
      const match = chain.find((step) => containerWidth >= step.minW);
      if (match) {
        setEffectiveSize(match.key);
      }
    };

    detectSize();

    if (typeof window !== "undefined" && "ResizeObserver" in window) {
      const ro = new ResizeObserver(detectSize);
      ro.observe(wrapperRef.current);
      return () => ro.disconnect();
    }
  }, [size]);

  /* ── Intersection check to trigger lazy-loading of runtime ── */
  useEffect(() => {
    if (!wrapperRef.current) return;

    if (typeof window !== "undefined" && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsNearViewport(true);
            observer.disconnect();
          }
        },
        { rootMargin: "300px 0px" } // load 300px before it enters the viewport
      );
      observer.observe(wrapperRef.current);
      return () => observer.disconnect();
    } else {
      // Fallback if IntersectionObserver not supported
      setIsNearViewport(true);
    }
  }, []);

  const preset = SIZE_MAP[effectiveSize] || SIZE_MAP.leaderboard;

  // If ads are disabled globally or there are no ads for this slot, collapse the container
  // to avoid rendering empty whitespace (preserving layout styling)
  if (!adsLoadState.enabled || (!adsLoadState.hasAd && !isAdmin)) {
    return null;
  }

  return (
    <div
      ref={wrapperRef}
      className={`ad-slot-shell relative transition-all duration-300 ${className}`}
      style={{
        contain: "layout style",
        width: "100%",
        maxWidth: preset.w,
        aspectRatio: `${preset.w}/${preset.h}`,
        minHeight: preset.h,
        margin: "0 auto",
      }}
    >
      {isNearViewport ? (
        <Suspense
          fallback={
            <div
              className="absolute inset-0 bg-neutral-900/30 animate-pulse border border-border/20"
              style={{ width: "100%", height: "100%" }}
            />
          }
        >
          <AdSlotRuntime
            position={position}
            size={size}
            isAdmin={isAdmin}
            className={className}
            effectiveSize={effectiveSize}
            preset={preset}
            onAdsLoadState={setAdsLoadState}
          />
        </Suspense>
      ) : (
        /* Reserved space shimmer to avoid layout shift (CLS) */
        <div
          className="absolute inset-0 bg-neutral-900/10 border border-border/10"
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </div>
  );
}
