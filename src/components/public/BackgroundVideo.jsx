import React, { useEffect, useMemo, useRef, useState } from "react";

const extOf = (url) => String(url).split("?")[0].split(".").pop()?.toLowerCase();
const mimeFor = (url) => ({ mp4: "video/mp4", webm: "video/webm", ogg: "video/ogg", mov: "video/quicktime" }[extOf(url)] || "");

// Order sources so browser-friendly formats win. QuickTime (.mov) does NOT play
// in Chrome/Edge/Firefox, so it must never be the first/only source — otherwise
// autoplay silently fails and only the poster shows. mp4 first, mov last.
const FORMAT_RANK = { mp4: 0, webm: 1, ogg: 2, mov: 9 };

const normalizeVideoSources = (sources, src) => {
  const rawList = sources?.length ? sources : [src];
  return rawList
    .flatMap((value) => String(value || "").split(/[\n,]+/))
    .flatMap((value) => value.split(/(?=https?:\/\/)/g))
    .map((value) => value.trim())
    .filter(Boolean);
};

// A high-quality static image of Allegiant Stadium to serve as the background poster
const DEFAULT_POSTER = "https://media.base44.com/images/public/6a18d49a2b8f40f0f81cc26e/4d882498b_57895bb2-6bf0-4062-bbf3-78c2b309651a.jpeg";

export default function BackgroundVideo({ src, sources, poster = DEFAULT_POSTER }) {
  const videoRef = useRef(null);
  const [shouldPlayVideo, setShouldPlayVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const ordered = useMemo(() => {
    const list = normalizeVideoSources(sources, src);
    return [...list].sort((a, b) => (FORMAT_RANK[extOf(a)] ?? 5) - (FORMAT_RANK[extOf(b)] ?? 5));
  }, [sources, src]);
  const key = ordered.join("|");
  const activeVideo = ordered[currentIndex % Math.max(ordered.length, 1)] || "";

  useEffect(() => {
    setCurrentIndex(0);
  }, [key]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShouldPlayVideo(true);
  }, [key]);

  useEffect(() => {
    if (!shouldPlayVideo) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    let cancelled = false;
    setVideoReady(false);
    video.muted = true;
    video.playsInline = true;

    const advanceVideo = () => {
      if (ordered.length > 1) setCurrentIndex((index) => (index + 1) % ordered.length);
    };

    const playVideo = () => {
      video.muted = true;
      video.play().then(() => {
        if (!cancelled) setVideoReady(true);
      }).catch(() => {
        if (!cancelled) advanceVideo();
      });
    };

    video.load();
    playVideo();

    const watchdog = window.setTimeout(() => {
      if (!cancelled && (!videoReady || video.paused || video.readyState < 2)) {
        playVideo();
        window.setTimeout(() => {
          if (!cancelled && (video.paused || video.readyState < 2)) advanceVideo();
        }, 1200);
      }
    }, 3000);

    window.addEventListener("touchstart", playVideo, { once: true });
    window.addEventListener("click", playVideo, { once: true });

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      window.removeEventListener("touchstart", playVideo);
      window.removeEventListener("click", playVideo);
    };
  }, [shouldPlayVideo, activeVideo, ordered.length]);

  useEffect(() => {
    if (!shouldPlayVideo || ordered.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % ordered.length);
    }, 20000);
    return () => window.clearInterval(timer);
  }, [shouldPlayVideo, ordered.length, key]);

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
          key={activeVideo}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            videoReady ? "opacity-70" : "opacity-0"
          }`}
          autoPlay
          muted
          loop={ordered.length < 2}
          playsInline
          preload="metadata"
          controls={false}
          disablePictureInPicture
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => videoRef.current?.play().then(() => setVideoReady(true)).catch(() => {})}
          onPlaying={() => setVideoReady(true)}
          onEnded={() => ordered.length > 1 && setCurrentIndex((index) => (index + 1) % ordered.length)}
          onError={() => ordered.length > 1 && setCurrentIndex((index) => (index + 1) % ordered.length)}
          onStalled={() => ordered.length > 1 && setCurrentIndex((index) => (index + 1) % ordered.length)}
        >
          <source src={activeVideo} type={mimeFor(activeVideo) || undefined} />
        </video>
      )}

      {/* Dark Vegas neon-supporting vignette overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/15 via-background/25 to-background/85" />
    </div>
  );
}