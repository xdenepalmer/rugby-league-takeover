import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Shield, Plus, Upload, Trash2, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ImageField from "@/components/admin/ImageField";
import TeamCrest from "@/components/public/TeamCrest";
import AdminConfirmSheet from "@/components/admin/shared/AdminConfirmSheet";
import MobileActionDrawer from "@/components/admin/MobileActionDrawer";
import PullToRefresh from "@/components/PullToRefresh";
import { emitHaptic } from "@/lib/native/haptic-events";
import { useWindowedList } from "@/hooks/use-windowed-list";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import {
  TEAM_GROUPS,
  normTeamName,
  teamRoster,
  filterTeamRoster,
  parseBulkLogos,
  matchBulkRows,
  buildLogoWrite,
  buildCustomTeamPayload,
} from "./teams-helpers.js";

/**
 * Same query the web panel wiring uses (admin-modules TeamsModule) — the
 * ["teams"] key keeps the native cache shared with the web manager.
 */
const useTeams = () =>
  useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list("sort_order", 100),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });

/** Execute a buildLogoWrite result through the same entity the web writes. */
const runLogoWrite = (write) =>
  write.op === "update"
    ? base44.entities.Team.update(write.id, write.data)
    : base44.entities.Team.create(write.data);

const useInvalidateTeams = () => {
  const queryClient = useQueryClient();
  // Same single invalidation the web TeamsManager performs after every write.
  return () => queryClient.invalidateQueries({ queryKey: ["teams"] });
};

const teamPath = (name) => `/admin/events/teams/${encodeURIComponent(name)}`;

