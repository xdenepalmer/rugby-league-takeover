import React, { useEffect, useMemo, useRef, useState } from "react";

const extOf = (url) => String(url).split("?")[0].split(".").pop()?.toLowerCase();
const mimeFor = (url) => ({ mp4: "video/mp4", webm: "video/webm", ogg: "video/ogg", mov: "video/quicktime" }[extOf(url)] || "");

// Order sources so browser-friendly formats win. QuickTime (.mov) does NOT play
// in Chrome/Edge/Firefox, so it must never be the first/only source — otherwise
// autoplay silently fails and only the poster shows. mp4 first, mov last.
const FORMAT_RANK = { mp4: 0, webm: 1, ogg: 2, mov: 9 };
const IOS_FORMAT_RANK = { mov: 0, mp4: 1, webm: 2, ogg: 3 };

const prefersQuickTimeVideo = () => {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

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
    const isIos = prefersQuickTimeVideo();
    const browserFriendly = list.filter((url) => ["mp4", "webm", "ogg"].includes(extOf(url)));
    const playableList = isIos ? list : (browserFriendly.length ? browserFriendly : list);
    const rank = isIos ? IOS_FORMAT_RANK : FORMAT_RANK;
    return [...playableList].sort((a, b) => (rank[extOf(a)] ?? 5) - (rank[extOf(b)] ?? 5));
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
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    const advanceVideo = () => {
      if (ordered.length > 1) setCurrentIndex((index) => (index + 1) % ordered.length);
    };

    const playVideo = () => {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.play().then(() => {
        if (!cancelled) setVideoReady(true);
      }).catch(() => {
        // Autoplay can reject briefly on mobile while the video is still loading.
        // Do not switch sources here — the real media error handler handles bad files.
      });
    };

    video.load();
    window.setTimeout(playVideo, 80);

    const watchdog = window.setTimeout(() => {
      if (!cancelled && (video.paused || video.readyState < 2)) {
        playVideo();
        window.setTimeout(() => {
          if (!cancelled && video.paused) playVideo();
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

  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-background">
      {/* Fallback Static Poster Image (always rendered under video, or as main background) */}
      <img
        src={poster}
        alt=""
        decoding="async"
        fetchPriority="high"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          videoReady ? "opacity-0" : "opacity-60"
        }`}
      />

      {/* Background Video — only loaded and rendered when conditions are met */}
      {shouldPlayVideo && (
        <video
          ref={videoRef}
          key={activeVideo}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            videoReady ? "opacity-100" : "opacity-0"
          }`}
          autoPlay
          muted
          defaultMuted
          loop
          playsInline
          webkit-playsinline="true"
          preload="auto"
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
          onLoadedData={() => {
            setVideoReady(true);
            videoRef.current?.play().catch(() => {});
          }}
          onCanPlay={() => {
            setVideoReady(true);
            videoRef.current?.play().catch(() => {});
          }}
          onPlaying={() => setVideoReady(true)}
          onPause={() => videoRef.current?.play().catch(() => {})}
          onError={() => ordered.length > 1 && setCurrentIndex((index) => (index + 1) % ordered.length)}
        >
          <source src={activeVideo} type={mimeFor(activeVideo) || undefined} />
        </video>
      )}

      {/* Dark Vegas neon-supporting vignette overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/15 via-background/25 to-background/85" />
    </div>
  );
}