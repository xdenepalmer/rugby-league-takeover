import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  isFinishedGame, hasKickedOff, isTippable, checkTipResult,
  buildRounds, defaultRoundIndex, computeStreaks, communityFavourite,
  shortRoundLabel, mergeFixtures, remapTipIds, isSameFixture,
} from "../src/components/forum/tipping/tipHelpers.js";
import { buildLadderRows } from "../src/components/forum/tipping/ladder.js";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
const submit = () => read("../supabase/functions/submitTip/index.ts");

const future = (h) => new Date(Date.now() + h * 3600000).toISOString();
const past = (h) => new Date(Date.now() - h * 3600000).toISOString();

// ── Status normalization: admin 'final' == API 'finished' ───────────────────

test("admin matchups marked 'final' surface their result exactly like API 'finished'", () => {
  // The matchups CHECK constraint only allows scheduled|final, but the old
  // client keyed off 'finished' alone — every admin game's result (and its
  // points) was invisible.
  const adminFinal = { status: "final", home_score: 24, away_score: 12, home_team: "Broncos", away_team: "Storm" };
  const apiFinished = { ...adminFinal, status: "finished" };
  assert.equal(isFinishedGame(adminFinal), true);
  assert.equal(isFinishedGame(apiFinished), true);
  assert.equal(isFinishedGame({ status: "final", home_score: null, away_score: null }), false, "no scores, no result");

  const tip = { selected_team: "Broncos", margin: 12, tipped_at: past(24) };
  const result = checkTipResult(adminFinal, tip);
  assert.ok(result, "a final admin game must produce a result");
  assert.equal(result.correct, true);
  assert.equal(result.perfectMargin, true);
  assert.equal(result.points, 5, "3 for the winner + 2 exact margin");
});

test("the tipping lock follows kickoff, live and final states", () => {
  assert.equal(isTippable({ kickoff: future(2), status: "upcoming" }), true);
  assert.equal(isTippable({ kickoff: past(1), status: "upcoming" }), false, "kicked off");
  assert.equal(isTippable({ kickoff: future(2), status: "live" }), false, "live beats a wrong clock");
  assert.equal(isTippable({ kickoff: future(2), status: "final", home_score: 10, away_score: 2 }), false, "final beats a wrong clock");
  assert.equal(isTippable({ kickoff: null, status: "upcoming" }), true, "TBA kickoff stays open; the server is the backstop");
  assert.equal(hasKickedOff({ kickoff: past(1) }), true);
});

// ── Rounds ──────────────────────────────────────────────────────────────────

test("fixtures group into kickoff-ordered rounds with a deadline and a state", () => {
  const fixtures = [
    { id: "c", label: "NRL Round 24", kickoff: future(170), status: "upcoming" },
    { id: "a1", label: "NRL Round 23", kickoff: future(2), status: "upcoming" },
    { id: "a2", label: "NRL Round 23", kickoff: future(26), status: "upcoming" },
    { id: "z", label: "NRL Round 22", kickoff: past(90), status: "finished", home_score: 10, away_score: 8 },
  ];
  const rounds = buildRounds(fixtures);
  assert.deepEqual(rounds.map((r) => r.label), ["NRL Round 22", "NRL Round 23", "NRL Round 24"], "rounds order by earliest kickoff");
  assert.equal(rounds[0].state, "done");
  assert.equal(rounds[1].state, "open");
  assert.equal(rounds[1].deadline, new Date(fixtures[1].kickoff).getTime(), "deadline is the next open kickoff");
  assert.deepEqual(rounds[1].games.map((g) => g.id), ["a1", "a2"], "games inside a round sort by kickoff");
  // Land the fan on the round that needs tips, not the finished one.
  assert.equal(defaultRoundIndex(rounds), 1);
  assert.equal(shortRoundLabel("NRL Round 23"), "RD 23");
});

test("a fully-kicked-off but unfinished round reads as locked, a live one as live", () => {
  const locked = buildRounds([{ id: "x", label: "R", kickoff: past(1), status: "upcoming" }]);
  assert.equal(locked[0].state, "locked");
  const live = buildRounds([{ id: "x", label: "R", kickoff: past(1), status: "live" }]);
  assert.equal(live[0].state, "live");
  // When every round is done, default to the latest instead of index 0.
  const allDone = buildRounds([
    { id: "1", label: "R1", kickoff: past(200), status: "finished", home_score: 1, away_score: 0 },
    { id: "2", label: "R2", kickoff: past(100), status: "finished", home_score: 1, away_score: 0 },
  ]);
  assert.equal(defaultRoundIndex(allDone), 1);
});

