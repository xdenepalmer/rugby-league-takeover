import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { ArrowLeft, Images, Play, ExternalLink, X, ChevronLeft, ChevronRight, Camera, Film } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import BackgroundVideo, { DEFAULT_BACKGROUND_VIDEO_SOURCES } from "@/components/public/BackgroundVideo";

function getYoutubeId(url) {
  const match = url?.match(/(?:v=|youtu\.be\/|embed\/)([^&?/]+)/);
  return match ? match[1] : null;
}

function getYoutubeThumbnail(url) {
  const id = getYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : null;
}

const YoutubeIcon = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1C4.5 20.5 12 20.5 12 20.5s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/></svg>;
const FacebookIcon = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07z"/></svg>;

const TYPE_ICONS = { photo: Camera, video: Film, youtube: YoutubeIcon, facebook: FacebookIcon };
const TYPE_LABELS = { photo: "Photo", video: "Video", youtube: "YouTube", facebook: "Facebook" };

function MediaBadge({ type }) {
  const Icon = TYPE_ICONS[type] || Images;
  return (
    <span className="flex items-center gap-1 border border-white/20 bg-black/60 px-1.5 py-0.5 backdrop-blur-sm text-[9px] font-bold uppercase tracking-wider text-white">
      <Icon className="h-2.5 w-2.5" /> {TYPE_LABELS[type] || type}
    </span>
  );
}

function getThumb(item) {
  if (item.thumbnail_url) return item.thumbnail_url;
  if (item.media_type === "photo") return item.media_url;
  if (item.media_type === "youtube") return getYoutubeThumbnail(item.embed_url);
  return null;
}

function GalleryCard({ item, onClick }) {
  const isPlayable = item.media_type !== "photo";
  // For video type with no explicit thumbnail, try to grab the first frame via the video element
  const thumb = getThumb(item) || (item.media_type === "video" ? null : null);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className="group relative overflow-hidden border border-border bg-card/40 cursor-pointer hover:border-primary/60 transition-all duration-300 hover:shadow-[0_0_24px_rgba(249,115,22,0.12)]"
      onClick={() => onClick(item)}
    >
      <div className="aspect-video relative overflow-hidden bg-muted/20">
        {thumb ? (
          <img
            src={thumb}
            alt={item.title || ""}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : item.media_type === "video" && item.media_url ? (
          <video
            src={item.media_url}
            preload="metadata"
            muted
            playsInline
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/10">
            <Images className="h-12 w-12 text-muted-foreground/20 stroke-1" />
          </div>
        )}

        {/* Dark gradient on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Play button overlay */}
        {isPlayable && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-14 w-14 rounded-full border border-white/30 bg-black/50 flex items-center justify-center backdrop-blur-sm transition-all duration-300 group-hover:bg-primary/80 group-hover:border-primary group-hover:scale-110 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
              <Play className="h-6 w-6 text-white ml-0.5" fill="white" />
            </div>
          </div>
        )}

        {/* Type badge top-left */}
        <div className="absolute top-2 left-2">
          <MediaBadge type={item.media_type} />
        </div>

        {/* Event label bottom on hover */}
        {item.event_label && (
          <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="text-[9px] font-bold uppercase tracking-widest text-primary">{item.event_label}</span>
          </div>
        )}
      </div>

      {/* Caption */}
      {item.title && (
        <div className="px-3 py-2.5 border-t border-border/50">
          <p className="text-sm font-bold text-foreground line-clamp-1">{item.title}</p>
        </div>
      )}
    </motion.div>
  );
}

