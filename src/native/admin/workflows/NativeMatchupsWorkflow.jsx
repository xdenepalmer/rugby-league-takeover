import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Swords, Plus, Trophy, Trash2, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import DateTimePicker from "@/components/admin/DateTimePicker";
import { ALL_TEAMS } from "@/lib/nrl-teams";
import AdminConfirmSheet from "@/components/admin/shared/AdminConfirmSheet";
import MobileActionDrawer from "@/components/admin/MobileActionDrawer";
import PullToRefresh from "@/components/PullToRefresh";
import { emitHaptic } from "@/lib/native/haptic-events";
import { useWindowedList } from "@/hooks/use-windowed-list";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import {
  EMPTY_MATCHUP,
  cleanMatchupPayload,
  buildLogoIndex,
  logoForTeam,
  sortMatchups,
  filterMatchups,
  canSaveMatchup,
  matchupEditSeed,
  buildMatchupSavePayload,
  buildPublishTogglePayload,
  matchupScoreline,
  groupTeamsByLeague,
} from "./matchups-helpers.js";

/**
 * Native fixtures/results workflow — list at /admin/events/matchups, editor at
 * /admin/events/matchups/:matchupId. Every write sends the exact payloads the
 * web MatchupsManager sends (Matchup.create / Matchup.update / Matchup.delete,
 * each through cleanMatchupPayload) and invalidates the same ["matchups"] query
 * key, so the cache stays shared with the web panels. The picker reads the same
 * ["teams"] query the web wrapper passes in, snapshot-copying each club's
 * logo_url onto the fixture exactly like the web form. The web manager
 * dispatches no rlt_admin_log events for matchups, so neither does this.
 */

// Same queries the web wrapper (admin-modules MatchupsModule) uses — identical
// keys keep the native cache shared with every web matchups/teams consumer.
const useMatchups = () =>
  useQuery({
    queryKey: ["matchups"],
    queryFn: () => base44.entities.Matchup.list("sort_order", 100),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });

const useTeams = () =>
  useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list("sort_order", 100),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });

