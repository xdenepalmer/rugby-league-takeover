import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShieldX, Plus, Globe, Mail, UserX, Shield, Calendar, Clock, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import AdminConfirmSheet from "@/components/admin/shared/AdminConfirmSheet";
import MobileActionDrawer from "@/components/admin/MobileActionDrawer";
import PullToRefresh from "@/components/PullToRefresh";
import { emitHaptic } from "@/lib/native/haptic-events";
import { useWindowedList } from "@/hooks/use-windowed-list";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import { emitAdminLog } from "./workflow-helpers.js";
import {
  BAN_TYPES,
  banTypeMeta,
  banStatus,
  banStatusMeta,
  BAN_FILTERS,
  filterBans,
  banCounts,
  canSubmitBan,
  buildCreateBanPayload,
  buildLiftBanPayload,
  banCreateLogText,
  banLiftLogText,
} from "./bans-helpers.js";

/*
 * Native Bans workflow — /admin/people/bans. Reads and writes go through the
 * SAME Ban entity the web BansManager uses, with field-for-field identical
 * payloads (Ban.create / Ban.update lift), the same ["bans"] query key so the
 * cache stays shared with the web panel, and the same rlt_admin_log audit
 * events. Sensitive roster: ["bans"] is fetched fresh (not on the
 * query-persistence allowlist).
 */
const useBans = () =>
  useQuery({
    queryKey: ["bans"],
    queryFn: () => base44.entities.Ban.list("-created_date", 500),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });

const TYPE_ICONS = { ip: Globe, email: Mail, user: UserX };

const formatDate = (value) => {
  try {
    return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
};

function StatusBadge({ ban }) {
  const meta = banStatusMeta(banStatus(ban));
  return (
    <span className={`border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${meta.tone}`}>
      {meta.label}
    </span>
  );
}

function TypeBadge({ banType }) {
  const Icon = TYPE_ICONS[banType] || Globe;
  return (
    <span className="flex items-center gap-1 border border-border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
      <Icon className="h-3 w-3" aria-hidden="true" /> {banTypeMeta(banType).label}
    </span>
  );
}

/** The web isError note: bans need the latest deploy before they work. */
function BansUnavailable() {
  return (
    <div className="border border-amber-500/40 bg-amber-500/10 p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Bans unavailable</p>
      <p className="pt-1 text-xs leading-snug text-amber-200/90">
        The ban system activates once the latest changes are deployed to the app. Until then, bans
        can't be created or listed.
      </p>
    </div>
  );
}

/** Shared write hooks — exact web BansManager payloads + audit events. */
function useBanMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["bans"] });

  const createBan = useMutation({
    mutationFn: (payload) => base44.entities.Ban.create(payload),
    onSuccess: (data, payload) => {
      emitHaptic("save.success");
      refresh();
      toast({ title: "Ban added" });
      emitAdminLog("warn", banCreateLogText(payload));
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Could not add ban", description: error.message, variant: "destructive" });
    },
  });

  const liftBan = useMutation({
    mutationFn: (id) => base44.entities.Ban.update(id, buildLiftBanPayload()),
    onSuccess: (data, id) => {
      emitHaptic("save.success");
      refresh();
      toast({ title: "Ban lifted" });
      emitAdminLog("info", banLiftLogText(id));
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Could not lift ban", description: error.message, variant: "destructive" });
    },
  });

  return { createBan, liftBan };
}

