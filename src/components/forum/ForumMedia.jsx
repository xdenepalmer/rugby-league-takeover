import React from "react";

const isVideo = (url, type) => {
  if (type === "video") return true;
  const ext = String(url || "").split("?")[0].split(".").pop()?.toLowerCase();
  return ["mp4", "webm", "mov", "ogg"].includes(ext);
};

// Renders an attached image / GIF / video on a forum post or reply.
export default function ForumMedia({ url, type, className = "" }) {
  if (!url) return null;
  return (
    <div className={`mt-3 overflow-hidden border border-border bg-secondary/30 ${className}`}>
      {isVideo(url, type) ? (
        <video src={url} controls playsInline className="max-h-96 w-full object-contain" />
      ) : (
        <img src={url} alt="attachment" loading="lazy" className="max-h-96 w-full object-contain" />
      )}
    </div>
  );
}
