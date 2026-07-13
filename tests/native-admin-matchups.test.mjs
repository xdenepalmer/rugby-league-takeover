import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EMPTY_MATCHUP,
  cleanMatchupPayload,
  normTeamName,
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
} from "../src/native/admin/workflows/matchups-helpers.js";
import { ALL_TEAMS } from "../src/lib/nrl-teams.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Empty-draft shape parity ─────────────────────────────────────────────
test("EMPTY_MATCHUP is byte-compatible with the web emptyMatchup shape", () => {
  assert.deepEqual(EMPTY_MATCHUP, {
    home_team: "",
    home_logo: "",
    away_team: "",
    away_logo: "",
    kickoff: "",
    label: "",
    venue: "",
    ticket_url: "",
    sort_order: 1,
    is_published: true,
    status: "scheduled",
    home_score: null,
    away_score: null,
    result_note: "",
  });
  // Every field of the native draft must exist in the web manager's source —
  // the native create can never invent a field the web doesn't write.
  const web = read("../src/components/admin/MatchupsManager.jsx");
  for (const field of Object.keys(EMPTY_MATCHUP)) {
    assert.ok(web.includes(field), `web MatchupsManager writes ${field}`);
  }
});

// ── Score coercion parity (cleanPayload) ─────────────────────────────────
test("cleanMatchupPayload coerces scores exactly like the web cleanPayload", () => {
  assert.deepEqual(cleanMatchupPayload({ home_score: "", away_score: undefined }), { home_score: null, away_score: null });
  assert.deepEqual(cleanMatchupPayload({ home_score: "12", away_score: 6 }), { home_score: 12, away_score: 6 });
  assert.deepEqual(cleanMatchupPayload({ home_score: "abc", away_score: "0" }), { home_score: 0, away_score: 0 }, "non-numeric falls back to 0 (web parity)");
  // Other fields pass through untouched.
  const out = cleanMatchupPayload({ home_team: "Melbourne Storm", is_published: false, home_score: 4, away_score: 2 });
  assert.equal(out.home_team, "Melbourne Storm");
  assert.equal(out.is_published, false);
});

// ── Logo snapshot resolution (logoByName) ────────────────────────────────
test("logo index snapshots each club's logo_url by normalised name", () => {
  const idx = buildLogoIndex([
    { name: "Melbourne Storm", logo_url: "https://x/storm.png" },
    { name: "Wigan Warriors", logo_url: "" },
  ]);
  assert.equal(logoForTeam(idx, "melbourne STORM "), "https://x/storm.png", "case/space-insensitive lookup");
  assert.equal(logoForTeam(idx, "Wigan Warriors"), "", "missing crest resolves to empty string");
  assert.equal(logoForTeam(idx, "Unknown Club"), "", "unknown club resolves to empty string");
  assert.equal(normTeamName("  Melbourne STORM "), "melbourne storm");
});

// ── List ordering + native-only search ───────────────────────────────────
test("sortMatchups orders by ascending sort_order (web parity) without mutating", () => {
  const input = [{ id: "a", sort_order: 3 }, { id: "b", sort_order: 1 }, { id: "c" }];
  assert.deepEqual(sortMatchups(input).map((m) => m.id), ["c", "b", "a"], "missing sort_order sorts as 0");
  assert.equal(input[0].id, "a", "source array untouched");
});

test("filterMatchups narrows on club / label / venue / result note (additive, read-only)", () => {
  const list = [
    { id: "1", home_team: "Melbourne Storm", away_team: "Penrith Panthers", label: "Opener", venue: "Allegiant" },
    { id: "2", home_team: "Wigan Warriors", away_team: "Leeds Rhinos", result_note: "Golden Point" },
  ];
  assert.deepEqual(filterMatchups(list, "storm").map((m) => m.id), ["1"]);
  assert.deepEqual(filterMatchups(list, "leeds").map((m) => m.id), ["2"]);
  assert.deepEqual(filterMatchups(list, "allegiant").map((m) => m.id), ["1"], "venue is searchable");
  assert.deepEqual(filterMatchups(list, "golden").map((m) => m.id), ["2"], "result note is searchable");
  assert.equal(filterMatchups(list, "").length, 2, "empty query returns all");
  assert.deepEqual(filterMatchups(null, "x"), [], "null-safe");
});

