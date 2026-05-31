import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Plus, X, CalendarPlus, Ticket, Save, Calendar, MapPin, ChevronDown, Image, Eye, EyeOff, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import DateTimePicker from "./DateTimePicker";

const emptyEvent = {
  title: "", event_date: "", start_time: "", location: "", address: "", blurb: "",
  ticket_url: "", tickets: [], photo_urls: [], is_coming_soon: true, is_published: true, sort_order: 1,
};
const emptyTicket = { name: "", price_aud: 0, url: "", note: "", sold_out: false };

/* ── Labeled Field ── */
function LabeledField({ label, help, children, span2 }) {
  return (
    <div className={`space-y-1.5 ${span2 ? "md:col-span-2" : ""}`}>
      <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">{label}</label>
      {children}
      {help && <p className="text-[8px] text-muted-foreground/30">{help}</p>}
    </div>
  );
}

/* ── Photo Upload Zone ── */
function PhotoUploader({ onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
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
    <div
      className={`relative border-2 border-dashed transition-colors p-4 text-center cursor-pointer ${
        dragOver ? "border-primary/50 bg-primary/5" : "border-border/30 hover:border-border/50"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files?.[0]); }}
    >
      <input type="file" accept="image/*" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
      <div className="flex flex-col items-center gap-1">
        <div className="p-2 bg-muted/10 border border-border/20">
          {uploading ? <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Image className="h-4 w-4 text-muted-foreground/30" />}
        </div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">
          {uploading ? "Uploading…" : "Drop image or click to upload"}
        </p>
      </div>
    </div>
  );
}

/* ── Photo Grid ── */
function PhotoGrid({ urls, onRemove }) {
  if (!urls?.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {urls.map((url) => (
        <div key={url} className="group relative aspect-square overflow-hidden border border-border/30 bg-muted/5">
          <img src={url} alt="Event" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onRemove(url)}
            className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Tickets Editor ── */
function TicketsEditor({ tickets = [], onChange }) {
  const update = (i, patch) => onChange(tickets.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  return (
    <div className="border border-border/30 bg-muted/[0.03] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
          <Ticket className="h-3.5 w-3.5" /> Ticket Tiers
        </p>
        <span className="text-[8px] font-mono text-muted-foreground/30">{tickets.length} tiers</span>
      </div>

      {tickets.length === 0 && (
        <p className="text-[10px] text-muted-foreground/30 py-2">No ticket tiers yet. Add one to show a "Buy tickets" button.</p>
      )}

      {tickets.map((ticket, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="grid items-center gap-2 md:grid-cols-[1.2fr_90px_2fr_auto_auto] border-l-2 border-primary/15 pl-3 overflow-hidden"
        >
          <Input placeholder="Tier (e.g. VIP)" value={ticket.name || ""} onChange={(e) => update(i, { name: e.target.value })} className="h-8 rounded-none text-sm border-border/30" />
          <Input type="number" placeholder="$AUD" value={ticket.price_aud ?? ""} onChange={(e) => update(i, { price_aud: Number(e.target.value) })} className="h-8 rounded-none text-sm border-border/30" />
          <Input placeholder="https://tickets..." value={ticket.url || ""} onChange={(e) => update(i, { url: e.target.value })} className="h-8 rounded-none text-sm border-border/30" />
          <label className="flex items-center gap-1 text-[8px] uppercase text-muted-foreground/40 whitespace-nowrap">
            {ticket.sold_out ? <span className="text-destructive">Sold out</span> : "Available"}
            <Switch checked={ticket.sold_out === true} onCheckedChange={(v) => update(i, { sold_out: v })} className="scale-75" />
          </label>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-none text-muted-foreground/30 hover:text-destructive" onClick={() => onChange(tickets.filter((_, idx) => idx !== i))}>
            <X className="h-3 w-3" />
          </Button>
        </motion.div>
      ))}

      <Button type="button" variant="outline" size="sm" className="w-fit h-7 rounded-none text-[9px] font-bold uppercase tracking-wider border-border/30" onClick={() => onChange([...tickets, { ...emptyTicket }])}>
        <Plus className="mr-1 h-3 w-3" /> Add tier
      </Button>
    </div>
  );
}

/* ── Event Fields Form ── */
function EventFields({ draft, setDraft }) {
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <LabeledField label="Event Title">
          <Input placeholder="e.g. Official Pre-Game Party" value={draft.title || ""} onChange={(e) => set({ title: e.target.value })} className="h-9 rounded-none text-sm border-border/40" />
        </LabeledField>
        <LabeledField label="Sort Order" help="Lower numbers appear first">
          <Input type="number" value={draft.sort_order ?? 1} onChange={(e) => set({ sort_order: Number(e.target.value) })} className="h-9 rounded-none text-sm border-border/40" />
        </LabeledField>
        <LabeledField label="Date & Time">
          <DateTimePicker value={draft.event_date || ""} onChange={(val) => set({ event_date: val })} placeholder="Pick event date & time" />
        </LabeledField>
        <LabeledField label="Display Time" help="e.g. Doors 6pm, Kickoff 7:30pm">
          <Input placeholder="Doors 6pm" value={draft.start_time || ""} onChange={(e) => set({ start_time: e.target.value })} className="h-9 rounded-none text-sm border-border/40" />
        </LabeledField>
        <LabeledField label="Venue Name">
          <Input placeholder="e.g. Allegiant Stadium" value={draft.location || ""} onChange={(e) => set({ location: e.target.value })} className="h-9 rounded-none text-sm border-border/40" />
        </LabeledField>
        <LabeledField label="Address">
          <Input placeholder="3333 Al Davis Way, Las Vegas" value={draft.address || ""} onChange={(e) => set({ address: e.target.value })} className="h-9 rounded-none text-sm border-border/40" />
        </LabeledField>
      </div>

      <LabeledField label="Description" span2>
        <Textarea placeholder="Tell fans what to expect…" value={draft.blurb || ""} onChange={(e) => set({ blurb: e.target.value })} className="min-h-20 rounded-none text-sm border-border/40 resize-none" />
      </LabeledField>

      <LabeledField label="Fallback Ticket/Info Link" help="Used if no ticket tiers below" span2>
        <Input placeholder="https://..." value={draft.ticket_url || ""} onChange={(e) => set({ ticket_url: e.target.value })} className="h-9 rounded-none text-sm border-border/40" />
      </LabeledField>

      <TicketsEditor tickets={draft.tickets || []} onChange={(tickets) => set({ tickets })} />

      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Event Photos</p>
        <PhotoUploader onUploaded={(url) => set({ photo_urls: [...(draft.photo_urls || []), url] })} />
        <PhotoGrid urls={draft.photo_urls} onRemove={(url) => set({ photo_urls: (draft.photo_urls || []).filter((u) => u !== url) })} />
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <label className="inline-flex items-center gap-2 px-2.5 py-1.5 border border-border/30 bg-muted/5 cursor-pointer text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          <AlertCircle className={`h-3 w-3 ${draft.is_coming_soon !== false ? "text-amber-400" : "text-muted-foreground/30"}`} />
          Coming soon
          <Switch checked={draft.is_coming_soon !== false} onCheckedChange={(v) => set({ is_coming_soon: v })} className="scale-75" />
        </label>
        <label className="inline-flex items-center gap-2 px-2.5 py-1.5 border border-border/30 bg-muted/5 cursor-pointer text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          {draft.is_published !== false ? <Eye className="h-3 w-3 text-emerald-400" /> : <EyeOff className="h-3 w-3 text-muted-foreground/30" />}
          Published
          <Switch checked={draft.is_published !== false} onCheckedChange={(v) => set({ is_published: v })} className="scale-75" />
        </label>
      </div>
    </div>
  );
}

/* ── Event Card (Existing Item) ── */
function EventCard({ event, onSave, onDelete, saving }) {
  const [draft, setDraft] = useState(event);
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => { setDraft(event); }, [event.id]);

  const hasPhotos = (event.photo_urls || []).length > 0;
  const ticketCount = (event.tickets || []).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border/60 bg-card/30 overflow-hidden"
    >
      {/* Preview header (collapsed) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/5 transition-colors"
      >
        {/* Thumbnail */}
        <div className="h-14 w-14 shrink-0 bg-muted/10 border border-border/20 overflow-hidden flex items-center justify-center">
          {hasPhotos ? (
            <img src={event.photo_urls[0]} alt="" className="h-full w-full object-cover" />
          ) : (
            <Calendar className="h-5 w-5 text-muted-foreground/20" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            {event.is_published !== false ? (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
            )}
            <h4 className="text-sm font-bold text-foreground truncate">{event.title || "Untitled Event"}</h4>
            {event.is_coming_soon && (
              <span className="px-1 py-0 text-[7px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/15">Soon</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[9px] text-muted-foreground/40">
            {event.event_date && (
              <span className="flex items-center gap-1 font-mono">
                <Calendar className="h-2.5 w-2.5" /> {new Date(event.event_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-2.5 w-2.5" /> {event.location}
              </span>
            )}
            {ticketCount > 0 && (
              <span className="flex items-center gap-1">
                <Ticket className="h-2.5 w-2.5" /> {ticketCount} tiers
              </span>
            )}
            {hasPhotos && (
              <span className="flex items-center gap-1">
                <Image className="h-2.5 w-2.5" /> {event.photo_urls.length}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-muted-foreground/20">#{event.sort_order || 0}</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground/30 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Expanded edit form */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/20 p-4 md:p-5 space-y-4">
              <EventFields draft={draft} setDraft={setDraft} />
              <div className="flex items-center gap-3 border-t border-border/20 pt-3">
                <Button onClick={() => onSave(draft)} disabled={saving} className="h-8 rounded-none bg-primary hover:bg-primary/90 text-[9px] font-bold uppercase tracking-wider">
                  <Save className="mr-1.5 h-3 w-3" /> Save changes
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" className="h-8 rounded-none text-[9px] font-bold uppercase tracking-wider text-destructive/60 hover:text-destructive hover:bg-destructive/5" onClick={() => onDelete(event.id)}>
                  <Trash2 className="mr-1 h-3 w-3" /> Delete event
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Main EventsManager ── */
export default function EventsManager({ events = [] }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyEvent);
  const [showCreate, setShowCreate] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["events"] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.EventContent.create(data),
    onSuccess: () => { refresh(); setDraft(emptyEvent); setShowCreate(false); toast({ title: "Event added" }); },
  });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.EventContent.update(id, data), onSuccess: () => { refresh(); toast({ title: "Event saved" }); } });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.EventContent.delete(id), onSuccess: () => { refresh(); toast({ title: "Event removed" }); } });

  const sorted = [...events].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  return (
    <div className="border border-border/60 bg-card/30 cmd-glass overflow-hidden">
      <div className="h-[2px] w-full bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500" />

      <div className="p-5 md:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 border border-orange-500/20">
              <Calendar className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <h2 className="font-display text-2xl uppercase tracking-wide">Events</h2>
              <p className="text-[9px] font-mono text-muted-foreground/40">{events.length} events · {events.filter((e) => e.is_published !== false).length} published</p>
            </div>
          </div>

          <Button
            onClick={() => setShowCreate(!showCreate)}
            className={`h-8 rounded-none text-[9px] font-bold uppercase tracking-wider ${showCreate ? "bg-muted text-foreground hover:bg-muted/80" : "bg-primary hover:bg-primary/90"}`}
          >
            {showCreate ? <><X className="mr-1 h-3 w-3" /> Cancel</> : <><CalendarPlus className="mr-1 h-3 w-3" /> Add Event</>}
          </Button>
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden mb-5"
            >
              <div className="border border-primary/20 bg-primary/[0.02] p-4 md:p-5 space-y-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/60 flex items-center gap-2">
                  <CalendarPlus className="h-3 w-3" /> Create New Event
                </p>
                <EventFields draft={draft} setDraft={setDraft} />
                <Button onClick={() => createMutation.mutate(draft)} disabled={!draft.title || createMutation.isPending} className="h-9 rounded-none bg-primary hover:bg-primary/90 text-[9px] font-bold uppercase tracking-wider">
                  <Plus className="mr-1.5 h-3 w-3" /> {createMutation.isPending ? "Adding…" : "Add Event"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Event list */}
        <div className="space-y-2">
          {sorted.length === 0 && (
            <div className="border border-border/30 bg-muted/5 p-10 text-center">
              <Calendar className="h-6 w-6 mx-auto text-muted-foreground/15 mb-2" />
              <p className="text-sm text-muted-foreground/30">No events yet. Add your first one above.</p>
            </div>
          )}
          {sorted.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              saving={updateMutation.isPending}
              onSave={(data) => updateMutation.mutate({ id: event.id, data })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
