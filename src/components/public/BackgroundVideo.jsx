import React, { useEffect, useRef, useState } from "react";

export default function BackgroundVideo({ src }) {
  const videoRef = useRef(null);
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

    playVideo();
    window.addEventListener("touchstart", playVideo, { once: true });
    window.addEventListener("click", playVideo, { once: true });

    return () => {
      window.removeEventListener("touchstart", playVideo);
      window.removeEventListener("click", playVideo);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none bg-background">
      <video
        ref={videoRef}
        src={src}
        className={`h-full w-full object-cover opacity-65 transition-opacity duration-500 ${playing ? "" : "scale-[1.01]"}`}
        autoPlay
        muted
        loop
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