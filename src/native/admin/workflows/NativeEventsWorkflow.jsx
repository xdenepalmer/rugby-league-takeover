import { useId, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CalendarPlus,
  Image as ImageIcon,
  MapPin,
  Plus,
  Save,
  Ticket,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import DateTimePicker from "@/components/admin/DateTimePicker";
import AdminConfirmSheet from "@/components/admin/shared/AdminConfirmSheet";
import PullToRefresh from "@/components/PullToRefresh";
import { emitHaptic } from "@/lib/native/haptic-events";
import { useWindowedList } from "@/hooks/use-windowed-list";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import {
  emptyEvent,
  isEventPublished,
  isEventComingSoon,
  canCreateEvent,
  sortEvents,
  eventCounts,
  updateTicket,
  addTicket,
  removeTicket,
  addPhoto,
  removePhoto,
} from "./events-helpers.js";

/**
 * Native Events workflow — payload parity with the web EventsManager: same
 * entity (EventContent), same query key (["events"], shared with the web
 * panel's cache and the module registry's list call), same full-draft
 * create/update payloads, same upload call, same DateTimePicker so
 * event_date keeps the Pacific-Time ISO shape. The web manager dispatches no
 * rlt_admin_log events and calls no edge functions for events, so neither
 * does this workflow.
 */
const useEvents = () =>
  useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.EventContent.list("sort_order", 100),
    enabled: appParams.hasBase44Config,
    staleTime: 60000,
  });

/** Web parity: EventsManager only invalidates ["events"] after every write. */
const useEventsRefresh = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["events"] });
};

const formatDate = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
};

function StatusBadges({ event }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {isEventComingSoon(event) && (
        <span className="border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-300">
          Soon
        </span>
      )}
      <span
        className={`border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${
          isEventPublished(event)
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            : "border-border bg-muted/20 text-muted-foreground"
        }`}
      >
        {isEventPublished(event) ? "Live" : "Hidden"}
      </span>
    </span>
  );
}

/**
 * Native photo control: upload from the photo library through the EXACT
 * client call the web PhotoUploader uses
 * (base44.integrations.Core.UploadFile), plus an always-visible remove
 * button per photo — no hover-gated affordances on touch.
 */