// ── Streaks ─────────────────────────────────────────────────────────────────

test("streaks count consecutive wins in kickoff order, not array order", () => {
  const results = [
    { kickoff: past(10), correct: true },   // most recent
    { kickoff: past(200), correct: true },  // oldest
    { kickoff: past(50), correct: false },
    { kickoff: past(30), correct: true },
    { kickoff: past(20), correct: true },
  ];
  const { current, best } = computeStreaks(results);
  assert.equal(current, 3, "three straight wins since the last miss");
  assert.equal(best, 3);
  assert.deepEqual(computeStreaks([]), { current: 0, best: 0 });
  assert.equal(computeStreaks([{ kickoff: past(1), correct: false }]).current, 0);
});

// ── Community favourite (auto-fill source) ──────────────────────────────────

test("auto-fill backs the community favourite and abstains on silence or a tie", () => {
  const game = { id: "g1", home_team: "Broncos", away_team: "Storm" };
  const entries = [
    { game_id: "g1", selected_team: "Storm" },
    { game_id: "g1", selected_team: "Storm" },
    { game_id: "g1", selected_team: "Broncos" },
    { game_id: "other", selected_team: "Broncos" },
  ];
  assert.equal(communityFavourite(game, entries), "Storm");
  assert.equal(communityFavourite(game, []), null, "no tips → no favourite (falls back to home)");
  assert.equal(communityFavourite(game, entries.slice(1, 3)), null, "a tie is not a favourite");
});

// ── Ladder ──────────────────────────────────────────────────────────────────

test("ladder sums the DB aggregate per account, scoped to a round on demand", () => {
  // Rows come from tipping_ladder_view: already grouped per (account, round),
  // with an opaque tipster_key so two same-named accounts stay distinct and
  // no user uuid leaks to other viewers.
  const rows = [
    { tipster_key: "k1", tipper_name: "Dane", game_label: "NRL Round 23", tips: 3, points: 8, wins: 2, settled: 3, is_me: false },
    { tipster_key: "k1", tipper_name: "Dane", game_label: "NRL Round 24", tips: 2, points: 3, wins: 1, settled: 2, is_me: false },
    // Same DISPLAY NAME, different account — must never merge.
    { tipster_key: "k2", tipper_name: "Dane", game_label: "NRL Round 23", tips: 3, points: 0, wins: 0, settled: 3, is_me: true },
    { tipster_key: "k3", tipper_name: "Mick", game_label: "NRL Round 24", tips: 1, points: 5, wins: 1, settled: 1, is_me: false },
  ];
  const season = buildLadderRows(rows);
  assert.equal(season.length, 3, "two same-named accounts stay separate");
  assert.deepEqual(season.map((r) => r.key), ["k1", "k3", "k2"], "ranked by points");
  assert.equal(season[0].points, 11, "a season row sums every round");
  assert.equal(season[0].tips, 5);
  assert.equal(season.find((r) => r.me)?.key, "k2", "the me-flag comes from the server, not a name match");
  assert.deepEqual(season.map((r) => r.rank), [1, 2, 3]);

  const round24 = buildLadderRows(rows, { roundLabel: "NRL Round 24" });
  assert.deepEqual(round24.map((r) => r.key), ["k3", "k1"], "round scope re-ranks on that round alone");
  assert.equal(round24[0].points, 5);

  assert.deepEqual(buildLadderRows(null), [], "no rows, no ladder");
});

// ── Editable-until-kickoff (server contract) ────────────────────────────────

test("submitTip treats a repeat submission as an edit while the game is open", () => {
  const src = submit();
  assert.match(src, /updated: true/, "the update path must exist and identify itself");
  assert.doesNotMatch(src, /code: 'duplicate'/, "the 409 duplicate bounce is gone — repeat = edit");
  assert.match(src, /\.is\('settled_at', null\)/, "an edit must never touch a settled entry");
});

test("submitTip edits still respect the kickoff lock, including the stored kickoff", () => {
  const src = submit();
  // For API fixtures with no DB row the STORED kickoff is authoritative on
  // edit — a client can't post a fresh future kickoff to keep editing after
  // the game started.
  assert.match(src, /storedKickoffMs <= Date\.now\(\)/, "stored kickoff must gate the edit");
  assert.match(src, /mine\.settled_at \|\| storedLocked/, "settled or kicked-off entries reject the edit");
  // And the pre-existing locks stay: DB status + kickoff checked before any write.
  assert.match(src, /matchup\.status !== 'scheduled'/);
  assert.match(src, /kickoffMs <= Date\.now\(\)/);
});

