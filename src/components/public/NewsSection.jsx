import React from "react";
import { format } from "date-fns";
import SectionHeader from "./SectionHeader";

export default function NewsSection({ articles, settings = {} }) {
  return (
    <section id="news" className="border-t border-border bg-background/80 px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeader eyebrow={settings.news_eyebrow || "Latest News"} title={settings.news_title || "From the strip"}>
          {settings.news_description || "Fresh updates, announcements and supporter news for Rugby League Las Vegas."}
        </SectionHeader>
        <div className="grid gap-6 md:grid-cols-3">
          {articles.map((article, index) => (
            <article key={article.id || index} className="group border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/70">
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img src={article.image_url} alt={article.title} className="h-full w-full object-cover grayscale transition duration-500 group-hover:scale-105 group-hover:grayscale-0" />
              </div>
              <div className="p-6">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-primary">
                  {article.published_date ? format(new Date(article.published_date), "dd MMM yyyy") : "Coming soon"}
                </p>
                <h3 className="font-display text-3xl uppercase leading-none text-foreground">{article.title}</h3>
                <p className="mt-4 line-clamp-4 text-sm leading-6 text-muted-foreground">{article.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}