import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, X, Upload, CalendarPlus, Ticket, Save } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const emptyEvent = {
  title: "", event_date: "", start_time: "", location: "", address: "", blurb: "",
  ticket_url: "", tickets: [], photo_urls: [], is_coming_soon: true, is_published: true, sort_order: 1,
};
const emptyTicket = { name: "", price_aud: 0, url: "", note: "", sold_out: false };

function PhotoUploader({ onUploaded }) {
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
      <Input type="file" accept="image/*" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} className="rounded-none" />
      <span className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground"><Upload className="h-3 w-3" /> {uploading ? "Uploading…" : "Add photo"}</span>
    </div>
  );
}

function PhotoGrid({ urls, onRemove }) {
  if (!urls?.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {urls.map((url) => (
        <div key={url} className="group relative">
          <img src={url} alt="Event" className="h-20 w-full border border-border object-cover" />
          <button type="button" onClick={() => onRemove(url)} className="absolute right-1 top-1 bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"><X className="h-3 w-3" /></button>
        </div>
      ))}
    </div>
  );
}

function TicketsEditor({ tickets = [], onChange }) {
  const update = (i, patch) => onChange(tickets.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  return (
    <div className="grid gap-2 border border-border bg-background/40 p-3">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Ticket className="h-4 w-4" /> Ticket options (external links)</p>
      {tickets.length === 0 && <p className="text-xs text-muted-foreground">No ticket tiers yet. Add one to show a "Buy tickets" button.</p>}
      {tickets.map((ticket, i) => (
        <div key={i} className="grid items-center gap-2 md:grid-cols-[1.2fr_90px_2fr_auto_auto]">
          <Input placeholder="Tier name (e.g. VIP)" value={ticket.name || ""} onChange={(e) => update(i, { name: e.target.value })} className="rounded-none" />
          <Input type="number" placeholder="Price" value={ticket.price_aud ?? ""} onChange={(e) => update(i, { price_aud: Number(e.target.value) })} className="rounded-none" />
          <Input placeholder="https://tickets..." value={ticket.url || ""} onChange={(e) => update(i, { url: e.target.value })} className="rounded-none" />
          <label className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">Sold out <Switch checked={ticket.sold_out === true} onCheckedChange={(v) => update(i, { sold_out: v })} /></label>
          <Button type="button" variant="ghost" size="icon" className="rounded-none" onClick={() => onChange(tickets.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit rounded-none" onClick={() => onChange([...tickets, { ...emptyTicket }])}>
        <Plus className="mr-2 h-4 w-4" /> Add ticket tier
      </Button>
    </div>
  );
}

function EventFields({ draft, setDraft }) {
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Input placeholder="Event title" value={draft.title || ""} onChange={(e) => set({ title: e.target.value })} className="rounded-none" />
        <Input type="number" placeholder="Sort order" value={draft.sort_order ?? 1} onChange={(e) => set({ sort_order: Number(e.target.value) })} className="rounded-none" />
        <Input type="datetime-local" value={draft.event_date || ""} onChange={(e) => set({ event_date: e.target.value })} className="rounded-none" />
        <Input placeholder="Display time (e.g. Doors 6pm)" value={draft.start_time || ""} onChange={(e) => set({ start_time: e.target.value })} className="rounded-none" />
        <Input placeholder="Venue name" value={draft.location || ""} onChange={(e) => set({ location: e.target.value })} className="rounded-none" />
        <Input placeholder="Address" value={draft.address || ""} onChange={(e) => set({ address: e.target.value })} className="rounded-none" />
      </div>
      <Textarea placeholder="Description" value={draft.blurb || ""} onChange={(e) => set({ blurb: e.target.value })} className="min-h-24 rounded-none" />
      <Input placeholder="Fallback ticket/info link (used if no tiers below)" value={draft.ticket_url || ""} onChange={(e) => set({ ticket_url: e.target.value })} className="rounded-none" />
      <TicketsEditor tickets={draft.tickets || []} onChange={(tickets) => set({ tickets })} />
      <PhotoUploader onUploaded={(url) => set({ photo_urls: [...(draft.photo_urls || []), url] })} />
      <PhotoGrid urls={draft.photo_urls} onRemove={(url) => set({ photo_urls: (draft.photo_urls || []).filter((u) => u !== url) })} />
      <div className="flex flex-wrap items-center gap-5">
        <label className="flex items-center gap-2 text-sm">Coming soon <Switch checked={draft.is_coming_soon !== false} onCheckedChange={(v) => set({ is_coming_soon: v })} /></label>
        <label className="flex items-center gap-2 text-sm">Published <Switch checked={draft.is_published !== false} onCheckedChange={(v) => set({ is_published: v })} /></label>
      </div>
    </div>
  );
}

function EventRow({ event, onSave, onDelete, saving }) {
  const [draft, setDraft] = useState(event);
  useEffect(() => { setDraft(event); }, [event.id]);
  return (
    <div className="grid gap-3 border border-border p-4">
      <EventFields draft={draft} setDraft={setDraft} />
      <div className="flex items-center gap-3 border-t border-border pt-3">
        <Button onClick={() => onSave(draft)} disabled={saving} className="rounded-none bg-primary hover:bg-primary/90"><Save className="mr-2 h-4 w-4" /> Save changes</Button>
        <Button variant="destructive" size="sm" className="ml-auto rounded-none" onClick={() => onDelete(event.id)}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
      </div>
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
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.EventContent.update(id, data), onSuccess: () => { refresh(); toast({ title: "Event saved" }); } });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.EventContent.delete(id), onSuccess: () => { refresh(); toast({ title: "Event removed" }); } });

  const sorted = [...events].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  return (
    <section id="events-admin" className="scroll-mt-28 border border-border bg-card p-6">
      <h2 className="font-display text-4xl uppercase">Events</h2>
      <p className="mt-2 text-sm text-muted-foreground">Create unlimited events, each with its own date, venue, photos, description and external ticket links (multiple tiers supported).</p>

      <div className="mt-6 grid gap-3 border border-border bg-background/40 p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><CalendarPlus className="h-4 w-4" /> Add a new event</p>
        <EventFields draft={draft} setDraft={setDraft} />
        <Button onClick={() => createMutation.mutate(draft)} disabled={!draft.title || createMutation.isPending} className="w-fit rounded-none bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Add event
        </Button>
      </div>

      <div className="mt-8 grid gap-4">
        {sorted.length === 0 && <p className="text-sm text-muted-foreground">No events yet. Add your first one above.</p>}
        {sorted.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            saving={updateMutation.isPending}
            onSave={(data) => updateMutation.mutate({ id: event.id, data })}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        ))}
      </div>
    </section>
  );
}
