import React from "react";
import { safeUserHref } from "@/lib/safe-url";

/**
 * Lightweight markdown-to-React renderer (zero npm dependencies).
 * XSS-safe: builds React elements directly, never uses dangerouslySetInnerHTML.
 *
 * Supported syntax:
 *   **bold**  *italic*  `inline code`  ~~strikethrough~~
 *   [link text](url)  > blockquote  - / * list items
 *   ## heading  ### smaller heading  ![alt](https://image-url)
 *   Blank lines → paragraph breaks, line breaks preserved.
 */

/* ── Inline parsing ──────────────────────────────────────── */

// Order matters — process code first (so inner markers are protected),
// then links (which contain nested markers in label), then bold before
// italic (** vs *).
const INLINE_RULES = [
  // inline code (non-greedy, no nesting)
  {
    re: /`([^`]+)`/g,
    render: (m, i) => (
      <code
        key={`c${i}`}
        className="px-1.5 py-0.5 bg-muted/30 border border-border/40 text-primary text-[13px] font-mono"
      >
        {m[1]}
      </code>
    ),
  },
  // links
  {
    re: /\[([^\]]+)\]\(([^)]+)\)/g,
    render: (m, i) => {
      const href = safeUserHref(m[2]);
      if (!href) return <span key={`a${i}`}>{m[1]}</span>;
      const external = /^https?:/i.test(href);
      return (
        <a
          key={`a${i}`}
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          className="text-primary underline hover:text-primary/80"
        >
          {m[1]}
        </a>
      );
    },
  },
  // bold
  {
    re: /\*\*(.+?)\*\*/g,
    render: (m, i) => (
      <strong key={`b${i}`} className="font-bold text-foreground">
        {m[1]}
      </strong>
    ),
  },
  // strikethrough
  {
    re: /~~(.+?)~~/g,
    render: (m, i) => (
      <del key={`d${i}`} className="line-through text-muted-foreground">
        {m[1]}
      </del>
    ),
  },
  // italic (single *)
  {
    re: /\*(.+?)\*/g,
    render: (m, i) => (
      <em key={`i${i}`} className="italic">
        {m[1]}
      </em>
    ),
  },
];

let _inlineKey = 0;

function parseInline(text) {
  // Start with raw text chunks, progressively split by each rule.
  let parts = [text];

  for (const rule of INLINE_RULES) {
    const next = [];
    for (const part of parts) {
      if (typeof part !== "string") {
        next.push(part);
        continue;
      }
      let lastIndex = 0;
      const regex = new RegExp(rule.re.source, rule.re.flags);
      let match;
      while ((match = regex.exec(part)) !== null) {
        if (match.index > lastIndex) {
          next.push(part.slice(lastIndex, match.index));
        }
        next.push(rule.render(match, ++_inlineKey));
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < part.length) {
        next.push(part.slice(lastIndex));
      }
    }
    parts = next;
  }

  return parts;
}

/* ── Block parsing ───────────────────────────────────────── */

// Only http(s) images we can actually render. Anything else (javascript:,
// data:, a bare filename) is dropped rather than emitted as a broken <img>.
function safeImageSrc(raw) {
  try {
    const url = new URL(String(raw || "").trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function parseBlock(block, blockIndex) {
  const lines = block.split("\n");

  // Image on its own line: ![alt](url)
  const imageMatch = block.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
  if (imageMatch) {
    const src = safeImageSrc(imageMatch[2]);
    if (src) {
      return (
        <img
          key={`img${blockIndex}`}
          src={src}
          alt={imageMatch[1] || ""}
          loading="lazy"
          decoding="async"
          className="my-4 h-auto w-full border border-border/60 object-cover"
        />
      );
    }
  }

  // Headings: ## Big  ### Smaller. Rendered with the display face so they read
  // as section titles rather than just bigger body text.
  const headingMatch = block.trim().match(/^(#{2,3})\s+(.+)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const Tag = level === 2 ? "h2" : "h3";
    const size = level === 2 ? "text-2xl md:text-3xl" : "text-xl md:text-2xl";
    return (
      <Tag
        key={`h${blockIndex}`}
        className={`font-display uppercase tracking-wide text-foreground ${size} mt-6 mb-2 leading-tight`}
      >
        {parseInline(headingMatch[2])}
      </Tag>
    );
  }

  // Blockquote: every line starts with >
  if (lines.every((l) => l.trimStart().startsWith(">"))) {
    const inner = lines.map((l) => l.trimStart().replace(/^>\s?/, "")).join("\n");
    return (
      <blockquote
        key={`bq${blockIndex}`}
        className="border-l-2 border-primary/40 pl-3 text-muted-foreground italic my-2"
      >
        {parseInline(inner)}
      </blockquote>
    );
  }

  // Unordered list: every line starts with - or *  (followed by space)
  if (lines.every((l) => /^\s*[-*]\s/.test(l))) {
    return (
      <ul key={`ul${blockIndex}`} className="list-disc pl-5 my-2 space-y-0.5">
        {lines.map((l, li) => (
          <li key={li} className="text-[15px] leading-7 text-slate-100">
            {parseInline(l.replace(/^\s*[-*]\s/, ""))}
          </li>
        ))}
      </ul>
    );
  }

  // Paragraph — preserve line breaks within the block
  const elements = [];
  lines.forEach((line, li) => {
    if (li > 0) elements.push(<br key={`br${blockIndex}_${li}`} />);
    elements.push(...parseInline(line));
  });

  return (
    <p key={`p${blockIndex}`} className="text-[15px] leading-7 text-slate-100 my-1">
      {elements}
    </p>
  );
}

/* ── Public component ────────────────────────────────────── */

export function MarkdownBody({ text, className }) {
  if (!text) return null;

  // Reset key counter per render so React keys stay stable within a single render pass.
  _inlineKey = 0;

  // Split into blocks by blank lines (two or more newlines).
  const blocks = text.split(/\n{2,}/);

  return (
    <div className={className}>
      {blocks.map((block, i) => parseBlock(block.trim(), i))}
    </div>
  );
}

/**
 * Plain-text excerpt for teaser cards.
 *
 * Cards are line-clamped one-liners, so the raw body leaked its markup into
 * them: a list written one item per line rendered as
 * "... $50 * Bucket hat * Tote bag * Stubby Cooler ...". This strips the
 * syntax (bullets, headings, emphasis, links, images) and collapses
 * whitespace, leaving readable prose for the preview. The full article still
 * renders through MarkdownBody with all formatting intact.
 */
export function plainExcerpt(text, maxChars = 0) {
  if (!text) return "";
  const clean = String(text)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")        // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")      // links → label
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")            // headings
    .replace(/^\s*[-*]\s+/gm, "")                  // list bullets
    .replace(/^\s*>\s?/gm, "")                     // blockquotes
    .replace(/(\*\*|__)(.*?)\1/g, "$2")            // bold
    .replace(/(^|[^*])\*(?!\s)([^*]+)\*/g, "$1$2") // italic
    .replace(/~~(.*?)~~/g, "$1")                   // strikethrough
    .replace(/`([^`]*)`/g, "$1")                   // inline code
    .replace(/\s+/g, " ")
    .trim();
  if (maxChars > 0 && clean.length > maxChars) {
    return clean.slice(0, maxChars).trimEnd() + "…";
  }
  return clean;
}

export default MarkdownBody;
