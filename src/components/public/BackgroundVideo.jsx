import React, { useEffect, useMemo, useRef, useState } from "react";

const extOf = (url) => String(url).split("?")[0].split(".").pop()?.toLowerCase();
const mimeFor = (url) => ({ mp4: "video/mp4", webm: "video/webm", ogg: "video/ogg", mov: "video/quicktime" }[extOf(url)] || "");

// A high-quality static image of Allegiant Stadium to serve as the background poster
const DEFAULT_POSTER = "https://media.base44.com/images/public/6a18d49a2b8f40f0f81cc26e/4d882498b_57895bb2-6bf0-4062-bbf3-78c2b309651a.jpeg";

export default function BackgroundVideo({ src, sources, poster = DEFAULT_POSTER }) {
  const videoRef = useRef(null);
  const [shouldPlayVideo, setShouldPlayVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const ordered = useMemo(() => (sources?.length ? sources : [src]).filter(Boolean), [sources, src]);
  const key = ordered.join("|");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // ── Gating Checks for Mobile / Save Data / Reduced Motion ──
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const isSaveData = !!(navigator.connection && navigator.connection.saveData);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // If on mobile, save-data, or prefers-reduced-motion, do NOT load/play background video
    if (isMobile || isSaveData || prefersReducedMotion) {
      setShouldPlayVideo(false);
      return;
    }

    setShouldPlayVideo(true);
  }, [key]);

  useEffect(() => {
    if (!shouldPlayVideo) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    video.muted = true;
    const playVideo = () => video.play().then(() => setVideoReady(true)).catch(() => {});

    video.load();
    playVideo();

    window.addEventListener("touchstart", playVideo, { once: true });
    window.addEventListener("click", playVideo, { once: true });

    return () => {
      window.removeEventListener("touchstart", playVideo);
      window.removeEventListener("click", playVideo);
    };
  }, [shouldPlayVideo, key]);

  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-background">
      {/* Fallback Static Poster Image (always rendered under video, or as main background) */}
      <img
        src={poster}
        alt=""
        decoding="async"
        fetchPriority="high"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
          videoReady ? "opacity-20" : "opacity-60"
        }`}
      />

      {/* Background Video — only loaded and rendered when conditions are met */}
      {shouldPlayVideo && (
        <video
          ref={videoRef}
          key={key}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            videoReady ? "opacity-70" : "opacity-0"
          }`}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          controls={false}
          disablePictureInPicture
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => videoRef.current?.play().then(() => setVideoReady(true)).catch(() => {})}
          onPlaying={() => setVideoReady(true)}
        >
          {ordered.map((url) => (
            <source key={url} src={url} type={mimeFor(url) || undefined} />
          ))}
        </video>
      )}

      {/* Dark Vegas neon-supporting vignette overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/15 via-background/25 to-background/85" />
    </div>
  );
}