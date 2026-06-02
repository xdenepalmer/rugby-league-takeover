import React, { useEffect, useMemo, useRef, useState } from "react";

const extOf = (url) => String(url).split("?")[0].split(".").pop()?.toLowerCase();
const mimeFor = (url) => ({ mp4: "video/mp4", webm: "video/webm", ogg: "video/ogg", mov: "video/quicktime" }[extOf(url)] || "");

export default function BackgroundVideo({ src, sources }) {
  const videoRef = useRef(null);
  const [ready, setReady] = useState(false);

  const ordered = useMemo(() => (sources?.length ? sources : [src]).filter(Boolean), [sources, src]);
  const key = ordered.join("|");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    video.muted = true;
    const playVideo = () => video.play().then(() => setReady(true)).catch(() => {});

    video.load();
    playVideo();

    window.addEventListener("touchstart", playVideo, { once: true });
    window.addEventListener("click", playVideo, { once: true });

    return () => {
      window.removeEventListener("touchstart", playVideo);
      window.removeEventListener("click", playVideo);
    };
  }, [key]);

  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-background">
      <video
        ref={videoRef}
        key={key}
        className={`h-full w-full object-cover transition-opacity duration-700 ${ready ? "opacity-70" : "opacity-60"}`}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        onLoadedData={() => setReady(true)}
        onCanPlay={() => videoRef.current?.play().then(() => setReady(true)).catch(() => {})}
        onPlaying={() => setReady(true)}
      >
        {ordered.map((url) => (
          <source key={url} src={url} type={mimeFor(url) || undefined} />
        ))}
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-background/15 via-background/25 to-background/85" />
    </div>
  );
}