import React from "react";

/**
 * Lightweight markdown-to-React renderer (zero npm dependencies).
 * XSS-safe: builds React elements directly, never uses dangerouslySetInnerHTML.
 *
 * Supported syntax:
 *   **bold**  *italic*  `inline code`  ~~strikethrough~~
 *   [link text](url)  > blockquote  - / * list items
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
    render: (m, i) => (
      <a
        key={`a${i}`}
        href={m[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline hover:text-primary/80"
      >
        {m[1]}
      </a>
    ),
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

function parseBlock(block, blockIndex) {
  const lines = block.split("\n");

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
          <li key={li} className="text-sm">
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
    <p key={`p${blockIndex}`} className="text-sm leading-7 text-slate-200 my-1">
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

export default MarkdownBody;
