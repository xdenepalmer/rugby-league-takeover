import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share2, Calendar, Clock, User, Check } from "lucide-react";
import { shareUrl as nativeShareUrl } from "@/lib/native/share";

export default function PublicDetailSheet({ isOpen, onClose, title, category, date, author, image, body, readingTime, shareUrl, ctaLabel, onCtaClick, extraContent }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleShare = async (e) => {
    e.preventDefault();
    // Native share sheet in the iOS shell; navigator.share / clipboard on web.
    const result = await nativeShareUrl({
      title: title,
      text: body ? body.slice(0, 100) + "..." : "",
      url: shareUrl || window.location.href,
    });
    if (result === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
      <div key="detail-sheet" className="fixed inset-0 z-50 pointer-events-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "linear" }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto"
        />

        {/* Sliding Sheet */}
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 220 }}
          className="absolute inset-x-0 bottom-0 max-h-[90vh] border-t border-border bg-card/95 pb-safe cmd-glass pointer-events-auto flex flex-col overflow-hidden w-full max-w-3xl mx-auto"
          role="dialog"
          aria-modal="true"
        >
          {/* Neon accent top border */}
          <div className="h-[2px] w-full bg-gradient-to-r from-primary via-accent to-primary shrink-0" />

          {/* Drag Handle */}
          <div className="flex justify-center py-2 shrink-0">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header Actions */}
          <div className="flex items-center justify-between px-6 pb-3 border-b border-border/40 shrink-0">
            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold tracking-widest text-primary uppercase border border-primary/25 bg-primary/5 px-2 py-0.5">
              {category || "Detail View"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="flex h-10 w-10 items-center justify-center border border-border text-slate-300 hover:border-primary hover:text-foreground transition-all cursor-pointer relative"
                aria-label="Share this details page"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4" />}
                <AnimatePresence>
                  {copied && (
                    <motion.span
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute -top-7 right-0 text-[8px] font-mono font-bold uppercase tracking-wider bg-emerald-500 text-white px-1.5 py-0.5 whitespace-nowrap"
                    >
                      Copied Link!
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center border border-border text-slate-300 hover:border-primary hover:text-foreground transition-all cursor-pointer"
                aria-label="Close details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Container */}
          <div className="flex-1 overflow-y-auto cmd-scrollbar">
            {/* Featured Image */}
            {image && (
              <div className="w-full aspect-[16/9] relative overflow-hidden bg-muted/10 border-b border-border/40">
                <img src={image} alt="" className="h-full w-full object-cover opacity-90" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-transparent to-transparent" />
              </div>
            )}

            <div className="p-6 md:p-8 space-y-6">
              {/* Meta details */}
              <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground font-mono">
                {date && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>{date}</span>
                  </div>
                )}
                {readingTime && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{readingTime}</span>
                  </div>
                )}
                {author && (
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    <span>By {author}</span>
                  </div>
                )}
              </div>

              {/* Title */}
              <h3 className="font-display text-2xl md:text-4xl uppercase leading-[0.95] tracking-wide text-foreground">
                {title}
              </h3>

              {/* Paragraphs */}
              <div className="text-sm md:text-base leading-relaxed text-slate-300 space-y-4 font-normal">
                {body ? (
                  body.split("\n\n").map((para, idx) => (
                    <p key={idx}>{para}</p>
                  ))
                ) : (
                  <p className="text-muted-foreground italic">No description details provided.</p>
                )}
              </div>

              {extraContent}

              {/* Bottom Call to Action */}
              {ctaLabel && (
                <div className="pt-4 border-t border-border/40 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (onCtaClick) onCtaClick();
                      onClose();
                    }}
                    className="w-full sm:w-auto px-6 py-3.5 border border-primary bg-primary/20 text-xs font-bold uppercase tracking-[0.2em] text-foreground hover:bg-primary hover:text-white transition-all cursor-pointer text-center"
                  >
                    {ctaLabel}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}