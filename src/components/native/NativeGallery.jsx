/**
 * Native iOS Gallery. A native-only media surface reached via the isNativeApp()
 * branch in src/pages/Gallery.jsx; the web Gallery is untouched. Reuses the exact
 * ["gallery"] React Query key and the web MediaLightbox/helpers so the cache and
 * the full-screen viewer stay consistent across surfaces.
 */
import React, { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Images, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { hideBrokenImage } from "@/lib/img-fallback";
import { lightImpact, selectionChanged } from "@/lib/native/haptics";
import PullToRefresh from "@/components/PullToRefresh";
import {
  MediaLightbox, MediaBadge, getThumb, TYPE_FILTERS, ALL,
} from "@/pages/Gallery";

export default function NativeGallery() {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [filterEvent, setFilterEvent] = useState(ALL);
  const [filterType, setFilterType] = useState(ALL);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["gallery"],
    queryFn: () => base44.entities.GalleryItem.filter({ is_published: true }, "sort_order", 500),
  });

  const eventLabels = useMemo(
    () => [ALL, ...Array.from(new Set(items.map((i) => i.event_label).filter(Boolean)))],
    [items]
  );
  const availableTypes = useMemo(() => new Set(items.map((i) => i.media_type)), [items]);

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        const matchEvent = filterEvent === ALL || i.event_label === filterEvent;
        const matchType = filterType === ALL || i.media_type === filterType;
        return matchEvent && matchType;
      }),
    [items, filterEvent, filterType]
  );

  const openLightbox = useCallback(
    (item) => {
      lightImpact();
      const idx = filtered.findIndex((i) => i.id === item.id);
      setLightboxIndex(idx >= 0 ? idx : 0);
    },
    [filtered]
  );
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const goPrev = useCallback(() => setLightboxIndex((i) => (i - 1 + filtered.length) % filtered.length), [filtered.length]);
  const goNext = useCallback(() => setLightboxIndex((i) => (i + 1) % filtered.length), [filtered.length]);

  const typeFilters = TYPE_FILTERS.filter((f) => f.key === ALL || availableTypes.has(f.key));

  return (
    <>
      <PullToRefresh queryKeys={[["gallery"]]}>
        <main className="min-h-dvh bg-background text-foreground nt-legible-floor pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
          <div className="mx-auto w-full max-w-xl nt-gutter-x nt-stack">
            {/* Header */}
            <div className="pb-1">
              <p className="nt-caption font-bold uppercase tracking-[0.22em] text-primary">
                <span className="inline-flex items-center gap-1.5"><Images className="h-3.5 w-3.5" /> Previous events</span>
              </p>
              <h1 className="nt-large-title mt-0.5 text-foreground">Gallery</h1>
            </div>

            {/* Type filter — horizontal pills */}
            {typeFilters.length > 1 && (
              <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 store-category-rail">
                {typeFilters.map(({ key, label, icon: Icon }) => {
                  const active = filterType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { selectionChanged(); setFilterType(key); }}
                      aria-pressed={active}
                      className={`ios-pressable flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border px-3.5 py-2 nt-caption font-bold uppercase tracking-wider transition-colors ${
                        active
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-border/70 bg-card/40 text-slate-300"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Event filter */}
            {eventLabels.length > 1 && (
              <div className="-mx-4 -mt-1 flex snap-x gap-2 overflow-x-auto px-4 store-category-rail">
                {eventLabels.map((label) => {
                  const active = filterEvent === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => { selectionChanged(); setFilterEvent(label); }}
                      aria-pressed={active}
                      className={`ios-pressable inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border px-3.5 py-1.5 nt-caption font-bold uppercase tracking-wider transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/70 bg-card/40 text-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, n) => (
                  <div key={n} className="aspect-square skeleton-shimmer border border-border/30" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="nt-raised nt-e1 border border-border/50 p-12 text-center">
                <Images className="mx-auto mb-4 h-12 w-12 text-muted-foreground/25 stroke-1" />
                <h3 className="nt-title text-foreground">
                  {items.length === 0 ? "No gallery items yet" : "Nothing matches"}
                </h3>
                <p className="nt-footnote mt-1 text-muted-foreground">
                  {items.length === 0 ? "Check back after the next event." : "Try a different filter."}
                </p>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { selectionChanged(); setFilterEvent(ALL); setFilterType(ALL); }}
                    className="ios-pressable mt-4 inline-flex min-h-11 items-center border border-border/70 px-5 py-2 nt-caption font-bold uppercase tracking-wider text-slate-300"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <motion.div layout className="grid grid-cols-2 gap-3">
                <AnimatePresence mode="popLayout">
                  {filtered.map((item) => (
                    <NativeGalleryTile key={item.id} item={item} onClick={openLightbox} />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </main>
      </PullToRefresh>

      {/* Full-screen viewer — reuses the web lightbox (its own z-[500] escapes
          the tab bar). Rendered outside PullToRefresh so drag can't interfere. */}
      {lightboxIndex !== null && (
        <MediaLightbox
          items={filtered}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={goPrev}
          onNext={goNext}
        />
      )}
    </>
  );
}

function NativeGalleryTile({ item, onClick }) {
  const isPlayable = item.media_type !== "photo";
  const thumb = getThumb(item);
  return (
    <motion.button
      layout
      type="button"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.22 }}
      onClick={() => onClick(item)}
      aria-label={item.title ? `View ${item.title}` : "View media"}
      className="ios-pressable group relative aspect-square overflow-hidden border border-border/60 bg-card/40 text-left"
    >
      {thumb ? (
        <img src={thumb} alt={item.title || ""} loading="lazy" onError={hideBrokenImage} className="h-full w-full object-cover" />
      ) : item.media_type === "video" && item.media_url ? (
        <video src={item.media_url} preload="metadata" muted playsInline className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted/10">
          <Images className="h-10 w-10 text-muted-foreground/20 stroke-1" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <div className="absolute left-1.5 top-1.5">
        <MediaBadge type={item.media_type} />
      </div>
      {isPlayable && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/45 backdrop-blur-sm">
            <Play className="ml-0.5 h-5 w-5 text-white" fill="white" />
          </span>
        </div>
      )}
      {item.title && (
        <p className="absolute inset-x-0 bottom-0 line-clamp-1 px-2 py-1.5 text-2xs font-bold text-white">{item.title}</p>
      )}
    </motion.button>
  );
}