// ── Client wiring ───────────────────────────────────────────────────────────

test("the client offers Edit until kickoff and routes edits through submitTip", () => {
  const sp = read("../src/components/forum/ScorePredictor.jsx");
  assert.ok(sp.includes("canEdit={open}"), "receipt must offer Edit while the game is open");
  assert.ok(sp.includes("{ isEdit }"), "handleTip must distinguish edits (no double badge event)");
  assert.ok(sp.includes('functions.invoke("submitTip"'), "edits share the server-authoritative write path");
  assert.ok(sp.includes("You can change this until kickoff"), "the receipt must say tips are editable");
  assert.ok(!sp.includes("No take-backs"), "the permanent-tips copy is gone");
});

test("season stats come from ALL fixtures + settled entries, never the visible filter", () => {
  const sp = read("../src/components/forum/ScorePredictor.jsx");
  assert.ok(sp.includes("allFixtures"), "an unfiltered fixture list must exist");
  assert.ok(sp.includes("settledByGame"), "server-settled entries are authoritative for my points");
  assert.ok(sp.includes("if (settledByGame.has(g.id)) return;"), "local scoring must not double-count settled games");
  assert.ok(sp.includes("writeJson(TIP_STREAK_KEY, streaks.current)"), "the streak key is finally written");
});

test("tips hydrate from the account's own entry feed on a fresh device", () => {
  const sp = read("../src/components/forum/ScorePredictor.jsx");
  assert.ok(sp.includes("hydratedRef"), "hydration must run once, not loop");
  // My entries come from a dedicated per-user query, not the shared community
  // feed: that feed is capped by other tippers' volume, so mid-season my own
  // older tips fell outside it and simply vanished from my score.
  assert.ok(sp.includes('queryKey: ["myTippingEntries", user?.id]'), "my entries need their own query");
  assert.ok(sp.includes("TippingEntry.filter({ user_id: user.id }"), "scoped server-side to my account");
  assert.ok(sp.includes("myEntries.forEach"), "hydration and settled points read the per-user feed");
});

// ── Fixes from the adversarial verification pass ────────────────────────────

test("a scored or kickoff-less admin game is closed, whatever its status says", () => {
  const src = submit();
  // Status alone left a window: admin enters the real score, hasn't flipped
  // 'final' yet, and a tipper edits to the observed result for a guaranteed
  // perfect tip (+5 pts, 150 chips, 50 XP).
  assert.match(src, /matchup\.home_score != null \|\| matchup\.away_score != null/, "a result closes tipping");
  // No kickoff means no lock can ever apply — the entry would stay writable
  // forever, including after full time.
  assert.match(src, /code: 'no_kickoff'/, "a game with no kickoff cannot be tipped");
  assert.match(src, /!Number\.isFinite\(storedKickoffMs\) \|\| storedKickoffMs <= Date\.now\(\)/, "an entry with no stored kickoff can't be edited");
});

test("an anonymous submission can never edit a signed-in tipper's entry", () => {
  const src = submit();
  // Guests are identified by IP. Behind a NAT/CGNAT that IP is shared, so
  // matching it against ANY entry let a logged-out visitor rewrite an
  // account's tip.
  assert.match(src, /query\.eq\('ip_address', ip\)\.eq\('user_id', ''\)/, "anon matches only other anon entries");
  assert.match(src, /query\.eq\('user_id', user\.id\)/, "a signed-in caller matches on their account");
  assert.doesNotMatch(src, /\.limit\(500\)/, "the entry lookup must be targeted, not a 500-row scan");
});

