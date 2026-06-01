import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Trash2, Save, Newspaper, Plus, ChevronDown, Calendar,
  User, Eye, EyeOff, Pencil, X, ImageIcon, FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ImageField from "./ImageField";

const emptyArticle = { title: "", body: "", image_url: "", published_date: new Date().toISOString().slice(0, 10), author: "RLT Vegas", is_published: true };

/* ─── Inline label wrapper ──────────────────────────────── */
function FieldLabel({ label, children, className = "" }) {
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

/* ─── Article Preview Card ──────────────────────────────── */
function ArticleCard({ article, index, updateMutation, deleteMutation }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const formattedDate = article.published_date
    ? new Date(article.published_date + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
    : "No date";

  const bodyPreview = article.body?.length > 140
    ? article.body.slice(0, 140) + "…"
    : article.body;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: "easeOut" }}
      layout
      className="group relative overflow-hidden border border-border bg-card/60 cmd-glass hover:border-primary/20 transition-all duration-300"
    >
      {/* Top accent line */}
      <div className={`h-[2px] w-full ${article.is_published !== false ? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" : "bg-gradient-to-r from-muted-foreground/40 via-muted-foreground/20 to-muted-foreground/40"}`} />

      {/* Scanning overlay on hover */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent cmd-scan-line" />
      </div>

      {editing ? (
        /* ── Edit Mode ── */
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Pencil className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary font-mono">
                Editing Article
              </span>
            </div>
            <button
              onClick={() => setEditing(false)}
              className="flex h-11 w-11 items-center justify-center border border-border/50 hover:border-primary/30 hover:text-primary transition-colors"
              title="Close editor"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FieldLabel label="Title">
              <Input defaultValue={article.title || ""} onBlur={(e) => updateMutation.mutate({ id: article.id, data: { title: e.target.value } })} className="h-11 rounded-none" />
            </FieldLabel>
            <FieldLabel label="Published Date">
              <Input type="date" defaultValue={article.published_date || ""} onBlur={(e) => updateMutation.mutate({ id: article.id, data: { published_date: e.target.value } })} className="h-11 rounded-none" />
            </FieldLabel>
            <FieldLabel label="Author">
              <Input defaultValue={article.author || ""} onBlur={(e) => updateMutation.mutate({ id: article.id, data: { author: e.target.value } })} className="h-11 rounded-none" />
            </FieldLabel>
            <div className="flex items-end gap-3 pb-1">
              <FieldLabel label="Published">
                <div className="flex items-center gap-2 h-10">
                  <Switch checked={article.is_published !== false} onCheckedChange={(value) => updateMutation.mutate({ id: article.id, data: { is_published: value } })} />
                  <span className="text-xs text-muted-foreground">
                    {article.is_published !== false ? "Live" : "Draft"}
                  </span>
                </div>
              </FieldLabel>
            </div>
            <ImageField label="Article image" value={article.image_url} onChange={(url) => updateMutation.mutate({ id: article.id, data: { image_url: url } })} className="md:col-span-2" />
            <FieldLabel label="Article Body" className="md:col-span-2">
              <Textarea defaultValue={article.body || ""} onBlur={(e) => updateMutation.mutate({ id: article.id, data: { body: e.target.value } })} className="min-h-24 rounded-none" />
            </FieldLabel>
          </div>
        </div>
      ) : (
        /* ── Preview Mode ── */
        <div className="flex flex-col md:flex-row">
          {/* Image thumbnail */}
          {article.image_url ? (
            <div className="relative w-full md:w-48 h-40 md:h-auto shrink-0 overflow-hidden bg-secondary">
              <img
                src={article.image_url}
                alt={article.title || "Article"}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent md:bg-gradient-to-r" />
            </div>
          ) : (
            <div className="hidden md:flex w-48 shrink-0 items-center justify-center bg-muted/20 border-r border-border/40">
              <ImageIcon className="h-8 w-8 text-muted-foreground/20" />
            </div>
          )}

          <div className="flex-1 p-5">
            {/* Title & badges row */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-xl uppercase leading-tight text-foreground truncate">
                  {article.title || "Untitled Article"}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {/* Status indicator */}
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider border ${
                    article.is_published !== false
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      : "text-muted-foreground bg-muted/20 border-border/40"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${article.is_published !== false ? "bg-emerald-400 cmd-blink" : "bg-muted-foreground"}`} />
                    {article.is_published !== false ? "Published" : "Draft"}
                  </span>

                  {/* Date badge */}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono text-muted-foreground bg-muted/20 border border-border/40">
                    <Calendar className="h-2.5 w-2.5" />
                    {formattedDate}
                  </span>

                  {/* Author badge */}
                  {article.author && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono text-muted-foreground bg-muted/20 border border-border/40">
                      <User className="h-2.5 w-2.5" />
                      {article.author}
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setEditing(true)}
                  className="flex h-11 w-11 items-center justify-center border border-border/50 hover:border-primary/30 hover:text-primary transition-colors text-muted-foreground"
                  title="Edit article"
                >
                  <Pencil className="h-4 w-4" />
                </button>

                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex h-11 w-11 items-center justify-center border border-border/50 hover:border-destructive/30 hover:text-destructive transition-colors text-muted-foreground"
                    title="Delete article"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => deleteMutation.mutate(article.id)}
                      className="min-h-11 px-3 py-2 text-[10px] font-bold uppercase tracking-wider bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="flex h-11 w-11 items-center justify-center border border-border/50 hover:border-border text-muted-foreground transition-colors"
                      title="Cancel delete"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Body preview */}
            {article.body && (
              <div className="mt-3 border-t border-border/30 pt-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {expanded ? article.body : bodyPreview}
                </p>
                {article.body?.length > 140 && (
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
                  >
                    {expanded ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {expanded ? "Show less" : "Read more"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ─── Main NewsManager ──────────────────────────────────── */
export default function NewsManager({ articles }) {
  const [draft, setDraft] = useState(emptyArticle);
  const [formOpen, setFormOpen] = useState(false);
  const queryClient = useQueryClient();

  const createMutation = useMutation({ mutationFn: (data) => base44.entities.NewsArticle.create(data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["news"] }); setDraft(emptyArticle); setFormOpen(false); } });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.NewsArticle.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["news"] }) });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.NewsArticle.update(id, data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["news"] }) });

  const publishedCount = articles.filter((a) => a.is_published !== false).length;
  const draftCount = articles.length - publishedCount;

  return (
    <section id="news-admin" className="scroll-mt-28 grid gap-5">
      {/* ── Section Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden border border-border bg-card/60 cmd-glass"
      >
        <div className="cmd-accent-bar h-[2px] w-full" />
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Newspaper className="h-4 w-4 text-primary" />
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-primary font-mono">
              Content Manager
            </p>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl md:text-4xl uppercase leading-none tracking-wide">
                News Articles
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create, edit and manage news content for the public site.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Count badges */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/5 border border-primary/10 text-[10px] font-bold uppercase tracking-wider text-primary">
                <FileText className="h-3 w-3" />
                {articles.length} Total
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/5 border border-emerald-500/10 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 cmd-blink" />
                {publishedCount} Published
              </span>
              {draftCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted/20 border border-border/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {draftCount} Draft
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Collapsible "Add New" Form ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35 }}
        className="overflow-hidden border border-border bg-card/60 cmd-glass"
      >
        <button
          onClick={() => setFormOpen(!formOpen)}
          className="w-full flex items-center justify-between p-5 hover:bg-muted/10 transition-colors group/toggle"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 border border-primary/20 bg-primary/5">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold uppercase tracking-wider text-foreground">
                Add New Article
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Create a new news article for the public site
              </p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: formOpen ? 180 : 0 }}
            transition={{ duration: 0.25 }}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground group-hover/toggle:text-foreground transition-colors" />
          </motion.div>
        </button>

        <AnimatePresence>
          {formOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="border-t border-border/50 p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldLabel label="Title">
                    <Input placeholder="Article title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="h-11 rounded-none" />
                  </FieldLabel>
                  <FieldLabel label="Published Date">
                    <Input type="date" value={draft.published_date} onChange={(e) => setDraft({ ...draft, published_date: e.target.value })} className="h-11 rounded-none" />
                  </FieldLabel>
                  <FieldLabel label="Author">
                    <Input placeholder="Author name" value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} className="h-11 rounded-none" />
                  </FieldLabel>
                  <FieldLabel label="Status">
                    <div className="flex items-center gap-3 h-10">
                      <Switch checked={draft.is_published} onCheckedChange={(val) => setDraft({ ...draft, is_published: val })} />
                      <span className="text-xs text-muted-foreground">
                        {draft.is_published ? "Publish immediately" : "Save as draft"}
                      </span>
                    </div>
                  </FieldLabel>
                  <ImageField label="Article image" value={draft.image_url} onChange={(url) => setDraft({ ...draft, image_url: url })} className="md:col-span-2" />
                  <FieldLabel label="Article Body" className="md:col-span-2">
                    <Textarea placeholder="Write the article body…" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="min-h-28 rounded-none" />
                  </FieldLabel>
                  <div className="md:col-span-2">
                    <Button
                      size="mobile"
                      onClick={() => createMutation.mutate(draft)}
                      disabled={!draft.title || createMutation.isPending}
                      className="rounded-none bg-primary hover:bg-primary/90 w-full sm:w-auto"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {createMutation.isPending ? "Saving…" : "Publish Article"}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Articles List ── */}
      {articles.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="border border-border/60 bg-card/30 cmd-glass py-16 flex flex-col items-center justify-center text-center"
        >
          <div className="p-4 border border-border/30 bg-muted/10 mb-4">
            <Newspaper className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <p className="text-sm font-bold text-muted-foreground mb-1">No articles yet</p>
          <p className="text-xs text-muted-foreground/60 max-w-xs">
            Click "Add New Article" above to create your first news story.
          </p>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {articles.map((article, i) => (
              <ArticleCard
                key={article.id}
                article={article}
                index={i}
                updateMutation={updateMutation}
                deleteMutation={deleteMutation}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