function NativePhotosField({ urls = [], onChange }) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(addPhoto(urls, file_url));
      emitHaptic("save.success");
    } catch (error) {
      emitHaptic("mutation.error");
      toast({ title: "Photo upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Event photos</p>
      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((url) => (
            <div key={url} className="relative aspect-square overflow-hidden border border-border/40 bg-muted/10">
              <img src={url} alt="Event" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => {
                  emitHaptic("action.primary");
                  onChange(removePhoto(urls, url));
                }}
                className="ios-pressable absolute inset-x-0 bottom-0 flex min-h-11 items-center justify-center bg-black/60 text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <label
        htmlFor={inputId}
        className={`ios-pressable flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 border border-border text-[10px] font-bold uppercase tracking-widest ${
          uploading ? "pointer-events-none opacity-40" : ""
        }`}
      >
        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
        {uploading ? "Uploading…" : "Upload photo"}
      </label>
    </div>
  );
}

/** Ticket tiers — same fields the web TicketsEditor writes (note stays untouched). */
function NativeTicketsField({ tickets = [], onChange, idPrefix }) {
  return (
    <div className="grid gap-2 border border-border/60 bg-card/50 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          <Ticket className="h-3.5 w-3.5" aria-hidden="true" /> Ticket tiers
        </p>
        <span className="text-[10px] font-mono text-muted-foreground">{tickets.length} tiers</span>
      </div>
      {tickets.length === 0 && (
        <p className="text-xs text-muted-foreground">No ticket tiers yet. Add one to show a "Buy tickets" button.</p>
      )}
      {tickets.map((ticket, i) => (
        <div key={i} className="grid gap-2 border-l-2 border-primary/20 bg-background/40 p-2 pl-3">
          <Input
            value={ticket.name || ""}
            onChange={(e) => onChange(updateTicket(tickets, i, { name: e.target.value }))}
            placeholder="Tier (e.g. VIP)"
            aria-label={`Tier ${i + 1} name`}
            className="h-11 rounded-none border-border bg-background text-sm"
          />
          <Input
            type="number"
            inputMode="decimal"
            value={ticket.price_aud ?? ""}
            onChange={(e) => onChange(updateTicket(tickets, i, { price_aud: Number(e.target.value) }))}
            placeholder="$AUD"
            aria-label={`Tier ${i + 1} price (AUD)`}
            className="h-11 rounded-none border-border bg-background text-sm"
          />
          <Input
            value={ticket.url || ""}
            onChange={(e) => onChange(updateTicket(tickets, i, { url: e.target.value }))}
            placeholder="https://tickets..."
            aria-label={`Tier ${i + 1} ticket URL`}
            className="h-11 rounded-none border-border bg-background text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={`${idPrefix}-ticket-${i}-soldout`}
              className="flex min-h-11 items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
            >
              {ticket.sold_out === true ? <span className="text-red-400">Sold out</span> : "Available"}
              <Switch
                id={`${idPrefix}-ticket-${i}-soldout`}
                checked={ticket.sold_out === true}
                onCheckedChange={(v) => onChange(updateTicket(tickets, i, { sold_out: v }))}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                emitHaptic("action.primary");
                onChange(removeTicket(tickets, i));
              }}
              className="ios-pressable flex min-h-11 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest text-red-400"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Remove
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          emitHaptic("action.primary");
          onChange(addTicket(tickets));
        }}
        className="ios-pressable flex min-h-11 w-full items-center justify-center gap-2 border border-border text-[10px] font-bold uppercase tracking-widest"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add tier
      </button>
    </div>
  );
}

/** Shared field set — the same fields the web create/edit forms write. */
function EventFields({ draft, setDraft, idPrefix }) {
  const set = (patch) => setDraft({ ...draft, ...patch });
  const textField = (key, label, placeholder, help) => (
    <div className="grid gap-1.5">
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-${key}`}>
        {label}
      </label>
      <Input
        id={`${idPrefix}-${key}`}
        value={draft[key] || ""}
        onChange={(e) => set({ [key]: e.target.value })}
        placeholder={placeholder}
        className="h-11 rounded-none border-border bg-background"
      />
      {help && <p className="text-[10px] text-muted-foreground/70">{help}</p>}
    </div>
  );

  return (
    <div className="grid gap-4">
      {textField("title", "Event title", "e.g. Official Pre-Game Party")}
      <div className="grid gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-sort`}>
          Sort order
        </label>
        <Input
          id={`${idPrefix}-sort`}
          type="number"
          inputMode="numeric"
          value={draft.sort_order ?? 1}
          onChange={(e) => set({ sort_order: Number(e.target.value) })}
          className="h-11 rounded-none border-border bg-background"
        />
        <p className="text-[10px] text-muted-foreground/70">Lower numbers appear first</p>
      </div>
      <div className="grid gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Date &amp; time</span>
        {/* Same picker the web manager uses — keeps the Pacific-Time ISO value shape. */}
        <DateTimePicker value={draft.event_date || ""} onChange={(val) => set({ event_date: val })} placeholder="Pick event date & time" />
      </div>
      {textField("start_time", "Display time", "Doors 6pm", "e.g. Doors 6pm, Kickoff 7:30pm")}
      {textField("location", "Venue name", "e.g. Allegiant Stadium")}
      {textField("address", "Address", "3333 Al Davis Way, Las Vegas")}
      <div className="grid gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-blurb`}>
          Description
        </label>
        <Textarea
          id={`${idPrefix}-blurb`}
          value={draft.blurb || ""}
          onChange={(e) => set({ blurb: e.target.value })}
          placeholder="Tell fans what to expect…"
          className="min-h-24 rounded-none border-border bg-background"
        />
      </div>
      {textField("ticket_url", "Fallback ticket/info link", "https://...", "Used if no ticket tiers below")}
      <NativeTicketsField tickets={draft.tickets || []} onChange={(tickets) => set({ tickets })} idPrefix={idPrefix} />
      <NativePhotosField urls={draft.photo_urls || []} onChange={(photo_urls) => set({ photo_urls })} />
      <div className="flex min-h-11 items-center justify-between border border-border/60 bg-card/50 px-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {draft.is_coming_soon !== false ? "Coming soon (badge shown)" : "Coming soon off"}
        </span>
        <Switch
          checked={draft.is_coming_soon !== false}
          onCheckedChange={(v) => set({ is_coming_soon: v })}
          aria-label="Coming soon"
        />
      </div>
      <div className="flex min-h-11 items-center justify-between border border-border/60 bg-card/50 px-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {draft.is_published !== false ? "Published (live)" : "Hidden"}
        </span>
        <Switch
          checked={draft.is_published !== false}
          onCheckedChange={(v) => set({ is_published: v })}
          aria-label="Published"
        />
      </div>
    </div>
  );
}