// ── Save gating + payloads ───────────────────────────────────────────────
test("canSaveMatchup requires both clubs, like the web disabled state", () => {
  assert.equal(canSaveMatchup(EMPTY_MATCHUP), false);
  assert.equal(canSaveMatchup({ home_team: "Melbourne Storm" }), false);
  assert.equal(canSaveMatchup({ home_team: "Melbourne Storm", away_team: "Penrith Panthers" }), true);
  assert.equal(canSaveMatchup(null), false);
});

test("edit seed overlays the record on the empty shape (web startEdit)", () => {
  const seed = matchupEditSeed({ id: "m1", home_team: "Melbourne Storm", status: "final", home_score: 10 });
  assert.equal(seed.away_team, "", "unset fields come from EMPTY_MATCHUP");
  assert.equal(seed.home_team, "Melbourne Storm");
  assert.equal(seed.status, "final");
  assert.equal(seed.result_note, "");
});

test("save payload strips id and cleans scores (web saveEdit → cleanPayload)", () => {
  const payload = buildMatchupSavePayload({ id: "m1", home_team: "Melbourne Storm", away_team: "Penrith Panthers", home_score: "18", away_score: "", is_published: true });
  assert.equal("id" in payload, false, "id is not written back into the record");
  assert.equal(payload.home_score, 18);
  assert.equal(payload.away_score, null);
  assert.equal(payload.home_team, "Melbourne Storm");
  assert.equal(payload.is_published, true);
});

test("publish toggle writes ONLY is_published (partial update never touches scores)", () => {
  // A publish flip must not modify scores at all — base44/Supabase .update is a
  // partial write, so a final game keeps its recorded score and a scheduled
  // game is never coerced to 0-0 (both are the web row-toggle's score bug).
  const final = { id: "m1", status: "final", home_score: 24, away_score: 12, is_published: true };
  assert.deepEqual(buildPublishTogglePayload(final, false), { is_published: false });
  const scheduled = { id: "m2", status: "scheduled", home_score: null, away_score: null };
  assert.deepEqual(buildPublishTogglePayload(scheduled, true), { is_published: true });
});

// ── Scoreline + picker grouping ──────────────────────────────────────────
test("matchupScoreline shows the score line when final, VS otherwise", () => {
  assert.equal(matchupScoreline({ status: "final", home_score: 24, away_score: 12 }), "24 - 12");
  assert.equal(matchupScoreline({ status: "final", home_score: null, away_score: null }), "- - -");
  assert.equal(matchupScoreline({ status: "scheduled" }), "VS");
});

test("team picker groups NRL then British Super League from ALL_TEAMS (web TeamSelect)", () => {
  const groups = groupTeamsByLeague(ALL_TEAMS);
  assert.deepEqual(groups.map((g) => g.league), ["NRL", "Super League"]);
  assert.deepEqual(groups.map((g) => g.label), ["NRL", "British Super League"]);
  const total = groups.reduce((n, g) => n + g.teams.length, 0);
  assert.equal(total, ALL_TEAMS.length, "every built-in club is offered");
  assert.ok(groups[0].teams.every((t) => t.league === "NRL"));
  assert.ok(groups[1].teams.every((t) => t.league === "Super League"));
});

// ── Source contracts: writes, authority, cache and native UX rules ───────
test("native matchups workflow writes through the same entity calls as the web", () => {
  const src = read("../src/native/admin/workflows/NativeMatchupsWorkflow.jsx");
  assert.ok(src.includes("base44.entities.Matchup.create"), "create through the entity");
  assert.ok(src.includes("base44.entities.Matchup.update"), "update through the entity");
  assert.ok(src.includes("base44.entities.Matchup.delete"), "delete through the entity");
  assert.ok(src.includes('Matchup.list("sort_order", 100)'), "same matchups fetch shape as the web wiring");
  assert.ok(src.includes('Team.list("sort_order", 100)'), "same teams fetch shape as the web wiring");
  assert.ok(src.includes('queryKey: ["matchups"]'), "same matchups query key — cache shared with web panels");
  assert.ok(src.includes('queryKey: ["teams"]'), "same teams query key — shared with the teams/home consumers");
  assert.ok(src.includes('invalidateQueries({ queryKey: ["matchups"] })'), "invalidates only ['matchups'], like the web manager");
  assert.ok(!src.includes('invalidateQueries({ queryKey: ["teams"]'), "web never invalidates teams from the matchups write path");
  assert.ok(!src.includes("functions.invoke"), "matchups has no edge-function calls (web parity)");
});