/** Native club roster + crest manager — /admin/events/teams */
export default function NativeTeamsList() {
  const navigate = useNavigate();
  const { data: teams = [], isLoading } = useTeams();
  const refresh = useInvalidateTeams();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const roster = useMemo(() => teamRoster(teams), [teams]);
  const visible = useMemo(() => filterTeamRoster(roster, { query, group }), [roster, query, group]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(visible, {
    initial: 20,
    step: 20,
    restoreKey: "admin-teams",
  });
  const countFor = (key) => filterTeamRoster(roster, { group: key }).length;

  const bulkRows = useMemo(() => matchBulkRows(parseBulkLogos(bulkText), teams), [bulkText, teams]);
  const bulkMatched = bulkRows.filter((r) => r.team);

  const addCustom = useMutation({
    // Exact Team.create payload the web addCustom mutation writes.
    mutationFn: (name) => base44.entities.Team.create(buildCustomTeamPayload(name)),
    onSuccess: () => {
      emitHaptic("save.success");
      refresh();
      toast({ title: "Team added" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Couldn't add team", description: error.message, variant: "destructive" });
    },
  });

  const applyBulk = useMutation({
    // Web parity (TeamsManager.applyBulk): sequential update-or-create per row.
    mutationFn: async (rows) => {
      const byName = new Map((teams || []).map((t) => [normTeamName(t.name), t]));
      for (const { team, url } of rows) {
        await runLogoWrite(buildLogoWrite(byName.get(normTeamName(team.name)), team, url));
      }
      return rows.length;
    },
    onSuccess: (count) => {
      emitHaptic("save.success");
      refresh();
      toast({ title: `${count} logo${count === 1 ? "" : "s"} applied` });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      refresh(); // partial bulk progress may have written — resync
      toast({ title: "Bulk import failed", description: error.message, variant: "destructive" });
    },
  });

  const submitCustom = async () => {
    const name = customName.trim();
    if (!name) return;
    emitHaptic("action.primary");
    await addCustom.mutateAsync(name);
    setCustomName("");
    setAddOpen(false);
  };

  const submitBulk = async () => {
    if (bulkMatched.length === 0) return;
    emitHaptic("action.primary");
    await applyBulk.mutateAsync(bulkMatched);
    setBulkText("");
    setBulkOpen(false);
  };

  return (
    <div className="pb-8">
      <NativeTopBar title="Teams & Crests" fallback="/admin/events" />
      <PullToRefresh queryKeys={[["teams"]]}>
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 border border-border bg-card/50 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search club or nickname"
              aria-label="Search teams"
              className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="ios-scroll flex gap-2 overflow-x-auto py-2">
            {TEAM_GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                aria-pressed={group === g.key}
                onClick={() => {
                  emitHaptic("tab.select");
                  setGroup(g.key);
                }}
                className={`ios-pressable min-h-9 shrink-0 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                  group === g.key ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
                }`}
              >
                {g.label} ({countFor(g.key)})
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 pb-2">
            <button
              type="button"
              onClick={() => {
                emitHaptic("action.primary");
                setBulkOpen(true);
              }}
              className="ios-pressable flex min-h-11 items-center justify-center gap-1.5 border border-border text-[10px] font-bold uppercase tracking-widest"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" /> Bulk import logos
            </button>
            <button
              type="button"
              onClick={() => {
                emitHaptic("action.primary");
                setAddOpen(true);
              }}
              className="ios-pressable flex min-h-11 items-center justify-center gap-1.5 border border-border text-[10px] font-bold uppercase tracking-widest"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add custom team
            </button>
          </div>
          <p className="pb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Every NRL &amp; Super League club is built in — set crests here, pick fixtures in Match-ups.
          </p>
        </div>

        {isLoading && teams.length === 0 && roster.length === 0 ? (
          <div className="space-y-2 px-4 pt-2">
            <NativeSkeleton className="h-16 w-full" />
            <NativeSkeleton className="h-16 w-full" />
            <NativeSkeleton className="h-16 w-full" />
          </div>
        ) : windowed.length === 0 ? (
          <div className="px-4 pt-4">
            <NativeEmptyState
              icon={Shield}
              title="No clubs here"
              description={group === "custom" ? "Add a custom team (e.g. an invitational side) above." : "Nothing matches this search."}
            />
          </div>
        ) : (
          <div>
            {windowed.map((team) => (
              <button
                key={team.name}
                type="button"
                onClick={() => {
                  emitHaptic("tab.select");
                  navigate(teamPath(team.name));
                }}
                className="ios-pressable flex min-h-14 w-full items-center gap-3 border-b border-border/40 px-4 py-2 text-left"
              >
                <TeamCrest name={team.name} short={team.short_name} logo={team.db?.logo_url || ""} className="h-10 w-10 shrink-0 text-xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{team.short_name || team.name}</span>
                  <span className="block truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                    {team.name} · {team.league}
                  </span>
                </span>
                {team.db?.logo_url ? (
                  <span className="flex shrink-0 items-center gap-1 border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-300">
                    <Check className="h-3 w-3" aria-hidden="true" /> Crest
                  </span>
                ) : (
                  <span className="shrink-0 border border-border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    Monogram
                  </span>
                )}
              </button>
            ))}
            {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
          </div>
        )}
      </PullToRefresh>

      <MobileActionDrawer
        open={addOpen}
        onOpenChange={(open) => {
          if (!open) setAddOpen(false);
        }}
        title="Add custom team"
        description="For sides outside the built-in NRL / Super League roster (e.g. an invitational team)."
      >
        <div className="grid gap-2 py-2">
          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="native-custom-team-name">
            Team name
          </label>
          <Input
            id="native-custom-team-name"
            placeholder="Add a custom team (e.g. an invitational side)"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="h-11 rounded-none border-border bg-background"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 pt-3">
          <button
            type="button"
            disabled={addCustom.isPending}
            onClick={() => setAddOpen(false)}
            className="ios-pressable flex min-h-11 items-center justify-center border border-border text-xs font-bold uppercase tracking-widest disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!customName.trim() || addCustom.isPending}
            onClick={submitCustom}
            className="ios-pressable flex min-h-11 items-center justify-center bg-primary text-xs font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >
            {addCustom.isPending ? "Adding…" : "Add team"}
          </button>
        </div>
      </MobileActionDrawer>

      <MobileActionDrawer
        open={bulkOpen}
        onOpenChange={(open) => {
          if (!open) setBulkOpen(false);
        }}
        title="Bulk import logos"
        description="One club per line: Club Name = https://logo-url.png (comma or | also work). Use images you own or are licensed to use — official club crests are copyrighted."
      >
        <div className="grid gap-2 py-2">
          <Textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={6}
            aria-label="Bulk logo lines"
            placeholder={"Penrith Panthers = https://your-cdn.com/penrith.png\nMelbourne Storm = https://your-cdn.com/storm.png"}
            className="rounded-none border-border bg-background font-mono text-xs"
          />
          {bulkText.trim() && (
            <p className="text-xs text-muted-foreground">
              {bulkMatched.length} of {bulkRows.length} line{bulkRows.length === 1 ? "" : "s"} match a known club.
              {bulkRows.length > bulkMatched.length && " Unmatched lines (bad URL or unknown club name) are skipped."}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-3">
          <button
            type="button"
            disabled={applyBulk.isPending}
            onClick={() => setBulkOpen(false)}
            className="ios-pressable flex min-h-11 items-center justify-center border border-border text-xs font-bold uppercase tracking-widest disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={bulkMatched.length === 0 || applyBulk.isPending}
            onClick={submitBulk}
            className="ios-pressable flex min-h-11 items-center justify-center bg-primary text-xs font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >
            {applyBulk.isPending ? "Applying…" : `Apply ${bulkMatched.length} logo${bulkMatched.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </MobileActionDrawer>
    </div>
  );
}

/** Native club detail + crest editor — /admin/events/teams/:teamName */
export function NativeTeamDetail() {
  const { teamName } = useParams();
  const navigate = useNavigate();
  const { data: teams = [], isLoading } = useTeams();
  const refresh = useInvalidateTeams();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const roster = useMemo(() => teamRoster(teams), [teams]);
  const entry = useMemo(
    () => roster.find((t) => normTeamName(t.name) === normTeamName(teamName)) || null,
    [roster, teamName]
  );

  const saveLogo = useMutation({
    // Web parity (TeamsManager.setLogo): update the existing Team's logo_url,
    // or create the club with the web's exact create payload.
    mutationFn: ({ existing, team, logo_url }) => runLogoWrite(buildLogoWrite(existing, team, logo_url)),
    onSuccess: () => {
      emitHaptic("save.success");
      refresh();
      toast({ title: "Logo saved" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Couldn't save logo", description: error.message, variant: "destructive" });
    },
  });

  const removeTeam = useMutation({
    mutationFn: (id) => base44.entities.Team.delete(id),
    onSuccess: () => {
      emitHaptic("save.success");
      refresh();
      toast({ title: "Removed" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Couldn't remove team", description: error.message, variant: "destructive" });
    },
  });

  if (!entry) {
    return (
      <div>
        <NativeTopBar title="Team" fallback="/admin/events/teams" />
        <div className="px-4 pt-4">
          {isLoading ? (
            <div className="space-y-2">
              <NativeSkeleton className="h-28 w-full" />
              <NativeSkeleton className="h-40 w-full" />
            </div>
          ) : (
            <NativeEmptyState icon={Shield} title="Team not found" description="It may have been removed, or the link is stale." />
          )}
        </div>
      </div>
    );
  }

  const logo = entry.db?.logo_url || "";

  const confirmDelete = async () => {
    await removeTeam.mutateAsync(entry.db.id);
    setConfirmRemove(false);
    navigate("/admin/events/teams", { replace: true });
  };

  return (
    <div className="pb-10">
      <NativeTopBar title={entry.short_name || entry.name} fallback="/admin/events/teams" />
      <div className="space-y-4 px-4 pt-3">
        <div className="flex items-center gap-4 border border-border/60 bg-card/50 p-4">
          <TeamCrest name={entry.name} short={entry.short_name} logo={logo} className="h-16 w-16 text-base" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{entry.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {entry.league} {entry.custom ? "· custom team" : "· built-in club"}
            </p>
            {!logo && (
              <p className="pt-1 text-[10px] uppercase tracking-widest text-amber-300">
                No crest yet — colour monogram shown
              </p>
            )}
          </div>
        </div>

        <div className="border border-border/60 bg-card/50 p-3">
          <p className="pb-2 text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Crest</p>
          {/* Same control (and Core.UploadFile mechanism) the web manager uses. */}
          <ImageField
            label="Team logo (transparent PNG works best)"
            value={logo}
            onChange={(url) => saveLogo.mutate({ existing: entry.db, team: entry, logo_url: url })}
          />
          <p className="pt-2 text-[10px] leading-snug text-muted-foreground">
            Use image links you own or are licensed to use — official club crests are copyrighted. Saved instantly on upload, paste or clear.
          </p>
        </div>

        {entry.custom && entry.db && (
          <div className="border border-red-500/40 bg-red-500/5 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-300">Danger zone</p>
            <p className="pb-2 pt-1 text-[10px] leading-snug text-muted-foreground">
              Removes this custom team from the roster. Built-in NRL / Super League clubs can't be removed.
            </p>
            <button
              type="button"
              disabled={removeTeam.isPending}
              onClick={() => {
                emitHaptic("mutation.warning");
                setConfirmRemove(true);
              }}
              className="ios-pressable flex min-h-11 w-full items-center justify-center gap-1.5 border border-red-500/60 bg-red-500/15 text-xs font-bold uppercase tracking-widest text-red-300 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove team
            </button>
          </div>
        )}
      </div>

      <AdminConfirmSheet
        open={confirmRemove}
        title={`Remove ${entry.short_name || entry.name}?`}
        description="Deletes this custom team and its crest from the database. Fixtures referencing it keep their stored names."
        confirmLabel="Remove team"
        variant="destructive"
        loading={removeTeam.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}
