import React, { useRef } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Calendar, ArrowRight } from "lucide-react";
import SectionHeader from "./SectionHeader";

// Card entrance variants
const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  show: (index) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
      delay: index * 0.12,
    }
  })
};

function NewsCard({ article, index }) {
  return (
    <motion.article 
      variants={cardVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-50px" }}
      custom={index}
      className="group relative flex flex-col border border-border bg-card/40 cmd-glass transition-all duration-500 hover:-translate-y-2 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.1)] overflow-hidden"
    >
      {/* Top micro stream lines */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />

      {/* Image container */}
      <div className="aspect-[4/3] overflow-hidden bg-muted/10 relative border-b border-border/50">
        <img 
          src={article.image_url} 
          alt={article.title} 
          className="h-full w-full object-cover grayscale opacity-80 transition duration-700 ease-out group-hover:scale-108 group-hover:grayscale-0 group-hover:opacity-100" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-70" />
        
        {/* Date overlay badge */}
        <span className="absolute bottom-4 left-4 inline-flex items-center gap-1 px-3 py-1 bg-card/85 backdrop-blur-sm border border-border/60 text-[10px] font-bold uppercase tracking-wider text-accent">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          <span>{article.published_date ? format(new Date(article.published_date), "dd MMM yyyy") : "Announced"}</span>
        </span>
      </div>

      {/* Content panel */}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          {article.category && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-primary mb-2.5 inline-block">
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

        {/* Read More Trigger hover link */}
        <div className="mt-6 pt-4 border-t border-border/30 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors duration-300">
          <span>Read Article</span>
          <ArrowRight className="w-4 h-4 text-primary -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
        </div>
      </div>
    </motion.article>
  );
}

export default function NewsSection({ articles, settings = {} }) {
  const containerRef = useRef(null);

  return (
    <section id="news" className="relative border-t border-border bg-background/85 px-5 py-24 md:px-8 md:py-32 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/2 blur-[120px] pointer-events-none" />

      <div className="mx-auto max-w-7xl relative z-10">
        <SectionHeader eyebrow={settings.news_eyebrow || "Latest News"} title={settings.news_title || "From the strip"}>
          {settings.news_description || "Fresh updates, announcements and supporter news for Rugby League Las Vegas."}
        </SectionHeader>
        
        <div ref={containerRef} className="grid gap-6 md:grid-cols-3 mt-12">
          {articles.map((article, index) => (
            <NewsCard key={article.id || index} article={article} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}