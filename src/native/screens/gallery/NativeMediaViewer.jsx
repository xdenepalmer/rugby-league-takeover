import { useEffect, useMemo, useRef, useState } from "react";
import { X, Share2, ExternalLink } from "lucide-react";
import { shareGalleryItem } from "@/lib/native/share";
import { openExternalUrl } from "@/lib/native/open-external";
import { emitHaptic } from "@/lib/native/haptic-events";
import { hideBrokenImage } from "@/lib/img-fallback";
import {
  resolveDragEnd,
  clampZoom,
  pointerDistance,
  adjacentIndices,
} from "./gallery-gestures.js";

const getYoutubeId = (url) => {
  const match = String(url || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return match ? match[1] : "";
};

/**
 * Touch-first fullscreen media viewer: swipe left/right to move between
 * items, pinch to zoom photos, drag down to dismiss, adjacent photos are
 * prefetched, and videos pause automatically because only the active item
 * is mounted. Web keyboard controls stay on the web gallery — this viewer
 * is pointer/gesture-driven.
 */
export default function NativeMediaViewer({ items, index, onNavigate, onClose }) {
  const item = items[index];
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });
  const [zoom, setZoom] = useState(1);
  const pointers = useRef(new Map());
  const pinchBase = useRef(null);
  const start = useRef(null);

  // Prefetch neighbouring photos so swipes land instantly.
  useEffect(() => {
    adjacentIndices(index, items.length).forEach((i) => {
      const neighbour = items[i];
      if (neighbour?.media_type === "photo" && neighbour.media_url) {
        const img = new Image();
        img.src = neighbour.media_url;
      }
    });
    setZoom(1);
    setDrag({ dx: 0, dy: 0 });
  }, [index, items]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handlePointerDown = (e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      start.current = { x: e.clientX, y: e.clientY };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchBase.current = { distance: pointerDistance(a, b), zoom };
      start.current = null;
    }
  };

  const handlePointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchBase.current && item?.media_type === "photo") {
      const [a, b] = [...pointers.current.values()];
      const ratio = pointerDistance(a, b) / (pinchBase.current.distance || 1);
      setZoom(clampZoom(pinchBase.current.zoom * ratio));
      return;
    }
    if (pointers.current.size === 1 && start.current) {
      setDrag({ dx: e.clientX - start.current.x, dy: e.clientY - start.current.y });
    }
  };

  const handlePointerEnd = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchBase.current = null;
    if (pointers.current.size > 0) return;
    const action = resolveDragEnd({ dx: drag.dx, dy: drag.dy, zoom });
    if (action === "dismiss") {
      emitHaptic("sheet.snap");
      onClose();
    } else if (action === "next") {
      emitHaptic("sheet.snap");
      onNavigate((index + 1) % items.length);
    } else if (action === "prev") {
      emitHaptic("sheet.snap");
      onNavigate((index - 1 + items.length) % items.length);
    }
    setDrag({ dx: 0, dy: 0 });
    start.current = null;
  };

  const dismissProgress = Math.min(1, Math.max(0, drag.dy) / 300);
  const youtubeId = useMemo(() => (item?.media_type === "youtube" ? getYoutubeId(item.embed_url || item.media_url) : ""), [item]);

  if (!item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.title || "Media viewer"}
      className="fixed inset-0 z-[60] flex flex-col bg-black touch-none"
      style={{ opacity: 1 - dismissProgress * 0.5 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div className="flex items-center justify-between px-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))]">
        <button type="button" onClick={onClose} aria-label="Close viewer" className="ios-pressable flex h-11 w-11 items-center justify-center text-white">
          <X className="h-6 w-6" aria-hidden="true" />
        </button>
        <p className="min-w-0 flex-1 truncate px-2 text-center text-[10px] font-bold uppercase tracking-widest text-white/70">
          {index + 1} / {items.length}
        </p>
        <button
          type="button"
          aria-label="Share"
          onClick={() => {
            emitHaptic("action.primary");
            shareGalleryItem(item);
          }}
          className="ios-pressable flex h-11 w-11 items-center justify-center text-white"
        >
          <Share2 className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div
        className="flex flex-1 items-center justify-center overflow-hidden"
        style={{ transform: `translate(${zoom > 1.05 ? drag.dx : drag.dx * 0.6}px, ${Math.max(0, drag.dy) * 0.9}px)` }}
      >
        {item.media_type === "photo" && (
          <img
            src={item.media_url}
            alt={item.title || ""}
            onError={hideBrokenImage}
            draggable={false}
            className="max-h-full max-w-full select-none object-contain"
            style={{ transform: `scale(${zoom})`, transition: pointers.current.size ? "none" : "transform 150ms ease-out" }}
          />
        )}
        {item.media_type === "video" && (
          <video src={item.media_url} controls playsInline autoPlay className="max-h-full max-w-full" />
        )}
        {item.media_type === "youtube" && youtubeId && (
          <iframe
            title={item.title || "YouTube video"}
            src={`https://www.youtube.com/embed/${youtubeId}?playsinline=1`}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="aspect-video w-full"
          />
        )}
        {item.media_type === "facebook" && (
          <button
            type="button"
            onClick={() => openExternalUrl(item.media_url, { fallback: "newtab" })}
            className="ios-pressable flex min-h-12 items-center gap-2 border border-white/40 px-5 text-sm font-bold uppercase tracking-widest text-white"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> Watch on Facebook
          </button>
        )}
      </div>

      {(item.title || item.event_label) && (
        <div className="px-4 pb-[max(1rem,var(--safe-bottom))] pt-2 text-center">
          {item.event_label && (
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary">{item.event_label}</p>
          )}
          {item.title && <p className="pt-0.5 text-sm font-bold text-white/90">{item.title}</p>}
        </div>
      )}
    </div>
  );
}
