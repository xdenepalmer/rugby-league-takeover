import React, { useEffect, useMemo, useRef, useState } from "react";

const extOf = (url) => String(url).split("?")[0].split(".").pop()?.toLowerCase();
const mimeFor = (url) => ({ mp4: "video/mp4", webm: "video/webm", ogg: "video/ogg", mov: "video/quicktime" }[extOf(url)] || "");

// Browser-safe fallback. Keep an MP4 available even if settings are edited to
// only contain a .mov, because Chrome/Edge/Firefox cannot autoplay QuickTime.
const FALLBACK_MP4 = "https://media.base44.com/videos/public/6a18d49a2b8f40f0f81cc26e/bf55ac1e7_AllegiantStadiumParadiseNevadaclaytonhaamallegiantallegiantstadiumparadis.mp4";
const FORMAT_RANK = { mp4: 0, webm: 1, ogg: 2, mov: 9 };

// A high-quality static image of Allegiant Stadium to serve as the background poster
const DEFAULT_POSTER = "https://media.base44.com/images/public/6a18d49a2b8f40f0f81cc26e/4d882498b_57895bb2-6bf0-4062-bbf3-78c2b309651a.jpeg";

const isPlayableSource = (url) => {
  if (typeof document === "undefined") return true;
  const mime = mimeFor(url);
  if (!mime) return false;
  const probe = document.createElement("video");
  return Boolean(probe.canPlayType(mime));
};

export default function BackgroundVideo({ src, sources, poster = DEFAULT_POSTER }) {
  const videoRef = useRef(null);
  const [shouldPlayVideo, setShouldPlayVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const ordered = useMemo(() => {
    const list = [...(sources?.length ? sources : [src]), FALLBACK_MP4].filter(Boolean);
    const playable = [...new Set(list)].filter(isPlayableSource);
    return playable.sort((a, b) => (FORMAT_RANK[extOf(a)] ?? 5) - (FORMAT_RANK[extOf(b)] ?? 5));
  }, [sources, src]);
  const key = ordered.join("|");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setVideoReady(false);
    setShouldPlayVideo(ordered.length > 0);
  }, [key, ordered.length]);

  useEffect(() => {
    if (!shouldPlayVideo) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    let cancelled = false;
    let retryCount = 0;
    let retryTimer;

    const playVideo = () => {
      if (cancelled || !video) return;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.play()
        .then(() => {
          if (!cancelled) setVideoReady(true);
        })
        .catch(() => {
          if (!cancelled && retryCount < 8) {
            retryCount += 1;
            retryTimer = window.setTimeout(playVideo, 450);
          }
        });
    };

    video.load();
    playVideo();

    window.addEventListener("pageshow", playVideo);
    window.addEventListener("focus", playVideo);
    document.addEventListener("visibilitychange", playVideo);
    window.addEventListener("touchstart", playVideo, { once: true, passive: true });
    window.addEventListener("pointerdown", playVideo, { once: true, passive: true });
    window.addEventListener("click", playVideo, { once: true });

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.removeEventListener("pageshow", playVideo);
      window.removeEventListener("focus", playVideo);
      document.removeEventListener("visibilitychange", playVideo);
      window.removeEventListener("touchstart", playVideo);
      window.removeEventListener("pointerdown", playVideo);
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
          preload="auto"
          controls={false}
          disablePictureInPicture
          onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
          onCanPlay={() => videoRef.current?.play().catch(() => {})}
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