/** Native events list — /admin/events/events */
export default function NativeEventsList() {
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useEvents();

  const counts = useMemo(() => eventCounts(events), [events]);
  const sorted = useMemo(() => sortEvents(events), [events]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(sorted, { initial: 15, step: 15, restoreKey: "admin-events" });

  return (
    <div>
      <NativeTopBar
        title="Events"
        fallback="/admin/events"
        right={
          <button
            type="button"
            aria-label="New event"
            onClick={() => {
              emitHaptic("action.primary");
              navigate("/admin/events/events/new");
            }}
            className="ios-pressable flex h-11 min-w-11 items-center justify-center text-primary"
          >
            <CalendarPlus className="h-6 w-6" aria-hidden="true" />
          </button>
        }
      />
      <PullToRefresh queryKeys={[["events"]]}>
        <div className="px-4 pb-1 pt-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {counts.total} event{counts.total === 1 ? "" : "s"} · {counts.published} published
          </p>
        </div>

        {isLoading && events.length === 0 ? (
          <div className="space-y-2 px-4 pt-2">
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
          </div>
        ) : windowed.length === 0 ? (
          <div className="px-4 pt-4">
            <NativeEmptyState icon={Calendar} title="No events yet" description="Tap + to add the first event." />
          </div>
        ) : (
          <div>
            {windowed.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => {
                  emitHaptic("tab.select");
                  navigate(`/admin/events/events/${encodeURIComponent(event.id)}`);
                }}
                className="ios-pressable flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left"
              >
                {(event.photo_urls || []).length > 0 ? (
                  <img src={event.photo_urls[0]} alt="" className="h-12 w-12 shrink-0 border border-border/40 object-cover" />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-border/40 bg-muted/20">
                    <Calendar className="h-5 w-5 text-muted-foreground/40" aria-hidden="true" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{event.title || "Untitled Event"}</span>
                  <span className="block truncate pt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {formatDate(event.event_date) || "No date"}
                    {event.location ? ` · ${event.location}` : ""}
                    {(event.tickets || []).length > 0 ? ` · ${event.tickets.length} tiers` : ""}
                    {` · #${event.sort_order || 0}`}
                  </span>
                </span>
                <StatusBadges event={event} />
              </button>
            ))}
            {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}

/** Native event compose — /admin/events/events/new */
export function NativeEventCompose() {
  const navigate = useNavigate();
  const refreshEvents = useEventsRefresh();
  const [draft, setDraft] = useState(emptyEvent);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.EventContent.create(data),
    onSuccess: () => {
      emitHaptic("save.success");
      refreshEvents();
      toast({ title: "Event added" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Failed to create event", description: error.message, variant: "destructive" });
    },
  });

  const submit = async () => {
    if (!canCreateEvent(draft) || createMutation.isPending) return;
    emitHaptic("action.primary");
    try {
      await createMutation.mutateAsync(draft);
    } catch {
      return; // onError already surfaced the failure; stay on the form
    }
    navigate("/admin/events/events", { replace: true });
  };

  return (
    <div className="pb-10">
      <NativeTopBar title="New Event" fallback="/admin/events/events" />
      <div className="space-y-4 px-4 pt-3">
        <div className="border border-border/60 bg-card/50 p-3">
          <EventFields draft={draft} setDraft={setDraft} idPrefix="native-event-new" />
        </div>
        <button
          type="button"
          disabled={!canCreateEvent(draft) || createMutation.isPending}
          onClick={submit}
          className="ios-pressable flex min-h-12 w-full items-center justify-center gap-2 bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {createMutation.isPending ? "Adding…" : "Add Event"}
        </button>
        {!canCreateEvent(draft) && (
          <p className="text-[10px] uppercase tracking-widest text-amber-300">Add a title before saving</p>
        )}
      </div>
    </div>
  );
}

/** Native event detail + editor — /admin/events/events/:eventId */
export function NativeEventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const refreshEvents = useEventsRefresh();
  const { data: events = [], isLoading } = useEvents();
  const event = useMemo(() => events.find((e) => String(e.id) === String(eventId)) || null, [events, eventId]);

  const [draft, setDraft] = useState(null); // lazily seeded from the event
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Web parity: EventCard seeds its edit draft from the full event record and
  // saves the whole draft back, so the update payload is never narrower than
  // the web's.
  const editDraft = draft ?? event ?? emptyEvent();

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EventContent.update(id, data),
    onSuccess: () => {
      emitHaptic("save.success");
      refreshEvents();
      toast({ title: "Event saved" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Failed to save event", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EventContent.delete(id),
    onSuccess: () => {
      refreshEvents();
      toast({ title: "Event removed" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Failed to delete event", description: error.message, variant: "destructive" });
    },
  });

  if (!isLoading && !event) {
    return (
      <div>
        <NativeTopBar title="Event" fallback="/admin/events/events" />
        <div className="px-4 pt-6">
          <NativeEmptyState icon={Calendar} title="Event not found" description="It may have been deleted, or you're offline." />
        </div>
      </div>
    );
  }
  if (!event) {
    return (
      <div>
        <NativeTopBar title="Event" fallback="/admin/events/events" />
        <div className="space-y-2 px-4 pt-4">
          <NativeSkeleton className="h-24 w-full" />
          <NativeSkeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const save = () => {
    emitHaptic("action.primary");
    // Full-draft payload, exactly like the web EventCard's Save changes.
    updateMutation.mutate({ id: event.id, data: editDraft });
  };

  const confirmDeleteEvent = async () => {
    try {
      await deleteMutation.mutateAsync(event.id);
    } catch {
      setConfirmDelete(false);
      return; // onError already surfaced the failure
    }
    emitHaptic("save.success");
    setConfirmDelete(false);
    navigate("/admin/events/events", { replace: true });
  };

  return (
    <div className="pb-10">
      <NativeTopBar title={event.title || "Event"} fallback="/admin/events/events" />
      <div className="space-y-4 px-4 pt-3">
        {/* Summary */}
        <div className="border border-border/60 bg-card/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <StatusBadges event={event} />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">#{event.sort_order || 0}</span>
          </div>
          <p className="flex items-center gap-1.5 pt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Calendar className="h-3 w-3" aria-hidden="true" /> {formatDate(event.event_date) || "No date"}
            {event.start_time ? ` · ${event.start_time}` : ""}
          </p>
          {event.location && (
            <p className="flex items-center gap-1.5 pt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              <MapPin className="h-3 w-3" aria-hidden="true" /> {event.location}
            </p>
          )}
          <button
            type="button"
            disabled={deleteMutation.isPending}
            onClick={() => {
              emitHaptic("mutation.warning");
              setConfirmDelete(true);
            }}
            className="ios-pressable mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 border border-red-500/40 text-xs font-bold uppercase tracking-widest text-red-400 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete event
          </button>
        </div>

        {/* Editor */}
        <div className="border border-border/60 bg-card/50 p-3">
          <p className="pb-3 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">
            <ImageIcon className="h-3 w-3" aria-hidden="true" /> Edit event
          </p>
          <EventFields draft={editDraft} setDraft={setDraft} idPrefix="native-event-edit" />
          <button
            type="button"
            disabled={updateMutation.isPending}
            onClick={save}
            className="ios-pressable mt-4 flex min-h-12 w-full items-center justify-center gap-2 bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <AdminConfirmSheet
        open={confirmDelete}
        title="Delete this event?"
        description="This event will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={confirmDeleteEvent}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
