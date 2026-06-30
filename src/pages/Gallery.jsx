import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Images, Play, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { appParams } from "@/lib/app-params";

function getYoutubeId(url) {
  const match = url?.match(/(?:v=|youtu\.be\/|embed\/)([^&?/]+)/);
  return match ? match[1] : null;
}

function getYoutubeThumbnail(url) {
  const id = getYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

function GalleryCard({ item, onClick }) {
  const isEmbed = item.media_type === "youtube" || item.media_type === "facebook";
  const isVideo = item.media_type === "video";
  const thumb = item.thumbnail_url || (item.media_type === "youtube" ? getYoutubeThumbnail(item.embed_url) : null);
  const imgSrc = item.media_type === "photo" ? item.media_url : thumb;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative border border-border bg-card/40 overflow-hidden cursor-pointer hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(249,115,22,0.1)]"
      onClick={() => onClick(item)}
    >
      <div className="aspect-video bg-muted/20 relative overflow-hidden">
        {imgSrc ? (
          <img src={imgSrc} alt={item.title || ""} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Images className="h-10 w-10 text-muted-foreground/30 stroke-1" />
          </div>
        )}
        {(isEmbed || isVideo) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-14 w-14 rounded-full bg-black/60 border border-white/20 flex items-center justify-center backdrop-blur-sm group-hover:bg-primary/80 transition-colors">
              <Play className="h-6 w-6 text-white ml-1" />
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="p-3">
        {item.event_label && (
          <span className="text-[9px] font-bold uppercase tracking-widest text-primary">{item.event_label}</span>
        )}
        {item.title && <p className="mt-1 text-sm font-bold text-foreground line-clamp-1">{item.title}</p>}
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{item.media_type}</p>
      </div>
    </motion.div>
  );
}

function MediaLightbox({ item, onClose }) {
  if (!item) return null;
  const ytId = item.media_type === "youtube" ? getYoutubeId(item.embed_url) : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/90 cursor-pointer" />
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative z-10 w-full max-w-4xl"
        >
          <button onClick={onClose} className="absolute -top-10 right-0 text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-white cursor-pointer">Close</button>
          {item.media_type === "photo" && (
            <img src={item.media_url} alt={item.title || ""} className="w-full max-h-[80dvh] object-contain" />
          )}
          {item.media_type === "video" && (
            <video src={item.media_url} controls autoPlay className="w-full max-h-[80dvh]" />
          )}
          {item.media_type === "youtube" && ytId && (
            <div className="aspect-video w-full">
              <iframe src={`https://www.youtube.com/embed/${ytId}?autoplay=1`} title={item.title || "YouTube"} allow="autoplay; fullscreen" allowFullScreen className="h-full w-full" />
            </div>
          )}
          {item.media_type === "facebook" && item.embed_url && (
            <div className="flex flex-col items-center gap-4 border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">Facebook videos must be opened directly.</p>
              <a href={item.embed_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 border border-primary bg-primary/10 px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary hover:text-white transition-all">
                <ExternalLink className="h-4 w-4" /> Open on Facebook
              </a>
            </div>
          )}
          {item.title && <p className="mt-3 text-center text-sm font-bold text-slate-200">{item.title}</p>}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default function Gallery() {
  const [selected, setSelected] = useState(null);
  const [filterEvent, setFilterEvent] = useState("All");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["gallery"],
    queryFn: () => base44.entities.GalleryItem.filter({ is_published: true }, "sort_order", 200),
    enabled: appParams.hasBase44Config,
  });

  const eventLabels = ["All", ...Array.from(new Set(items.map(i => i.event_label).filter(Boolean)))];
  const filtered = filterEvent === "All" ? items : items.filter(i => i.event_label === filterEvent);

  return (
    <main className="relative min-h-dvh bg-background px-5 pb-20 pt-[calc(7.25rem+env(safe-area-inset-top,0px))] text-foreground md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 border-b border-border/60 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-primary flex items-center gap-1.5 mb-2">
              <Images className="h-3 w-3" /> Previous Events
            </p>
            <h1 className="font-display text-4xl uppercase tracking-tight sm:text-5xl text-foreground">Gallery</h1>
            <p className="mt-2 text-sm text-muted-foreground">Photos, videos and highlights from past events.</p>
          </div>
          <Link to="/" className="flex items-center gap-2 border border-border bg-card/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 hover:border-primary hover:text-primary transition-all self-start md:self-auto">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>

        {/* Event filter pills */}
        {eventLabels.length > 1 && (
          <div className="mt-6 flex gap-2 flex-wrap">
            {eventLabels.map(label => (
              <button key={label} onClick={() => setFilterEvent(label)}
                className={`min-h-[40px] border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${filterEvent === label ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/40 text-slate-300 hover:border-primary/50"}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-8">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1,2,3,4,5,6].map(n => <div key={n} className="aspect-video bg-muted/10 animate-pulse border border-border/30" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-border bg-card/30 p-16 text-center">
              <Images className="mx-auto h-12 w-12 text-muted-foreground/30 stroke-1 mb-4" />
              <h3 className="font-display text-2xl uppercase tracking-wide mb-2">No gallery items yet</h3>
              <p className="text-sm text-muted-foreground">Check back after the next event!</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((item) => (
                <GalleryCard key={item.id} item={item} onClick={setSelected} />
              ))}
            </div>
          )}
        </div>
      </div>

      <MediaLightbox item={selected} onClose={() => setSelected(null)} />
    </main>
  );
}