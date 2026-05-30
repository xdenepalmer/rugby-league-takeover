import React, { useEffect, useRef, useState } from "react";

export default function BackgroundVideo({ src, sources }) {
  const videoRef = useRef(null);
  const videoSources = sources?.length ? sources : [src];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const playVideo = () => {
      video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    };

    video.load();
    playVideo();
    window.addEventListener("touchstart", playVideo, { once: true });
    window.addEventListener("click", playVideo, { once: true });

    return () => {
      window.removeEventListener("touchstart", playVideo);
      window.removeEventListener("click", playVideo);
    };
  }, [currentIndex]);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none bg-background">
      <video
        ref={videoRef}
        src={videoSources[currentIndex]}
        className={`h-full w-full object-cover opacity-65 transition-opacity duration-500 ${playing ? "" : "scale-[1.01]"}`}
        autoPlay
        muted
        onEnded={() => setCurrentIndex((currentIndex + 1) % videoSources.length)}
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        onCanPlay={() => videoRef.current?.play().then(() => setPlaying(true)).catch(() => setPlaying(false))}
        onPlaying={() => setPlaying(true)}
      />
      <div className="absolute inset-0 bg-background/40" />
    </div>
  );
}