function MediaLightbox({ items, index, onClose, onPrev, onNext }) {
  const item = items[index];

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  if (!item) return null;
  const ytId = item.media_type === "youtube" ? getYoutubeId(item.embed_url) : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[500] flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/95 cursor-pointer"
        />

        {/* Content */}
        <motion.div
          key={item.id}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 w-full max-w-5xl px-4"
        >
          {/* Top bar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <MediaBadge type={item.media_type} />
              {item.event_label && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{item.event_label}</span>
              )}
              <span className="text-[10px] font-mono text-slate-400">{index + 1} / {items.length}</span>
            </div>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center border border-border/60 bg-card/40 text-slate-300 hover:border-primary hover:text-foreground transition-all"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Media */}
          <div className="relative">
            {item.media_type === "photo" && (
              <img src={item.media_url} alt={item.title || ""} className="w-full max-h-[75dvh] object-contain mx-auto block" />
            )}
            {item.media_type === "video" && (
              <video
                src={item.media_url}
                controls
                autoPlay
                poster={item.thumbnail_url || undefined}
                preload="metadata"
                className="w-full max-h-[75dvh]"
              />
            )}
            {item.media_type === "youtube" && ytId && (
              <div className="aspect-video w-full">
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
                  title={item.title || "YouTube"}
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            )}
            {item.media_type === "facebook" && item.embed_url && (
              <div className="flex flex-col items-center gap-5 border border-border bg-card/60 py-16 text-center">
                <FacebookIcon className="h-12 w-12 text-blue-400" />
                <div>
                  <p className="font-display text-xl uppercase">Facebook Video</p>
                  <p className="text-sm text-muted-foreground mt-1">Open directly on Facebook to watch.</p>
                </div>
                <a
                  href={item.embed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-blue-500 bg-blue-500/10 px-6 py-3 text-xs font-bold uppercase tracking-wider text-blue-400 hover:bg-blue-500 hover:text-white transition-all"
                >
                  <ExternalLink className="h-4 w-4" /> Watch on Facebook
                </a>
              </div>
            )}

            {/* Prev / Next arrows */}
            {items.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onPrev(); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center border border-border/60 bg-black/60 text-white hover:border-primary hover:bg-primary/20 transition-all backdrop-blur-sm"
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onNext(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center border border-border/60 bg-black/60 text-white hover:border-primary hover:bg-primary/20 transition-all backdrop-blur-sm"
                  aria-label="Next"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {/* Caption */}
          {item.title && (
            <p className="mt-3 text-center text-sm font-bold text-slate-200">{item.title}</p>
          )}

          {/* Dot indicators */}
          {items.length > 1 && items.length <= 20 && (
            <div className="mt-4 flex justify-center gap-1.5">
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); }}
                  className={`h-1.5 transition-all duration-300 ${i === index ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground"}`}
                />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

const ALL = "All";
const TYPE_FILTERS = [
  { key: ALL, label: "All", icon: Images },
  { key: "photo", label: "Photos", icon: Camera },
  { key: "video", label: "Videos", icon: Film },
  { key: "youtube", label: "YouTube", icon: YoutubeIcon },
  { key: "facebook", label: "Facebook", icon: FacebookIcon },
];

export default function Gallery() {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [filterEvent, setFilterEvent] = useState(ALL);
  const [filterType, setFilterType] = useState(ALL);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["gallery"],
    queryFn: () => base44.entities.GalleryItem.filter({ is_published: true }, "sort_order", 500),
  });
  const { data: settingsRecords = [] } = useQuery({
    queryKey: ["siteSettings"],
    queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });

  const eventLabels = [ALL, ...Array.from(new Set(items.map(i => i.event_label).filter(Boolean)))];
  const availableTypes = new Set(items.map(i => i.media_type));
  const videoSources = settingsRecords[0]?.background_video_urls?.length
    ? settingsRecords[0].background_video_urls
    : DEFAULT_BACKGROUND_VIDEO_SOURCES;

  const filtered = items.filter(i => {
    const matchEvent = filterEvent === ALL || i.event_label === filterEvent;
    const matchType = filterType === ALL || i.media_type === filterType;
    return matchEvent && matchType;
  });

  const openLightbox = useCallback((item) => {
    const idx = filtered.findIndex(i => i.id === item.id);
    setLightboxIndex(idx >= 0 ? idx : 0);
  }, [filtered]);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const goPrev = useCallback(() => setLightboxIndex(i => (i - 1 + filtered.length) % filtered.length), [filtered.length]);
  const goNext = useCallback(() => setLightboxIndex(i => (i + 1) % filtered.length), [filtered.length]);

  return (
    <main className="relative min-h-dvh bg-background text-foreground">
      <BackgroundVideo sources={videoSources} />
      <div className="relative z-10">
      {/* Hero header */}
      <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-card/60 to-background pt-[calc(7.25rem+env(safe-area-inset-top,0px))] pb-10">
        <div className="cmd-grid-bg absolute inset-0 opacity-20 pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-5 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-primary flex items-center gap-1.5 mb-3">
                <Images className="h-3.5 w-3.5" /> Previous Events
              </p>
              <h1 className="font-display text-5xl uppercase tracking-tight sm:text-6xl leading-none">Gallery</h1>
              <p className="mt-3 text-sm text-muted-foreground max-w-xl">Photos, videos and highlights from our events. Click any item to view it full screen.</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {!isLoading && items.length > 0 && (
                <span className="border border-border bg-card/40 px-4 py-2 text-xs font-mono font-bold text-muted-foreground">
                  {items.length} items
                </span>
              )}
              <Link
                to="/"
                className="flex items-center gap-2 border border-border bg-card/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 hover:border-primary hover:text-primary transition-all"
              >
                <ArrowLeft className="h-4 w-4" /> Home
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        {/* Filters row */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          {/* Event filter */}
          {eventLabels.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {eventLabels.map(label => (
                <button
                  key={label}
                  onClick={() => setFilterEvent(label)}
                  className={`min-h-[38px] border px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    filterEvent === label
                      ? "border-primary bg-primary text-primary-foreground shadow-[0_0_12px_rgba(249,115,22,0.3)]"
                      : "border-border bg-card/40 text-slate-300 hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Type filter */}
          <div className="flex gap-1.5 flex-wrap">
            {TYPE_FILTERS.filter(f => f.key === ALL || availableTypes.has(f.key)).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setFilterType(key)}
                className={`flex items-center gap-1.5 min-h-[38px] border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  filterType === key
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-card/30 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, n) => (
              <div key={n} className="aspect-video bg-muted/10 animate-pulse border border-border/30" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-border bg-card/30 p-20 text-center">
            <Images className="mx-auto h-14 w-14 text-muted-foreground/20 stroke-1 mb-5" />
            <h3 className="font-display text-2xl uppercase tracking-wide mb-2">
              {items.length === 0 ? "No gallery items yet" : "No items match your filter"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {items.length === 0 ? "Check back after the next event!" : "Try selecting a different filter above."}
            </p>
            {items.length > 0 && (
              <button
                onClick={() => { setFilterEvent(ALL); setFilterType(ALL); }}
                className="mt-4 border border-border px-6 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary transition-all"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((item) => (
                <GalleryCard key={item.id} item={item} onClick={openLightbox} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
      </div>

      {/* Rendered outside the z-10 content wrapper: its own z-[500] must escape
          to cover the fixed nav/tab bar, which a nested stacking context would trap. */}
      {lightboxIndex !== null && (
        <MediaLightbox
          items={filtered}
          index={lightboxIndex}
          onClose={closeLightbox}
          onPrev={goPrev}
          onNext={goNext}
        />
      )}
    </main>
  );
}