test("the same real match arriving from both sources resolves to one fixture", () => {
  // Admin uuid vs `nrl-api-N`: a raw date-string comparison broke on
  // timezone-boundary kickoffs and on TBA admin games, so one match could
  // render (and be tipped, and be scored) twice.
  const admin = { id: "uuid-1", home_team: "Brisbane Broncos", away_team: "Melbourne Storm", kickoff: "2026-08-07T09:50:00Z", label: "NRL Round 23" };
  const api = { id: "nrl-api-9", home_team: "Brisbane  Broncos", away_team: "Melbourne Storm", kickoff: "2026-08-07T19:50:00+10:00", label: "NRL Round 23" };
  assert.equal(isSameFixture(admin, api), true, "same teams, same kickoff window");

  const other = { id: "nrl-api-10", home_team: "Sydney Roosters", away_team: "Penrith Panthers", kickoff: "2026-08-08T09:00:00Z", label: "NRL Round 23" };
  const { fixtures, idMap } = mergeFixtures([admin], [api, other]);
  assert.deepEqual(fixtures.map((f) => f.id), ["uuid-1", "nrl-api-10"], "the admin row wins, the distinct game survives");
  assert.deepEqual(idMap, { "nrl-api-9": "uuid-1" });

  // A tip saved against the API id must FOLLOW the game that survived.
  const tips = { "nrl-api-9": { selected_team: "Melbourne Storm", margin: 6, tipped_at: past(2), game_id: "nrl-api-9" } };
  const { tips: next, changed } = remapTipIds(tips, idMap);
  assert.equal(changed, true);
  assert.equal(next["nrl-api-9"], undefined, "the orphaned id is gone");
  assert.equal(next["uuid-1"].selected_team, "Melbourne Storm");
  assert.equal(next["uuid-1"].game_id, "uuid-1", "the tip carries the surviving id");
  assert.equal(remapTipIds(tips, {}).changed, false, "no map, no rewrite");
});

test("a TBA fixture sorts last instead of hijacking the default round", () => {
  const rounds = buildRounds([
    { id: "tba", label: "NRL Round 30", kickoff: null, status: "upcoming" },
    { id: "next", label: "NRL Round 23", kickoff: future(3), status: "upcoming" },
  ]);
  assert.deepEqual(rounds.map((r) => r.label), ["NRL Round 23", "NRL Round 30"], "undated rounds go to the end");
  assert.equal(defaultRoundIndex(rounds), 0, "the fan lands on the round they can actually tip");
  assert.equal(rounds[1].deadline, null, "a TBA round advertises no lockout");
});

test("the client celebrates only an accepted tip, and drops rejected ones", () => {
  const sp = read("../src/components/forum/ScorePredictor.jsx");
  // `open` is computed whenever the card last rendered; a card sitting on
  // screen across kickoff still showed its picker, and firing confetti before
  // the guard told the fan a post-kickoff tip was in.
  assert.ok(sp.includes("const accepted = onTip("), "the card must act on handleTip's verdict");
  assert.ok(sp.includes("if (!accepted) {"), "a refused tip must not celebrate");
  assert.ok(sp.includes("if (!isTippable(game)) return false;"), "handleTip re-checks against a fresh clock");
  // A server rejection is not a connectivity problem.
  assert.ok(sp.includes('code === "locked" || code === "no_kickoff"'), "rejections must be told apart from outages");
  assert.ok(sp.includes("removeTipFromQueue(game.id)"), "a rejected tip must not sit in the retry queue");
});

test("a queued offline tip never overwrites a newer one made elsewhere", () => {
  const sp = read("../src/components/forum/ScorePredictor.jsx");
  // Now that a repeat submission EDITS the entry, replaying a stale queued
  // payload would clobber a newer tip made from another device.
  assert.ok(sp.includes("queued_at"), "queued payloads must carry their own timestamp");
  assert.ok(sp.includes("serverTime > queuedTime"), "a superseded queue item is dropped, not replayed");
});

test("the round in view is tracked by label, and time-derived state ticks", () => {
  const sp = read("../src/components/forum/ScorePredictor.jsx");
  // The two fixture queries resolve independently; an index silently pointed
  // at a different round the moment a new one appeared.
  assert.ok(sp.includes("activeRoundLabel"), "the selected round must be identified by label");
  assert.ok(!sp.includes("setRoundIndex"), "the fragile index state is gone");
  assert.ok(sp.includes("useSlowClock"), "round state and lockout countdown must not freeze at first render");
});

test("the team picker renders home / VS / away in that order", () => {
  const sp = read("../src/components/forum/ScorePredictor.jsx");
  // Rendering both buttons then the VS filler let grid auto-placement drop
  // the away team into the narrow middle column of grid-cols-[1fr_auto_1fr].
  const picker = sp.slice(sp.indexOf("{/* Team Picker"), sp.indexOf("{/* Margin:"));
  const home = picker.indexOf("game.home_team");
  const vs = picker.indexOf(">VS<");
  const away = picker.indexOf("game.away_team");
  assert.ok(home >= 0 && vs > home && away > vs, "DOM order must be home, VS, away");
});
