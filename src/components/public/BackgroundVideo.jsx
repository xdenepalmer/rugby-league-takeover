import React, { useEffect, useMemo, useRef, useState } from "react";

// Order sources so browser-friendly formats win. QuickTime (.mov) does NOT play
// in Chrome/Edge/Firefox, so it must never be the only/first source.
const FORMAT_RANK = { mp4: 0, webm: 1, ogg: 2, mov: 9 };
const extOf = (url) => String(url).split("?")[0].split(".").pop()?.toLowerCase();
const mimeFor = (url) => ({ mp4: "video/mp4", webm: "video/webm", ogg: "video/ogg", mov: "video/quicktime" }[extOf(url)] || "");

export default function BackgroundVideo({ src, sources }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [prefersReduced] = useState(() => 
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const ordered = useMemo(() => {
    const list = (sources?.length ? sources : [src]).filter(Boolean);
    return [...list].sort((a, b) => (FORMAT_RANK[extOf(a)] ?? 5) - (FORMAT_RANK[extOf(b)] ?? 5));
  }, [sources, src]);

  const key = ordered.join("|");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    video.muted = true;
    const tryPlay = () => video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    video.load();
    tryPlay();
    const onInteract = () => tryPlay();
    window.addEventListener("touchstart", onInteract, { once: true });
    window.addEventListener("click", onInteract, { once: true });
    return () => {
      window.removeEventListener("touchstart", onInteract);
      window.removeEventListener("click", onInteract);
    };
  }, [key]);

  if (prefersReduced) {
    return <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none bg-background" />;
  }

  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none bg-background">
      <video
        ref={videoRef}
        key={key}
        className={`h-full w-full object-cover transition-opacity duration-700 ${playing ? "opacity-65" : "opacity-40"}`}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        controls={false}
        disablePictureInPicture
        onCanPlay={() => videoRef.current?.play().then(() => setPlaying(true)).catch(() => setPlaying(false))}
        onPlaying={() => setPlaying(true)}
      >
        {ordered.map((url) => (
          <source key={url} src={url} type={mimeFor(url) || undefined} />
        ))}
      </video>
      <div className="absolute inset-0 bg-background/40" />
    </div>
  );
}