test("payload builders are the single write path (no inline drift)", () => {
  const src = read("../src/native/admin/workflows/NativeMatchupsWorkflow.jsx");
  assert.ok(src.includes("cleanMatchupPayload"), "create cleans scores through the shared helper");
  assert.ok(src.includes("buildMatchupSavePayload"), "full save flows through the shared builder");
  assert.ok(src.includes("buildPublishTogglePayload"), "publish toggle flows through the shared builder");
  assert.ok(src.includes("canSaveMatchup"), "save gating uses the shared rule");
});

test("no invented audit events: the web MatchupsManager dispatches none", () => {
  const web = read("../src/components/admin/MatchupsManager.jsx");
  const src = read("../src/native/admin/workflows/NativeMatchupsWorkflow.jsx");
  assert.ok(!web.includes("rlt_admin_log") && !web.includes("emitAdminLog"), "web dispatches no matchup audit events");
  assert.ok(!src.includes("emitAdminLog") && !src.includes("dispatchEvent"), "native matches: same (empty) event set");
});

test("no localStorage: the web MatchupsManager reads/writes none", () => {
  const web = read("../src/components/admin/MatchupsManager.jsx");
  const src = read("../src/native/admin/workflows/NativeMatchupsWorkflow.jsx");
  assert.ok(!web.includes("localStorage"), "web matchups uses no localStorage");
  assert.ok(!src.includes("localStorage"), "native matchups invents no localStorage");
});

test("kickoff picker reuses the exact web control (DateTimePicker)", () => {
  const src = read("../src/native/admin/workflows/NativeMatchupsWorkflow.jsx");
  assert.ok(src.includes('import DateTimePicker from "@/components/admin/DateTimePicker"'), "same kickoff control as the web manager");
  assert.ok(src.includes('from "@/lib/nrl-teams"'), "same built-in club roster as the web TeamSelect");
});

test("toast copy matches the web manager verbatim", () => {
  const src = read("../src/native/admin/workflows/NativeMatchupsWorkflow.jsx");
  for (const title of ["Matchup added", "Matchup updated", "Matchup removed"]) {
    assert.ok(src.includes(`"${title}"`), `native keeps the web toast: ${title}`);
  }
});

test("destructive delete is confirmed and dialogs await via mutateAsync", () => {
  const src = read("../src/native/admin/workflows/NativeMatchupsWorkflow.jsx");
  assert.ok(src.includes("AdminConfirmSheet"), "delete goes through the confirm sheet");
  assert.ok(src.includes("MobileActionDrawer"), "the create form lives in a drawer");
  assert.ok(src.includes("deleteMutation.mutateAsync"), "delete sheet awaits settlement");
  assert.ok(src.includes("createMutation.mutateAsync"), "create drawer awaits settlement");
});

test("native matchups UX contracts: windowing, haptics, no hover-only affordances", () => {
  const src = read("../src/native/admin/workflows/NativeMatchupsWorkflow.jsx");
  assert.ok(src.includes("useWindowedList"), "long lists are windowed");
  assert.ok(src.includes('restoreKey: "admin-matchups"'), "window depth survives remounts for scroll restore");
  for (const event of ["tab.select", "action.primary", "mutation.warning", "save.success", "mutation.error"]) {
    assert.ok(src.includes(`"${event}"`), `haptic event ${event} used`);
  }
  assert.ok(!src.includes("group-hover:"), "no hover-only affordances");
  assert.ok(!/from ["']@capacitor/.test(src), "no static @capacitor imports");
  assert.ok(src.includes("NativeEmptyState") && src.includes("NativeSkeleton"), "empty + loading states");
  assert.ok(src.includes("PullToRefresh"), "pull to refresh the matchups + teams queries");
  assert.ok(src.includes("NativeTopBar"), "self-chromed");
  assert.ok(src.includes('fallback="/admin/events"'), "top bar falls back to the events hub");
});

test("detail screen is URL-addressable and export names are stable", () => {
  const src = read("../src/native/admin/workflows/NativeMatchupsWorkflow.jsx");
  assert.ok(src.includes("export default function NativeMatchupsList"), "default export is the list screen");
  assert.ok(src.includes("export function NativeMatchupDetail"), "named detail export for the route");
  assert.ok(src.includes("useParams"), "detail resolves the fixture from the URL");
  assert.ok(src.includes("/admin/events/matchups/${encodeURIComponent("), "list rows deep-link to the detail route");
});
