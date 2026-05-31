import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, X, Upload, CalendarPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const emptyEvent = { title: "", event_date: "", location: "", blurb: "", ticket_url: "", photo_urls: [], is_coming_soon: true, is_published: true, sort_order: 1 };

function PhotoUploader({ disabled, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onUploaded(file_url);
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      <Input type="file" accept="image/*" disabled={disabled || uploading} onChange={(e) => upload(e.target.files?.[0])} className="rounded-none" />
      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Upload className="h-3 w-3" /> {uploading ? "Uploading…" : "Add photo"}</span>
    </div>
  );
}

function PhotoGrid({ urls, onRemove }) {
  if (!urls?.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {urls.map((url) => (
        <div key={url} className="group relative">
          <img src={url} alt="Event" className="h-24 w-full border border-border object-cover" />
          <button type="button" onClick={() => onRemove(url)} className="absolute right-1 top-1 bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100">
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function EventsManager({ events = [] }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyEvent);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["events"] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.EventContent.create(data),
    onSuccess: () => { refresh(); setDraft(emptyEvent); toast({ title: "Event added" }); },
  });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.EventContent.update(id, data), onSuccess: refresh });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.EventContent.delete(id), onSuccess: () => { refresh(); toast({ title: "Event removed" }); } });

  const sorted = [...events].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  return (
    <section id="events-admin" className="scroll-mt-28 border border-border bg-card p-6">
      <h2 className="font-display text-4xl uppercase">Events</h2>
      <p className="mt-2 text-sm text-muted-foreground">Add as many events as you like. Each can have its own date, location, photos, description and ticket link.</p>

      {/* New event */}
      <div className="mt-6 grid gap-3 border border-border bg-background/40 p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><CalendarPlus className="h-4 w-4" /> Add a new event</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Event title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="rounded-none" />
          <Input placeholder="Date (e.g. 28 Feb 2026 or 'End of February')" value={draft.event_date} onChange={(e) => setDraft({ ...draft, event_date: e.target.value })} className="rounded-none" />
          <Input placeholder="Location / venue" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} className="rounded-none" />
          <Input type="number" placeholder="Sort order" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="rounded-none" />
          <Input placeholder="Ticket / info link (optional)" value={draft.ticket_url} onChange={(e) => setDraft({ ...draft, ticket_url: e.target.value })} className="rounded-none md:col-span-2" />
          <Textarea placeholder="Description" value={draft.blurb} onChange={(e) => setDraft({ ...draft, blurb: e.target.value })} className="min-h-24 rounded-none md:col-span-2" />
        </div>
        <PhotoUploader onUploaded={(url) => setDraft((d) => ({ ...d, photo_urls: [...(d.photo_urls || []), url] }))} />
        <Textarea placeholder="Photo URLs, one per line" value={(draft.photo_urls || []).join("\n")} onChange={(e) => setDraft({ ...draft, photo_urls: e.target.value.split("\n").map((u) => u.trim()).filter(Boolean) })} className="min-h-16 rounded-none" />
        <PhotoGrid urls={draft.photo_urls} onRemove={(url) => setDraft((d) => ({ ...d, photo_urls: d.photo_urls.filter((u) => u !== url) }))} />
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">Coming soon <Switch checked={draft.is_coming_soon !== false} onCheckedChange={(v) => setDraft({ ...draft, is_coming_soon: v })} /></label>
          <label className="flex items-center gap-2 text-sm">Published <Switch checked={draft.is_published !== false} onCheckedChange={(v) => setDraft({ ...draft, is_published: v })} /></label>
          <Button onClick={() => createMutation.mutate(draft)} disabled={!draft.title || createMutation.isPending} className="ml-auto rounded-none bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Add event
          </Button>
        </div>
      </div>

      {/* Existing events */}
      <div className="mt-8 grid gap-4">
        {sorted.length === 0 && <p className="text-sm text-muted-foreground">No events yet. Add your first one above.</p>}
        {sorted.map((event) => (
          <div key={event.id} className="grid gap-3 border border-border p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input defaultValue={event.title || ""} onBlur={(e) => updateMutation.mutate({ id: event.id, data: { title: e.target.value } })} className="rounded-none" />
              <Input defaultValue={event.event_date || ""} placeholder="Date" onBlur={(e) => updateMutation.mutate({ id: event.id, data: { event_date: e.target.value } })} className="rounded-none" />
              <Input defaultValue={event.location || ""} placeholder="Location" onBlur={(e) => updateMutation.mutate({ id: event.id, data: { location: e.target.value } })} className="rounded-none" />
              <Input type="number" defaultValue={event.sort_order ?? 1} onBlur={(e) => updateMutation.mutate({ id: event.id, data: { sort_order: Number(e.target.value) } })} className="rounded-none" />
              <Input defaultValue={event.ticket_url || ""} placeholder="Ticket / info link" onBlur={(e) => updateMutation.mutate({ id: event.id, data: { ticket_url: e.target.value } })} className="rounded-none md:col-span-2" />
              <Textarea defaultValue={event.blurb || ""} placeholder="Description" onBlur={(e) => updateMutation.mutate({ id: event.id, data: { blurb: e.target.value } })} className="min-h-20 rounded-none md:col-span-2" />
            </div>
            <PhotoUploader onUploaded={(url) => updateMutation.mutate({ id: event.id, data: { photo_urls: [...(event.photo_urls || []), url] } })} />
            <PhotoGrid urls={event.photo_urls} onRemove={(url) => updateMutation.mutate({ id: event.id, data: { photo_urls: (event.photo_urls || []).filter((u) => u !== url) } })} />
            <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
              <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">Coming soon <Switch checked={event.is_coming_soon !== false} onCheckedChange={(v) => updateMutation.mutate({ id: event.id, data: { is_coming_soon: v } })} /></label>
              <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">Published <Switch checked={event.is_published !== false} onCheckedChange={(v) => updateMutation.mutate({ id: event.id, data: { is_published: v } })} /></label>
              <Button variant="destructive" size="sm" className="ml-auto rounded-none" onClick={() => deleteMutation.mutate(event.id)}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
