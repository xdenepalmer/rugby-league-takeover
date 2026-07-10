import { hideBrokenImage } from "@/lib/img-fallback";
import { readingTimeMinutes } from "@/lib/news-articles";

const formatDate = (value) => {
  try {
    return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
};

/**
 * Platform-neutral article body: hero image, meta row, paragraphs. The web
 * page and the native reader both render this core; chrome (top bars,
 * progress, text-size, save/share controls) stays platform-specific.
 */
export default function ArticleReader({ article, textScale = 1 }) {
  if (!article) return null;
  const minutes = readingTimeMinutes(article.body);

  return (
    <article className="mx-auto w-full max-w-2xl">
      {article.image_url && (
        <img
          src={article.image_url}
          alt=""
          onError={hideBrokenImage}
          className="max-h-[42vh] w-full border border-border/50 object-cover"
        />
      )}
      <div className="px-4 pt-4">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {article.category && <span className="bg-primary/15 px-2 py-0.5 text-primary">{article.category}</span>}
          {article.published_date && <span>{formatDate(article.published_date)}</span>}
          <span>{minutes} min read</span>
        </div>
        <h1 className="pt-2 font-display text-2xl font-bold uppercase leading-tight tracking-wide">
          {article.title}
        </h1>
        {article.author && (
          <p className="pt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            By {article.author}
          </p>
        )}
        <div className="space-y-4 pb-8 pt-5 leading-relaxed text-foreground/90" style={{ fontSize: `${textScale}rem` }}>
          {String(article.body || "")
            .split("\n\n")
            .filter((para) => para.trim() !== "")
            .map((para, idx) => (
              <p key={idx} className="whitespace-pre-wrap">{para}</p>
            ))}
        </div>
      </div>
    </article>
  );
}
