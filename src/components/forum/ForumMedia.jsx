import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const isVideo = (url, type) => {
  if (type === "video") return true;
  const ext = String(url || "").split("?")[0].split(".").pop()?.toLowerCase();
  return ["mp4", "webm", "mov", "ogg"].includes(ext);
};

// Renders an attached image / GIF / video on a forum post or reply.
// Images are click-to-expand into a fullscreen lightbox overlay.
export default function ForumMedia({ url, type, className = "" }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e) => { if (e.key === "Escape") closeLightbox(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, closeLightbox]);

  if (!url) return null;

  const isVid = isVideo(url, type);

  return (
    <>
      {/* The frame hugs the media instead of boxing it.
          `w-full object-contain` stretched every attachment to the full post
          width and letterboxed it inside a 384px-tall box, so a portrait or
          square photo sat in a wide slab of empty background — the "weird
          formatting" and dead space on image posts. Sizing to the image's own
          aspect ratio removes both, with a cap so one huge upload can't push
          the rest of the thread off screen. */}
      <div className={`mt-3 flex w-fit max-w-full overflow-hidden border border-border bg-black/20 ${className}`}>
        {isVid ? (
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            className="max-h-[26rem] w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="max-w-full cursor-zoom-in"
            aria-label="Expand image"
          >
            <img
              src={url}
              alt="attachment"
              loading="lazy"
              decoding="async"
              className="block h-auto max-h-[26rem] w-auto max-w-full"
            />
          </button>
        )}
      </div>

      {/* Fullscreen lightbox overlay */}
      <AnimatePresence>
        {lightboxOpen && !isVid && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            onClick={closeLightbox}
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Full-res image */}
            <motion.img
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              src={url}
              alt="Full resolution attachment"
              className="max-h-[90vh] max-w-[90vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
