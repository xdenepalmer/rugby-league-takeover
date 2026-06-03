import React, { useRef, useCallback, useState } from "react";
import { format } from "date-fns";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { Calendar, ArrowRight, Clock, Newspaper } from "lucide-react";
import SectionHeader from "./SectionHeader";
import PublicDetailSheet from "./PublicDetailSheet";

/* ── Reading time estimator ── */
const readingTime = (text) => {
  if (!text) return "1 min";
  const words = text.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.ceil(words / 200));
  return `${mins} min read`;
};

/* ── Card entrance variants ── */
const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.97 },
  show: (index) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 80,
      damping: 18,
      delay: index * 0.14,
    },
  }),
};

/* ── NewsCard with cursor-follow spotlight ── */
function NewsCard({ article, index, onClick }) {
  const cardRef = useRef(null);
  const spotlightX = useMotionValue(0);
  const spotlightY = useMotionValue(0);
  const springX = useSpring(spotlightX, { stiffness: 300, damping: 30 });
  const springY = useSpring(spotlightY, { stiffness: 300, damping: 30 });

  const handleMouseMove = useCallback(
    (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      spotlightX.set(e.clientX - rect.left);
      spotlightY.set(e.clientY - rect.top);
    },
    [spotlightX, spotlightY]
  );

  const timeEst = readingTime(article.body);

  return (
    <motion.article
      ref={cardRef}
      variants={cardVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      custom={index}
      onMouseMove={handleMouseMove}
      onClick={() => onClick(article)}
      className="group relative flex flex-col border border-border bg-card/40 cmd-glass transition-all duration-500 hover:-translate-y-2 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(249,115,22,0.12)] overflow-hidden cursor-pointer"
    >
      {/* Cursor-following spotlight gradient */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(350px circle at ${springX}px ${springY}px, hsl(var(--primary) / 0.07), transparent 70%)`,
        }}
      />

      {/* Top accent line that expands on hover */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-accent to-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left z-20" />

      {/* Image container */}
      <div className="aspect-[4/3] overflow-hidden bg-muted/10 relative border-b border-border/50">
        <img
          src={article.image_url}
          alt={article.title}
          loading="lazy"
          className="h-full w-full object-cover grayscale opacity-80 transition duration-700 ease-out group-hover:scale-105 group-hover:grayscale-0 group-hover:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#030512]/90 via-transparent to-transparent opacity-70" />

        {/* Date + reading time overlay badges */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2 z-10">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-card/85 backdrop-blur-sm border border-border/60 text-[10px] font-bold uppercase tracking-wider text-accent">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span>
              {article.published_date
                ? format(new Date(article.published_date), "dd MMM yyyy")
                : "Announced"}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-card/85 backdrop-blur-sm border border-border/60 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            <Clock className="w-3 h-3" />
            {timeEst}
          </span>
        </div>
      </div>

      {/* Content panel */}
      <div className="p-6 flex-1 flex flex-col justify-between relative z-10">
        <div>
          {article.category && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-primary mb-2.5 border border-primary/25 bg-primary/5 px-2 py-0.5">
              <Newspaper className="w-3 h-3" />
              {article.category}
            </span>
          )}
          <h3 className="font-display text-2xl xl:text-3xl uppercase leading-none text-foreground group-hover:text-primary transition-colors duration-300">
            {article.title}
          </h3>
          <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
            {article.body}
          </p>
        </div>

        {/* Read More trigger */}
        <div className="mt-6 pt-4 border-t border-border/30 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors duration-300">
          <span>Read more</span>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground/50 group-hover:text-primary/50 transition-colors">
              {timeEst}
            </span>
            <ArrowRight className="w-4 h-4 text-primary -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export default function NewsSection({ articles, settings = {} }) {
  const containerRef = useRef(null);
  const [selectedArticle, setSelectedArticle] = useState(null);

  const handleCtaClick = () => {
    const element = document.querySelector("#travel");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      id="news"
      className="relative border-t border-border bg-background/85 px-5 py-24 md:px-8 md:py-32 overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-[120px] pointer-events-none" />

      <div className="mx-auto max-w-7xl relative z-10">
        <SectionHeader
          eyebrow={settings.news_eyebrow || "Latest News"}
          title={settings.news_title || "From the strip"}
        >
          {settings.news_description ||
            "Fresh updates, announcements and supporter news for Rugby League Las Vegas."}
        </SectionHeader>

        {/* Article count badge */}
        {articles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="mb-8 inline-flex items-center gap-2 border border-border/50 bg-card/30 px-3 py-1.5"
          >
            <span className="h-1.5 w-1.5 bg-primary animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {articles.length} {articles.length === 1 ? "article" : "articles"}
            </span>
          </motion.div>
        )}

        <div ref={containerRef} className="grid gap-6 md:grid-cols-3">
          {articles.map((article, index) => (
            <NewsCard
              key={article.id || index}
              article={article}
              index={index}
              onClick={setSelectedArticle}
            />
          ))}
        </div>
      </div>

      <PublicDetailSheet
        isOpen={!!selectedArticle}
        onClose={() => setSelectedArticle(null)}
        title={selectedArticle?.title}
        category={selectedArticle?.category || "News"}
        date={selectedArticle?.published_date ? format(new Date(selectedArticle.published_date), "dd MMM yyyy") : undefined}
        author={selectedArticle?.author || "RLT Staff"}
        image={selectedArticle?.image_url}
        body={selectedArticle?.body}
        readingTime={selectedArticle ? readingTime(selectedArticle.body) : undefined}
        ctaLabel="Register Vegas Travel Interest"
        onCtaClick={handleCtaClick}
      />
    </section>
  );
}