const useMatchupMutations = () => {
  const queryClient = useQueryClient();
  // Web parity: MatchupsManager invalidates ["matchups"] only.
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["matchups"] });
  const createMutation = useMutation({
    // Web parity: create sends the draft through cleanMatchupPayload.
    mutationFn: (data) => base44.entities.Matchup.create(cleanMatchupPayload(data)),
    onSuccess: () => {
      emitHaptic("save.success");
      refresh();
      toast({ title: "Matchup added" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Couldn't add matchup", description: error.message, variant: "destructive" });
    },
  });
  // Payload builders (buildMatchupSavePayload / buildPublishTogglePayload) are
  // the single write path — they clean the payload, so the mutation just writes.
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Matchup.update(id, data),
    onSuccess: () => {
      emitHaptic("save.success");
      refresh();
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Couldn't save matchup", description: error.message, variant: "destructive" });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Matchup.delete(id),
    onSuccess: () => {
      emitHaptic("save.success");
      refresh();
      toast({ title: "Matchup removed" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Couldn't remove matchup", description: error.message, variant: "destructive" });
    },
  });
  return { createMutation, updateMutation, deleteMutation };
};

const formatKickoff = (iso) => {
  if (!iso) return "";
  try {
    return `${new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Los_Angeles",
    }).format(new Date(iso))} PT`;
  } catch {
    return "";
  }
};

/** Native club picker — grouped NRL / Super League, web parity with TeamSelect. */
function TeamPicker({ id, valueName, onPick, placeholder }) {
  const groups = useMemo(() => groupTeamsByLeague(ALL_TEAMS), []);
  return (
    <select
      id={id}
      aria-label={placeholder}
      value={valueName || ""}
      onChange={(e) => {
        const team = ALL_TEAMS.find((t) => t.name === e.target.value);
        if (team) onPick(team);
      }}
      className="h-11 w-full rounded-none border border-border bg-background px-3 text-sm"
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {groups.map((group) => (
        <optgroup key={group.league} label={group.label}>
          {group.teams.map((team) => (
            <option key={team.name} value={team.name}>
              {team.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/**
 * Shared editable fields for both the create drawer and the detail editor —
 * the same field set (and logo snapshot) the web MatchupFields writes. `value`
 * is the whole draft; `onChange` receives the next whole draft (web parity).
 */
function MatchupFormFields({ value, onChange, logoIndex, idPrefix }) {
  const setHome = (team) => onChange({ ...value, home_team: team.name, home_logo: logoForTeam(logoIndex, team.name) });
  const setAway = (team) => onChange({ ...value, away_team: team.name, away_logo: logoForTeam(logoIndex, team.name) });
  const isFinal = value.status === "final";
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-home`}>
          Home team
        </label>
        <TeamPicker id={`${idPrefix}-home`} valueName={value.home_team} onPick={setHome} placeholder="Home team" />
      </div>
      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-away`}>
          Away team
        </label>
        <TeamPicker id={`${idPrefix}-away`} valueName={value.away_team} onPick={setAway} placeholder="Away team" />
      </div>

      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Kickoff (Pacific Time)</label>
        <DateTimePicker value={value.kickoff} onChange={(val) => onChange({ ...value, kickoff: val })} placeholder="Kickoff date & time" />
      </div>

      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-label`}>
          Label (optional)
        </label>
        <Input
          id={`${idPrefix}-label`}
          placeholder="e.g. Double Header Game 1"
          value={value.label || ""}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
          className="h-11 rounded-none border-border bg-background"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-venue`}>
            Venue (optional)
          </label>
          <Input
            id={`${idPrefix}-venue`}
            placeholder="Venue"
            value={value.venue || ""}
            onChange={(e) => onChange({ ...value, venue: e.target.value })}
            className="h-11 rounded-none border-border bg-background"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-sort`}>
            Sort order
          </label>
          <Input
            id={`${idPrefix}-sort`}
            type="number"
            inputMode="numeric"
            value={value.sort_order ?? 1}
            onChange={(e) => onChange({ ...value, sort_order: Number(e.target.value) })}
            className="h-11 rounded-none border-border bg-background font-mono"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-tickets`}>
          Tickets link (optional)
        </label>
        <Input
          id={`${idPrefix}-tickets`}
          placeholder="https://…"
          value={value.ticket_url || ""}
          onChange={(e) => onChange({ ...value, ticket_url: e.target.value })}
          className="h-11 rounded-none border-border bg-background"
        />
      </div>

      <div className="grid gap-3 border-t border-border/60 pt-3">
        <label className="flex min-h-11 items-center justify-between">
          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Trophy className="h-4 w-4" aria-hidden="true" /> Game finished?
          </span>
          <Switch checked={isFinal} onCheckedChange={(v) => onChange({ ...value, status: v ? "final" : "scheduled" })} />
        </label>
        <p className="-mt-2 text-[10px] text-muted-foreground">
          {isFinal ? "Result shows instead of kickoff." : "Toggle on to enter the final score."}
        </p>
        {isFinal && (
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-home-score`}>
                {value.home_team || "Home"} score
              </label>
              <Input
                id={`${idPrefix}-home-score`}
                type="number"
                inputMode="numeric"
                value={value.home_score ?? ""}
                onChange={(e) => onChange({ ...value, home_score: e.target.value === "" ? "" : Number(e.target.value) })}
                className="h-11 rounded-none border-border bg-background font-mono"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-away-score`}>
                {value.away_team || "Away"} score
              </label>
              <Input
                id={`${idPrefix}-away-score`}
                type="number"
                inputMode="numeric"
                value={value.away_score ?? ""}
                onChange={(e) => onChange({ ...value, away_score: e.target.value === "" ? "" : Number(e.target.value) })}
                className="h-11 rounded-none border-border bg-background font-mono"
              />
            </div>
            <div className="col-span-2 grid gap-2">
              <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground" htmlFor={`${idPrefix}-note`}>
                Result note
              </label>
              <Input
                id={`${idPrefix}-note`}
                placeholder="e.g. Full Time"
                value={value.result_note || ""}
                onChange={(e) => onChange({ ...value, result_note: e.target.value })}
                className="h-11 rounded-none border-border bg-background"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Small fixture crest — the snapshot logo the web copied onto the record. */
function FixtureCrest({ src, alt }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden border border-border bg-card/50">
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-contain" />
      ) : (
        <Swords className="h-4 w-4 text-muted-foreground/40" aria-hidden="true" />
      )}
    </span>
  );
}

/** Native fixtures/results list — /admin/events/matchups */
export default function NativeMatchupsList() {
  const navigate = useNavigate();
  const { data: matchups = [], isLoading } = useMatchups();
  const { data: teams = [] } = useTeams();
  const { createMutation } = useMatchupMutations();
  const [query, setQuery] = useState("");
  const [createDraft, setCreateDraft] = useState(null); // null = drawer closed

  const logoIndex = useMemo(() => buildLogoIndex(teams), [teams]);
  const visible = useMemo(() => filterMatchups(sortMatchups(matchups), query), [matchups, query]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(visible, {
    initial: 20,
    step: 20,
    restoreKey: "admin-matchups",
  });

  const openCreate = () => {
    emitHaptic("action.primary");
    setCreateDraft({ ...EMPTY_MATCHUP });
  };

  const submitCreate = async () => {
    if (!canSaveMatchup(createDraft) || createMutation.isPending) return;
    emitHaptic("action.primary");
    try {
      // Web parity: create sends the emptyMatchup-shaped draft as-is (cleaned in the mutationFn).
      await createMutation.mutateAsync(createDraft);
      setCreateDraft(null);
    } catch {
      // onError already toasted; keep the drawer open so nothing is lost.
    }
  };

  return (
    <div className="pb-8">
      <NativeTopBar
        title="Match-ups"
        fallback="/admin/events"
        right={
          <button
            type="button"
            onClick={openCreate}
            aria-label="Add matchup"
            className="ios-pressable flex h-11 min-w-11 items-center justify-center text-primary"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        }
      />
      <PullToRefresh queryKeys={[["matchups"], ["teams"]]}>
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 border border-border bg-card/50 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search club, label, venue"
              aria-label="Search matchups"
              className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <p className="py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Pick fixtures — every NRL &amp; Super League club is built in. After a game, open it and switch on
            &ldquo;Game finished?&rdquo; to publish the result.
          </p>
        </div>

        {isLoading && matchups.length === 0 ? (
          <div className="space-y-2 px-4">
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
            <NativeSkeleton className="h-20 w-full" />
          </div>
        ) : windowed.length === 0 ? (
          <div className="px-4 pt-4">
            <NativeEmptyState
              icon={Trophy}
              title="No matchups yet"
              description={matchups.length === 0 ? "Add your first fixture with the + button." : "Nothing matches this search right now."}
            />
          </div>
        ) : (
          <div>
            {windowed.map((matchup) => {
              const isFinal = matchup.status === "final";
              return (
                <button
                  key={matchup.id}
                  type="button"
                  onClick={() => {
                    emitHaptic("tab.select");
                    navigate(`/admin/events/matchups/${encodeURIComponent(matchup.id)}`);
                  }}
                  className={`ios-pressable flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left ${
                    matchup.is_published === false ? "opacity-60" : ""
                  }`}
                  style={{ borderLeft: isFinal ? "3px solid rgb(16,185,129)" : "3px solid rgb(14,165,233)" }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <FixtureCrest src={matchup.home_logo} alt={matchup.home_team} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">{matchup.home_team || "Home"}</p>
                      <p className="truncate text-xs font-bold">{matchup.away_team || "Away"}</p>
                    </div>
                    <FixtureCrest src={matchup.away_logo} alt={matchup.away_team} />
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-sm tabular-nums">
                      {isFinal ? (
                        <span className="text-foreground">{matchupScoreline(matchup)}</span>
                      ) : (
                        <span className="text-primary">VS</span>
                      )}
                    </p>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                      {isFinal
                        ? matchup.result_note || "Full Time"
                        : formatKickoff(matchup.kickoff) || matchup.label || "Scheduled"}
                    </p>
                    {matchup.is_published === false && (
                      <span className="mt-1 inline-block border border-border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                        Hidden
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
          </div>
        )}
      </PullToRefresh>

      <MobileActionDrawer
        open={!!createDraft}
        onOpenChange={(open) => {
          if (!open) setCreateDraft(null);
        }}
        title="Add match-up"
        description="Shows on the homepage near the countdown as soon as it's published."
      >
        {createDraft && (
          <>
            <MatchupFormFields value={createDraft} onChange={setCreateDraft} logoIndex={logoIndex} idPrefix="native-matchup-create" />
            <label className="mt-4 flex min-h-11 items-center justify-between border border-border bg-card/50 px-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Published</span>
              <Switch checked={createDraft.is_published !== false} onCheckedChange={(v) => setCreateDraft({ ...createDraft, is_published: v })} />
            </label>
            <div className="grid grid-cols-2 gap-2 pt-4">
              <button
                type="button"
                disabled={createMutation.isPending}
                onClick={() => setCreateDraft(null)}
                className="ios-pressable flex min-h-11 items-center justify-center border border-border text-xs font-bold uppercase tracking-widest disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSaveMatchup(createDraft) || createMutation.isPending}
                onClick={submitCreate}
                className="ios-pressable flex min-h-11 items-center justify-center bg-primary text-xs font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
              >
                {createMutation.isPending ? "Adding…" : "Add match-up"}
              </button>
            </div>
          </>
        )}
      </MobileActionDrawer>
    </div>
  );
}

/** Native fixture editor + result entry — /admin/events/matchups/:matchupId */
export function NativeMatchupDetail() {
  const { matchupId } = useParams();
  const navigate = useNavigate();
  const { data: matchups = [], isLoading } = useMatchups();
  const { data: teams = [] } = useTeams();
  const { updateMutation, deleteMutation } = useMatchupMutations();
  const matchup = useMemo(() => matchups.find((m) => String(m.id) === String(matchupId)) || null, [matchups, matchupId]);

  const logoIndex = useMemo(() => buildLogoIndex(teams), [teams]);
  const [draft, setDraft] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Web parity (startEdit): seed the edit draft from the record over the empty
  // shape, once, when the fixture first resolves from the query.
  useEffect(() => {
    if (matchup && !draft) setDraft(matchupEditSeed(matchup));
  }, [matchup, draft]);

  const save = () => {
    if (!draft || !canSaveMatchup(draft) || updateMutation.isPending) return;
    emitHaptic("action.primary");
    // Web parity (saveEdit): strip id, clean the payload, write the full record.
    updateMutation.mutate(
      { id: matchup.id, data: buildMatchupSavePayload(draft) },
      { onSuccess: () => toast({ title: "Matchup updated" }) }
    );
  };

  // Web parity: the row-level publish Switch persists immediately. The shared
  // builder carries the record's current scores so an unrelated publish flip
  // never nulls a recorded final score.
  const togglePublish = (next) => {
    emitHaptic("action.primary");
    setDraft((d) => (d ? { ...d, is_published: next } : d));
    updateMutation.mutate({ id: matchup.id, data: buildPublishTogglePayload(matchup, next) });
  };

  const confirmDeleteMatchup = async () => {
    try {
      await deleteMutation.mutateAsync(matchup.id);
      setConfirmDelete(false);
      navigate("/admin/events/matchups", { replace: true });
    } catch {
      // onError already toasted; the sheet stays open for retry.
    }
  };

  if (!isLoading && !matchup) {
    return (
      <div>
        <NativeTopBar title="Match-up" fallback="/admin/events/matchups" />
        <div className="px-4 pt-6">
          <NativeEmptyState icon={Swords} title="Match-up not found" description="It may have been removed, or you're offline." />
        </div>
      </div>
    );
  }
  if (!matchup || !draft) {
    return (
      <div>
        <NativeTopBar title="Match-up" fallback="/admin/events/matchups" />
        <div className="space-y-2 px-4 pt-4">
          <NativeSkeleton className="h-24 w-full" />
          <NativeSkeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const isFinal = matchup.status === "final";
  const isPublished = draft.is_published !== false;

  return (
    <div className="pb-10">
      <NativeTopBar title={`${matchup.home_team || "Home"} v ${matchup.away_team || "Away"}`} fallback="/admin/events/matchups" />
      <div className="space-y-4 px-4 pt-3">
        {/* Summary + instant publish toggle (web parity: the row Switch). */}
        <div className="flex items-center gap-3 border border-border/60 bg-card/50 p-3">
          <FixtureCrest src={matchup.home_logo} alt={matchup.home_team} />
          <div className="min-w-0 flex-1 text-center">
            <p className="font-display text-lg tabular-nums">
              {isFinal ? <span className="text-foreground">{matchupScoreline(matchup)}</span> : <span className="text-primary">VS</span>}
            </p>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
              {isFinal ? matchup.result_note || "Full Time" : formatKickoff(matchup.kickoff) || "Scheduled"}
            </p>
          </div>
          <FixtureCrest src={matchup.away_logo} alt={matchup.away_team} />
        </div>

        <label className="flex min-h-11 items-center justify-between border border-border/60 bg-card/50 px-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {isPublished ? "Published — visible on the homepage" : "Hidden — not shown on the homepage"}
          </span>
          <Switch checked={isPublished} disabled={updateMutation.isPending} onCheckedChange={togglePublish} />
        </label>

        <div className="border border-border/60 bg-card/50 p-3">
          <MatchupFormFields value={draft} onChange={setDraft} logoIndex={logoIndex} idPrefix="native-matchup-edit" />
        </div>

        <button
          type="button"
          disabled={!canSaveMatchup(draft) || updateMutation.isPending}
          onClick={save}
          className="ios-pressable flex min-h-12 w-full items-center justify-center gap-1.5 bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
        >
          <Check className="h-4 w-4" aria-hidden="true" /> {updateMutation.isPending ? "Saving…" : "Save changes"}
        </button>

        <button
          type="button"
          onClick={() => {
            emitHaptic("mutation.warning");
            setConfirmDelete(true);
          }}
          className="ios-pressable flex min-h-11 w-full items-center justify-center gap-1.5 border border-red-500/40 text-xs font-bold uppercase tracking-widest text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete match-up
        </button>
      </div>

      <AdminConfirmSheet
        open={confirmDelete}
        variant="destructive"
        title="Delete this match-up?"
        description="This permanently removes the fixture from the homepage. This can't be undone."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={confirmDeleteMatchup}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
