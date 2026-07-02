import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Images, Camera, Film, Eye, EyeOff, ExternalLink } from "lucide-react";

const YoutubeIcon = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1C4.5 20.5 12 20.5 12 20.5s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/></svg>;
const FacebookIcon = ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07z"/></svg>;
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImageField from "./ImageField";
import MediaUploader from "./MediaUploader";

const empty = {
  title: "", media_type: "photo", media_url: "", embed_url: "",
  thumbnail_url: "", event_label: "", sort_order: 1, is_published: true,
};

function getYoutubeId(url) {
  const match = url?.match(/(?:v=|youtu\.be\/|embed\/)([^&?/]+)/);
  return match ? match[1] : null;
}

const TYPE_META = {
  photo:    { icon: Camera,       label: "Photo",    color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30" },
  video:    { icon: Film,         label: "Video",    color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/30" },
  youtube:  { icon: YoutubeIcon,  label: "YouTube",  color: "text-red-400",     bg: "bg-red-400/10 border-red-400/30" },
  facebook: { icon: FacebookIcon, label: "Facebook", color: "text-blue-500",    bg: "bg-blue-500/10 border-blue-500/30" },
};

function TypeBadge({ type }) {
  const m = TYPE_META[type] || { icon: Images, label: type, color: "text-muted-foreground", bg: "bg-muted/20 border-border" };
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${m.bg} ${m.color}`}>
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}

function ItemPreview({ item }) {
  if (item.media_type === "photo" && item.media_url) {
    return <img src={item.media_url} alt="" className="h-full w-full object-cover" />;
  }
  if (item.media_type === "youtube" && item.embed_url) {
    const id = getYoutubeId(item.embed_url);
    if (id) return <img src={`https://img.youtube.com/vi/${id}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" />;
  }
  if (item.thumbnail_url) {
    return <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />;
  }
  const m = TYPE_META[item.media_type] || { icon: Images, color: "text-muted-foreground/30" };
  const Icon = m.icon;
  return (
    <div className={`flex h-full w-full items-center justify-center ${m.color}`}>
      <Icon className="h-8 w-8 stroke-1" />
    </div>
  );
}

export default function GalleryManager({ items = [] }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(empty);
  const [expandedId, setExpandedId] = useState(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["gallery"] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.GalleryItem.create(data),
    onSuccess: () => { refresh(); setDraft(empty); toast({ title: "Gallery item added" }); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.GalleryItem.update(id, data),
    onSuccess: refresh,
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.GalleryItem.delete(id),
    onSuccess: () => { refresh(); toast({ title: "Item removed" }); },
  });

  const sorted = [...items].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  // Derive unique event labels for the summary
  const eventGroups = sorted.reduce((acc, item) => {
    const key = item.event_label || "Unlabelled";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <section className="grid gap-6">
      {/* Stats row */}
      {sorted.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <span className="border border-border bg-card/40 px-3 py-1.5 text-xs font-mono font-bold text-muted-foreground">
            {sorted.length} items total
          </span>
          {Object.entries(eventGroups).map(([label, count]) => (
            <span key={label} className="border border-border bg-card/40 px-3 py-1.5 text-xs font-mono font-bold text-primary">
              {label} · {count}
            </span>
          ))}
          <span className="border border-border bg-card/40 px-3 py-1.5 text-xs font-mono font-bold text-emerald-400">
            {sorted.filter(i => i.is_published !== false).length} published
          </span>
        </div>
      )}

      {/* ── Add Form ── */}
      <div className="border border-border bg-card/40 p-5">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-primary mb-4">
          <Plus className="h-4 w-4" /> Add Gallery Item
        </p>

        <div className="grid gap-4">
          {/* Row 1: Title + Type */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Title / caption (optional)"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="rounded-none"
            />
            <Select value={draft.media_type} onValueChange={(v) => setDraft({ ...draft, media_type: v, media_url: "", embed_url: "" })}>
              <SelectTrigger className="rounded-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="photo">📷 Photo</SelectItem>
                <SelectItem value="video">🎬 Video (upload)</SelectItem>
                <SelectItem value="youtube">▶️ YouTube link</SelectItem>
                <SelectItem value="facebook">📘 Facebook link</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Row 2: Media input */}
          {draft.media_type === "photo" && (
            <ImageField label="Photo" value={draft.media_url} onChange={(url) => setDraft({ ...draft, media_url: url })} />
          )}
          {draft.media_type === "video" && (
            <div className="space-y-2">
              <MediaUploader label="Upload video" accept="video/*" onUploaded={(url) => setDraft({ ...draft, media_url: url })} />
              {draft.media_url && (
                <p className="text-[10px] text-emerald-400 font-mono truncate flex items-center gap-1">
                  ✓ Uploaded: {draft.media_url.split("/").pop()}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">Or paste a direct video URL:</p>
              <Input
                placeholder="https://..."
                value={draft.media_url}
                onChange={(e) => setDraft({ ...draft, media_url: e.target.value })}
                className="rounded-none font-mono text-xs"
              />
            </div>
          )}
          {(draft.media_type === "youtube" || draft.media_type === "facebook") && (
            <div className="space-y-2">
              <Input
                placeholder={draft.media_type === "youtube"
                  ? "https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  : "https://www.facebook.com/video/... or share URL"}
                value={draft.embed_url}
                onChange={(e) => setDraft({ ...draft, embed_url: e.target.value })}
                className="rounded-none font-mono text-xs"
              />
              {draft.media_type === "youtube" && draft.embed_url && getYoutubeId(draft.embed_url) && (
                <img
                  src={`https://img.youtube.com/vi/${getYoutubeId(draft.embed_url)}/mqdefault.jpg`}
                  alt="YouTube thumbnail preview"
                  className="h-24 w-auto border border-border object-cover"
                />
              )}
            </div>
          )}

          {/* Row 3: Event label + sort */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              placeholder="Event label (e.g. Las Vegas 2024)"
              value={draft.event_label}
              onChange={(e) => setDraft({ ...draft, event_label: e.target.value })}
              className="rounded-none sm:col-span-2"
            />
            <Input
              type="number"
              placeholder="Sort order"
              value={draft.sort_order}
              onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
              className="rounded-none"
            />
          </div>

          {/* Row 4: Published + submit */}
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <Switch
                checked={draft.is_published !== false}
                onCheckedChange={(v) => setDraft({ ...draft, is_published: v })}
              />
              Published
            </label>
            <Button
              size="mobile"
              onClick={() => createMutation.mutate(draft)}
              disabled={(!draft.media_url && !draft.embed_url) || createMutation.isPending}
              className="ml-auto rounded-none bg-primary hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              {createMutation.isPending ? "Adding…" : "Add to Gallery"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Existing Items ── */}
      <div className="grid gap-3">
        {sorted.length === 0 && (
          <div className="border border-border bg-card/20 py-12 text-center">
            <Images className="mx-auto h-10 w-10 text-muted-foreground/20 stroke-1 mb-3" />
            <p className="text-sm text-muted-foreground">No gallery items yet. Add your first one above.</p>
          </div>
        )}

        {sorted.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <div
              key={item.id}
              className={`border transition-colors ${item.is_published === false ? "border-border/40 opacity-60" : "border-border"} bg-card/30`}
            >
              {/* Collapsed row */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/10 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                {/* Thumbnail */}
                <div className="h-14 w-20 shrink-0 overflow-hidden border border-border bg-muted/20">
                  <ItemPreview item={item} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <TypeBadge type={item.media_type} />
                    {item.event_label && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-primary">{item.event_label}</span>
                    )}
                    {item.is_published === false && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5">Draft</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-bold text-foreground truncate">
                    {item.title || <span className="text-muted-foreground italic">No title</span>}
                  </p>
                </div>

                {/* Quick toggles */}
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => updateMutation.mutate({ id: item.id, data: { is_published: !item.is_published } })}
                    className={`flex h-9 w-9 items-center justify-center border transition-all ${item.is_published !== false ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "border-border bg-muted/10 text-muted-foreground hover:text-foreground"}`}
                    title={item.is_published !== false ? "Hide" : "Publish"}
                  >
                    {item.is_published !== false ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(item.id)}
                    disabled={deleteMutation.isPending}
                    className="flex h-9 w-9 items-center justify-center border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Expanded edit form */}
              {isExpanded && (
                <div className="border-t border-border/60 p-4 grid gap-3 bg-background/30">
                  <div className="grid gap-3 sm:grid-cols-[1fr_160px_100px]">
                    <Input
                      defaultValue={item.title || ""}
                      placeholder="Title / caption"
                      onBlur={(e) => updateMutation.mutate({ id: item.id, data: { title: e.target.value } })}
                      className="rounded-none"
                    />
                    <Input
                      defaultValue={item.event_label || ""}
                      placeholder="Event label"
                      onBlur={(e) => updateMutation.mutate({ id: item.id, data: { event_label: e.target.value } })}
                      className="rounded-none"
                    />
                    <Input
                      type="number"
                      defaultValue={item.sort_order ?? 1}
                      onBlur={(e) => updateMutation.mutate({ id: item.id, data: { sort_order: Number(e.target.value) } })}
                      className="rounded-none"
                    />
                  </div>

                  {/* Show URL with copy link */}
                  <div className="flex items-center gap-2 border border-border/40 bg-background/20 px-3 py-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">URL</span>
                    <p className="text-[10px] font-mono text-muted-foreground truncate flex-1">
                      {item.media_url || item.embed_url || "—"}
                    </p>
                    {(item.media_url || item.embed_url) && (
                      <a
                        href={item.media_url || item.embed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}