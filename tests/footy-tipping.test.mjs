import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  isFinishedGame, hasKickedOff, isTippable, checkTipResult,
  buildRounds, defaultRoundIndex, computeStreaks, communityFavourite,
  shortRoundLabel,
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

test("ladder rows key on user_id, dedupe per game, and rank by points then wins", () => {
  const entries = [
    // Two different accounts sharing a display name must NOT merge.
    { game_id: "g1", user_id: "u1", tipper_name: "Dane", points: 5, result: "perfect", settled_at: "x", game_label: "NRL Round 23" },
    { game_id: "g2", user_id: "u1", tipper_name: "Dane", points: 3, result: "win", settled_at: "x", game_label: "NRL Round 24" },
    { game_id: "g1", user_id: "u2", tipper_name: "Dane", points: 0, result: "loss", settled_at: "x", game_label: "NRL Round 23" },
    // Duplicate row for the same game+user counts once.
    { game_id: "g1", user_id: "u1", tipper_name: "Dane", points: 5, result: "perfect", settled_at: "x", game_label: "NRL Round 23" },
    // Guest entry keyed by name.
    { game_id: "g1", user_id: "", tipper_name: "Walk-up", points: 3, result: "win", settled_at: "x", game_label: "NRL Round 23" },
  ];
  const rows = buildLadderRows(entries, { myUserId: "u2" });
  assert.equal(rows.length, 3, "u1, u2 and the guest");
  assert.equal(rows[0].points, 8, "u1 tops the ladder with 5+3");
  assert.equal(rows[0].tips, 2, "the duplicate g1 row deduped");
  assert.equal(rows.find((r) => r.me)?.key, "u2", "me-flag follows user_id, not the shared display name");
  // Round scope filters by game_label.
  const roundRows = buildLadderRows(entries, { roundLabel: "NRL Round 24" });
  assert.equal(roundRows.length, 1);
  assert.equal(roundRows[0].points, 3);
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

test("tips hydrate from the account's server entries on a fresh device", () => {
  const sp = read("../src/components/forum/ScorePredictor.jsx");
  assert.ok(sp.includes("hydratedRef"), "hydration must run once, not loop");
  assert.ok(sp.includes("e.user_id !== user.id || tips[e.game_id]"), "only MY missing games hydrate");
});
