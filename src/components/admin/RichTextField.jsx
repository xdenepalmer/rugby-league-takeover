import React, { useRef, useState } from "react";
import { Bold, Italic, Heading2, Heading3, List, Link2, ImagePlus, Eye, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { MarkdownBody } from "@/lib/markdown";

/**
 * Formatting toolbar over a plain textarea, writing the same lightweight
 * markdown the public article renderer understands (src/lib/markdown.jsx).
 *
 * Deliberately not a WYSIWYG/contentEditable editor: the stored value stays
 * plain text, so nothing can inject HTML into a public page, existing articles
 * keep working untouched, and what the author types is exactly what is saved.
 *
 * Buttons operate on the current selection and put the caret back where the
 * author expects it, so it behaves like a normal editor rather than appending
 * syntax at the end.
 */
export default function RichTextField({ value, onChange, placeholder = "Write the article…", minHeight = "min-h-48" }) {
  const ref = useRef(null);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);

  const text = value || "";

  // Replace [start,end) with next, then restore the caret to caretOffset.
  const apply = (start, end, next, caretOffset) => {
    const updated = text.slice(0, start) + next + text.slice(end);
    onChange(updated);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const pos = start + caretOffset;
      el.setSelectionRange(pos, pos);
    });
  };

  // Wrap the selection in a marker (bold/italic). With no selection, drop the
  // markers in and place the caret between them so typing continues inside.
  const wrap = (marker, sampleText) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = text.slice(s, e);
    if (selected) {
      apply(s, e, `${marker}${selected}${marker}`, marker.length + selected.length + marker.length);
    } else {
      apply(s, e, `${marker}${sampleText}${marker}`, marker.length);
    }
  };

  // Prefix every line of the selection (headings, list items).
  const prefixLines = (prefix) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const lineStart = text.lastIndexOf("\n", s - 1) + 1;
    const lineEnd = text.indexOf("\n", e) === -1 ? text.length : text.indexOf("\n", e);
    const chunk = text.slice(lineStart, lineEnd) || "Text";
    const next = chunk
      .split("\n")
      .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
      .join("\n");
    // Headings and lists are block-level: make sure a blank line precedes them
    // or the renderer folds them into the paragraph above.
    const needsGap = lineStart > 0 && text[lineStart - 1] === "\n" && text[lineStart - 2] !== "\n";
    const prefixed = needsGap ? `\n${next}` : next;
    apply(lineStart, lineEnd, prefixed, prefixed.length);
  };

  const insertBlock = (block) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s } = el;
    const before = text.slice(0, s);
    const gap = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
    const payload = `${gap}${block}\n\n`;
    apply(s, s, payload, payload.length);
  };

  const addLink = () => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = text.slice(s, e) || "link text";
    const snippet = `[${selected}](https://)`;
    // Caret lands inside the (…) ready for the URL.
    apply(s, e, snippet, snippet.length - 1);
  };

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (!file_url) throw new Error("Upload returned no URL");
      insertBlock(`![${file.name.replace(/\.[^.]+$/, "")}](${file_url})`);
      toast({ title: "Photo added to the article" });
    } catch (err) {
      toast({ title: "Upload failed", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const Btn = ({ onClick, title, children, disabled }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className="flex h-8 min-w-8 items-center justify-center gap-1 border border-border/70 px-2 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-40"
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Btn onClick={() => wrap("**", "bold text")} title="Bold"><Bold className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => wrap("*", "italic text")} title="Italic"><Italic className="h-3.5 w-3.5" /></Btn>
        <span className="mx-1 h-5 w-px bg-border/70" aria-hidden="true" />
        <Btn onClick={() => prefixLines("## ")} title="Large heading"><Heading2 className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => prefixLines("### ")} title="Small heading"><Heading3 className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => prefixLines("- ")} title="Bullet list"><List className="h-3.5 w-3.5" /></Btn>
        <span className="mx-1 h-5 w-px bg-border/70" aria-hidden="true" />
        <Btn onClick={addLink} title="Insert link"><Link2 className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => fileRef.current?.click()} title="Add photo" disabled={uploading}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          <span className="text-[9px] font-bold uppercase tracking-widest">{uploading ? "Uploading" : "Photo"}</span>
        </Btn>
        <span className="mx-1 h-5 w-px bg-border/70" aria-hidden="true" />
        <Btn onClick={() => setPreview((p) => !p)} title="Toggle preview">
          <Eye className="h-3.5 w-3.5" />
          <span className="text-[9px] font-bold uppercase tracking-widest">{preview ? "Edit" : "Preview"}</span>
        </Btn>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => upload(e.target.files?.[0])}
        />
      </div>

      {preview ? (
        <div className={`${minHeight} overflow-y-auto border border-border/70 bg-background/40 p-4`}>
          {text.trim() ? (
            <MarkdownBody text={text} />
          ) : (
            <p className="text-sm italic text-muted-foreground">Nothing to preview yet.</p>
          )}
        </div>
      ) : (
        <Textarea
          ref={ref}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${minHeight} rounded-none font-mono text-sm leading-6`}
        />
      )}

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Select text then hit a button, or type directly: <code>**bold**</code>, <code>*italic*</code>,{" "}
        <code>## Heading</code>, <code>- list item</code>. Blank line between paragraphs.
      </p>
    </div>
  );
}
