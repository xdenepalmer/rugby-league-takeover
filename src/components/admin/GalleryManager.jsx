import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Images } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImageField from "./ImageField";
import MediaUploader from "./MediaUploader";

const empty = { title: "", media_type: "photo", media_url: "", embed_url: "", thumbnail_url: "", event_label: "", sort_order: 1, is_published: true };

export default function GalleryManager({ items = [] }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(empty);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["gallery"] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.GalleryItem.create(data),
    onSuccess: () => { refresh(); setDraft(empty); toast({ title: "Gallery item added" }); },
  });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.GalleryItem.update(id, data), onSuccess: refresh });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.GalleryItem.delete(id), onSuccess: () => { refresh(); toast({ title: "Item removed" }); } });

  const sorted = [...items].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  return (
    <section className="scroll-mt-28 border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 font-display text-3xl uppercase"><Images className="h-6 w-6 text-primary" /> Gallery</h2>
      <p className="mt-2 text-sm text-muted-foreground">Upload photos, videos or paste YouTube / Facebook links from previous events.</p>

      {/* Add form */}
      <div className="mt-5 grid gap-3 border border-border bg-background/40 p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Plus className="h-4 w-4" /> Add item</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Title / caption (optional)" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="rounded-none" />
          <Select value={draft.media_type} onValueChange={(v) => setDraft({ ...draft, media_type: v })}>
            <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="photo">Photo</SelectItem>
              <SelectItem value="video">Video (upload)</SelectItem>
              <SelectItem value="youtube">YouTube link</SelectItem>
              <SelectItem value="facebook">Facebook link</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(draft.media_type === "photo") && (
          <ImageField label="Photo" value={draft.media_url} onChange={(url) => setDraft({ ...draft, media_url: url })} />
        )}
        {(draft.media_type === "video") && (
          <div className="space-y-2">
            <MediaUploader label="Upload video" accept="video/*" onUploaded={(url) => setDraft({ ...draft, media_url: url })} />
            {draft.media_url && <p className="text-[10px] text-emerald-400 font-mono truncate">✓ {draft.media_url}</p>}
          </div>
        )}
        {(draft.media_type === "youtube" || draft.media_type === "facebook") && (
          <Input placeholder={draft.media_type === "youtube" ? "https://www.youtube.com/watch?v=..." : "https://www.facebook.com/video/..."} value={draft.embed_url} onChange={(e) => setDraft({ ...draft, embed_url: e.target.value })} className="rounded-none font-mono text-xs" />
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <Input placeholder="Event label (e.g. Las Vegas 2024)" value={draft.event_label} onChange={(e) => setDraft({ ...draft, event_label: e.target.value })} className="rounded-none md:col-span-2" />
          <Input type="number" placeholder="Sort order" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="rounded-none" />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">Published <Switch checked={draft.is_published !== false} onCheckedChange={(v) => setDraft({ ...draft, is_published: v })} /></label>
          <Button size="mobile" onClick={() => createMutation.mutate(draft)} disabled={(!draft.media_url && !draft.embed_url) || createMutation.isPending} className="ml-auto rounded-none bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Add to Gallery
          </Button>
        </div>
      </div>

      {/* Existing items */}
      <div className="mt-6 grid gap-4">
        {sorted.length === 0 && <p className="text-sm text-muted-foreground">No gallery items yet. Add your first one above.</p>}
        {sorted.map((item) => (
          <div key={item.id} className="grid gap-3 border border-border p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_130px_100px]">
              <Input defaultValue={item.title || ""} placeholder="Title" onBlur={(e) => updateMutation.mutate({ id: item.id, data: { title: e.target.value } })} className="rounded-none" />
              <Input defaultValue={item.event_label || ""} placeholder="Event label" onBlur={(e) => updateMutation.mutate({ id: item.id, data: { event_label: e.target.value } })} className="rounded-none" />
              <Input type="number" defaultValue={item.sort_order ?? 1} onBlur={(e) => updateMutation.mutate({ id: item.id, data: { sort_order: Number(e.target.value) } })} className="rounded-none" />
            </div>
            <div className="text-[10px] font-mono text-muted-foreground truncate">
              <span className="font-bold uppercase text-slate-300">{item.media_type}</span>
              {" · "}
              {item.media_url || item.embed_url || "no URL"}
            </div>
            <div className="flex items-center gap-4 border-t border-border pt-3">
              <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                Published <Switch checked={item.is_published !== false} onCheckedChange={(v) => updateMutation.mutate({ id: item.id, data: { is_published: v } })} />
              </label>
              <Button variant="destructive" size="sm" className="ml-auto rounded-none" onClick={() => deleteMutation.mutate(item.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}