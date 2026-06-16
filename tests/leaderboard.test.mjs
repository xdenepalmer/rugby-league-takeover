import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { safeDisplayName, medalFor, scoreFor, LEADERBOARD_SCOPES } from "../src/lib/leaderboard.js";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

test("safeDisplayName uses first name + last initial, never the email", () => {
  assert.equal(safeDisplayName("Dene Palmer", "deneop24@gmail.com"), "Dene P.");
  assert.equal(safeDisplayName("Madonna", "x@y.com"), "Madonna");
  assert.equal(safeDisplayName("  Sam  Burgess ", "s@b.com"), "Sam B.");
  // No full name → fall back to the email handle (not the full address).
  assert.equal(safeDisplayName("", "rhino_sam@example.com"), "rhino_sam");
  assert.equal(safeDisplayName("", ""), "Fan");
});

test("medalFor only decorates the top three", () => {
  assert.equal(medalFor(1), "🥇");
  assert.equal(medalFor(2), "🥈");
  assert.equal(medalFor(3), "🥉");
  assert.equal(medalFor(4), null);
});

test("scoreFor reads weekly xp for weekly scope, total xp otherwise", () => {
  const entry = { xp: 2500, weekly_xp: 120 };
  assert.equal(scoreFor(entry, "weekly"), 120);
  assert.equal(scoreFor(entry, "alltime"), 2500);
  assert.equal(scoreFor(entry, "team"), 2500);
  assert.equal(scoreFor({}, "weekly"), 0);
});

test("scopes cover weekly, all-time and team", () => {
  assert.deepEqual(LEADERBOARD_SCOPES.map((s) => s.key), ["weekly", "alltime", "team"]);
});

test("leaderboard function is auth-gated and exposes no email", () => {
  const src = read("../base44/functions/leaderboard/entry.ts");
  assert.match(src, /Login required/, "must require an authenticated caller");
  assert.match(src, /asServiceRole\.entities\.User\.list/, "must list users via service role");
  // The projected entry must not leak the raw email field.
  const projection = src.slice(src.indexOf("function project"), src.indexOf("Deno.serve"));
  assert.doesNotMatch(projection, /email:/, "projection must not expose email");
  assert.match(projection, /safeDisplayName\(u\.full_name, u\.email\)/, "must use the privacy-safe display name");
});

test("leaderboard weekly scope aggregates ForumRewardEvent within 7 days", () => {
  const src = read("../base44/functions/leaderboard/entry.ts");
  assert.match(src, /ForumRewardEvent\.list/, "weekly scope must read the reward log");
  assert.match(src, /WEEK_MS\s*=\s*7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/, "must use a 7-day window");
  assert.match(src, /-casino_xp/, "all-time ranking must sort by casino_xp");
});

test("server safeDisplayName mirrors the shared lib implementation", () => {
  const src = read("../base44/functions/leaderboard/entry.ts");
  // Same behaviour as the imported lib version for a representative case.
  assert.match(src, /function safeDisplayName\(fullName, email\)/, "function must inline safeDisplayName");
  assert.match(src, /last\.charAt\(0\)\.toUpperCase\(\)/, "inline copy must keep the last-initial rule");
});
