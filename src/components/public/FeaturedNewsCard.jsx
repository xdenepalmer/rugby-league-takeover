import React, { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Calendar, ArrowRight, Clock, Newspaper, Star } from "lucide-react";

const safeFormatDate = (dateStr, fmt = "dd MMM yyyy") => {
  if (!dateStr) return null;
  try { const d = new Date(dateStr); return isNaN(d.getTime()) ? null : format(d, fmt); } catch { return null; }
};

const readingTime = (text) => {
  if (!text) return "1 min read";
  const words = text.trim().split(/\s+/).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
};

/* Large editorial lead-story card — image left, content right on desktop. */
export default function FeaturedNewsCard({ article, onClick }) {
  const [imgError, setImgError] = useState(false);
  const showFallback = !article.image_url || imgError;
  const timeEst = readingTime(article.body);

  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ type: "spring", stiffness: 80, damping: 18 }}
      onClick={() => onClick(article)}
      className="group relative mb-6 grid cursor-pointer overflow-hidden border border-border bg-card/40 cmd-glass transition-all duration-500 hover:border-primary/50 hover:shadow-[0_0_40px_rgba(249,115,22,0.14)] lg:grid-cols-2"
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 z-20 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-primary via-accent to-primary transition-transform duration-500 group-hover:scale-x-100" />

      {/* Image */}
      <div className="relative aspect-[16/9] overflow-hidden border-b border-border/50 bg-muted/10 lg:aspect-auto lg:min-h-[380px] lg:border-b-0 lg:border-r">
        {showFallback ? (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-card to-accent/10">
            <Newspaper className="h-14 w-14 text-primary/40" />
          </div>
        ) : (
          <img
            src={article.image_url}
            alt={article.title}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover grayscale opacity-80 transition duration-700 ease-out group-hover:scale-105 group-hover:grayscale-0 group-hover:opacity-100"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#030512]/80 via-transparent to-transparent opacity-70" />
        <span className="absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 border border-accent/40 bg-card/85 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-accent backdrop-blur-sm">
          <Star className="h-3 w-3 fill-accent" />
          Lead Story
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-center p-7 lg:p-12">
        <div className="mb-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            {safeFormatDate(article.published_date) || "Announced"}
          </span>
          <span className="h-1 w-1 bg-border" />
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {timeEst}
          </span>
        </div>

        <h3 className="font-display text-3xl uppercase leading-[0.95] text-foreground transition-colors duration-300 group-hover:text-primary md:text-4xl xl:text-5xl">
          {article.title}
        </h3>
        <p className="mt-5 line-clamp-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
          {article.body}
        </p>

        <div className="mt-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
          <span>Read the full story</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
        </div>
      </div>
    </motion.article>
  );
}