/** Add-ban sheet: the web form (type / value / reason) as a native drawer. */
function AddBanDrawer({ open, onOpenChange, createBan, actorEmail }) {
  const [banType, setBanType] = useState("ip");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  const submit = async () => {
    if (!canSubmitBan(value) || createBan.isPending) return;
    emitHaptic("mutation.warning");
    try {
      await createBan.mutateAsync(buildCreateBanPayload({ banType, value, reason, actorEmail }));
      setValue("");
      setReason("");
      onOpenChange(false);
    } catch {
      // handled by the mutation's onError toast
    }
  };

  return (
    <MobileActionDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Add New Ban"
      description="Block an IP address, email address, or user account. IP bans are best-effort (VPNs/shared connections can evade them)."
    >
      <div className="grid gap-3 py-2">
        <div>
          <p className="pb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Ban type</p>
          <div className="flex gap-2">
            {BAN_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={banType === t.key}
                onClick={() => {
                  emitHaptic("tab.select");
                  setBanType(t.key);
                }}
                className={`ios-pressable min-h-11 flex-1 border px-2 text-[10px] font-bold uppercase tracking-widest ${
                  banType === t.key ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="native-ban-value">
            Value to block
          </label>
          <Input
            id="native-ban-value"
            placeholder={banTypeMeta(banType).placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-11 rounded-none border-border bg-background font-mono"
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="native-ban-reason">
            Reason
          </label>
          <Input
            id="native-ban-reason"
            placeholder="e.g. Repeated spam"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-11 rounded-none border-border bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-3">
        <button
          type="button"
          disabled={createBan.isPending}
          onClick={() => onOpenChange(false)}
          className="ios-pressable flex min-h-11 items-center justify-center border border-border text-xs font-bold uppercase tracking-widest disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSubmitBan(value) || createBan.isPending}
          onClick={submit}
          className="ios-pressable flex min-h-11 items-center justify-center border border-red-500/60 bg-red-500/15 text-xs font-bold uppercase tracking-widest text-red-300 disabled:opacity-40"
        >
          {createBan.isPending ? "Adding…" : "Add ban"}
        </button>
      </div>
    </MobileActionDrawer>
  );
}

/** Native searchable, filterable ban list — /admin/people/bans */
export default function NativeBansList() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const { data: bans = [], isLoading, isError } = useBans();
  const { createBan } = useBanMutations();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [addOpen, setAddOpen] = useState(false);

  const counts = useMemo(() => banCounts(bans), [bans]);
  const visible = useMemo(() => filterBans(bans, { query, status }), [bans, query, status]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(visible, { initial: 20, step: 20, restoreKey: "admin-bans" });

  return (
    <div className="pb-8">
      <NativeTopBar
        title="Bans"
        fallback="/admin/people"
        right={
          <button
            type="button"
            aria-label="Add ban"
            onClick={() => {
              emitHaptic("action.primary");
              setAddOpen(true);
            }}
            className="ios-pressable flex h-11 min-w-11 items-center justify-center text-primary"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        }
      />
      <PullToRefresh queryKeys={[["bans"]]}>
        <div className="px-4 pt-3">
          {isError && (
            <div className="pb-2">
              <BansUnavailable />
            </div>
          )}
          <div className="flex items-center gap-2 border border-border bg-card/50 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search value, reason or type"
              aria-label="Search bans"
              className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="ios-scroll flex gap-2 overflow-x-auto py-2">
            {BAN_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={status === f.key}
                onClick={() => {
                  emitHaptic("tab.select");
                  setStatus(f.key);
                }}
                className={`ios-pressable min-h-9 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                  status === f.key ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
                }`}
              >
                {f.label} ({counts[f.key] ?? 0})
              </button>
            ))}
          </div>
        </div>

        {isLoading && bans.length === 0 ? (
          <div className="space-y-2 px-4">
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
          </div>
        ) : windowed.length === 0 ? (
          <div className="px-4 pt-4">
            <NativeEmptyState
              icon={ShieldX}
              title="No bans found"
              description={bans.length === 0 ? "Tap + to create your first ban rule." : "Try adjusting your search or filter."}
            />
          </div>
        ) : (
          <div>
            {windowed.map((ban) => {
              const lifted = banStatus(ban) === "lifted";
              return (
                <button
                  key={ban.id}
                  type="button"
                  onClick={() => {
                    emitHaptic("tab.select");
                    navigate(`/admin/people/bans/${encodeURIComponent(ban.id)}`);
                  }}
                  className="ios-pressable flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`truncate font-mono text-xs font-black ${lifted ? "line-through text-muted-foreground" : ""}`}>
                        {ban.value}
                      </span>
                      <StatusBadge ban={ban} />
                      <TypeBadge banType={ban.ban_type} />
                    </div>
                    <p className="truncate pt-1 text-sm">{ban.reason || "No reason specified"}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {ban.created_date ? formatDate(ban.created_date) : "—"} ·{" "}
                      {ban.expires_at ? `Expires ${formatDate(ban.expires_at)}` : "Permanent"}
                    </p>
                  </div>
                </button>
              );
            })}
            {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
          </div>
        )}
      </PullToRefresh>

      <AddBanDrawer open={addOpen} onOpenChange={setAddOpen} createBan={createBan} actorEmail={me?.email || ""} />
    </div>
  );
}

/** Native ban detail + lift — /admin/people/bans/:banId */
export function NativeBanDetail() {
  const { banId } = useParams();
  const { data: bans = [], isLoading } = useBans();
  const { liftBan } = useBanMutations();
  const [confirmLift, setConfirmLift] = useState(false);
  const ban = useMemo(() => bans.find((b) => String(b.id) === String(banId)) || null, [bans, banId]);

  if (!isLoading && !ban) {
    return (
      <div>
        <NativeTopBar title="Ban" fallback="/admin/people/bans" />
        <div className="px-4 pt-6">
          <NativeEmptyState icon={ShieldX} title="Ban not found" description="It may have been removed, or you're offline." />
        </div>
      </div>
    );
  }
  if (!ban) {
    return (
      <div>
        <NativeTopBar title="Ban" fallback="/admin/people/bans" />
        <div className="space-y-2 px-4 pt-4">
          <NativeSkeleton className="h-24 w-full" />
          <NativeSkeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const status = banStatus(ban);

  return (
    <div className="pb-10">
      <NativeTopBar title="Ban" fallback="/admin/people/bans" />
      <div className="space-y-4 px-4 pt-3">
        <div className="border border-border/60 bg-card/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge ban={ban} />
            <TypeBadge banType={ban.ban_type} />
          </div>
          <p className={`break-all pt-2 font-mono text-sm font-black ${status === "lifted" ? "line-through text-muted-foreground" : ""}`}>
            {ban.value}
          </p>
          <p className="pt-1 text-sm text-muted-foreground">{ban.reason || "No reason specified"}</p>
        </div>

        <div className="border border-border/60 bg-card/50 p-3">
          <p className="pb-1 text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Record</p>
          <p className="flex items-center gap-1.5 border-b border-border/30 py-1.5 text-xs">
            <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            Banned by <span className="font-bold">{ban.banned_by || "admin"}</span>
          </p>
          <p className="flex items-center gap-1.5 border-b border-border/30 py-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            Created {ban.created_date ? formatDate(ban.created_date) : "—"}
          </p>
          <p className="flex items-center gap-1.5 py-1.5 text-xs">
            <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {ban.expires_at ? `Expires ${formatDate(ban.expires_at)}` : "Permanent"}
          </p>
        </div>

        {ban.is_active && (
          <button
            type="button"
            disabled={liftBan.isPending}
            onClick={() => {
              emitHaptic("action.primary");
              setConfirmLift(true);
            }}
            className="ios-pressable flex min-h-12 w-full items-center justify-center gap-2 border border-emerald-500/50 bg-emerald-500/10 text-sm font-black uppercase tracking-widest text-emerald-300 disabled:opacity-40"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {liftBan.isPending ? "Lifting…" : "Lift ban"}
          </button>
        )}
      </div>

      <AdminConfirmSheet
        open={confirmLift}
        title="Lift this ban?"
        description={`${ban.value} regains access immediately. The ban record is kept and marked lifted.`}
        confirmLabel="Lift ban"
        loading={liftBan.isPending}
        onConfirm={() => {
          liftBan.mutate(ban.id);
          setConfirmLift(false);
        }}
        onCancel={() => setConfirmLift(false)}
      />
    </div>
  );
}
