import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_TIERS,
  evaluateAchievements,
  normalizeStats,
} from "../src/lib/achievements.js";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const readSchema = (p) => JSON.parse(read(p));

test("achievement catalog has a valid, unique, well-formed shape", () => {
  const ids = new Set();
  const cats = new Set(ACHIEVEMENT_CATEGORIES.map((c) => c.key));
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.id && !ids.has(a.id), `duplicate or missing id: ${a.id}`);
    ids.add(a.id);
    for (const f of ["title", "description", "emoji", "category", "tier", "metric"]) {
      assert.ok(a[f], `${a.id} missing ${f}`);
    }
    assert.ok(Number.isFinite(a.threshold) && a.threshold > 0, `${a.id} threshold must be > 0`);
    assert.ok(Number.isFinite(a.reward_chips) && a.reward_chips >= 0, `${a.id} reward_chips invalid`);
    assert.ok(cats.has(a.category), `${a.id} has unknown category ${a.category}`);
    assert.ok(ACHIEVEMENT_TIERS.includes(a.tier), `${a.id} has unknown tier ${a.tier}`);
  }
});

test("evaluateAchievements unlocks nothing for a brand-new fan", () => {
  const { unlockedCount, total, items } = evaluateAchievements(normalizeStats({}));
  assert.equal(unlockedCount, 0);
  assert.equal(total, ACHIEVEMENTS.length);
  for (const i of items) {
    assert.equal(i.unlocked, false);
    assert.ok(i.pct >= 0 && i.pct <= 100);
  }
});

test("evaluateAchievements unlocks by threshold and reports progress", () => {
  const stats = normalizeStats({ casino_total_posts: 10 });
  const { items } = evaluateAchievements(stats);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(byId.forum_first_post.unlocked, true);
  assert.equal(byId.forum_posts_10.unlocked, true);
  assert.equal(byId.forum_posts_50.unlocked, false);
  assert.equal(byId.forum_posts_50.pct, 20); // 10 / 50
});

test("normalizeStats derives slot badge counts incl. legendary tier", () => {
  const stats = normalizeStats({ badges: ["cherry", "crown", "seven"] });
  assert.equal(stats.badge_count, 3);
  assert.equal(stats.legendary_badge_count, 2); // crown + seven
  const { items } = evaluateAchievements(stats);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(byId.slots_first_badge.unlocked, true);
  assert.equal(byId.slots_legendary.unlocked, true);
  assert.equal(byId.slots_full_set.unlocked, false);
});

test("a maxed-out fan unlocks the entire catalog", () => {
  const stats = normalizeStats({
    casino_total_posts: 100, casino_total_replies: 100,
    casino_total_reactions_given: 100, casino_total_reactions_received: 200,
    casino_streak: 60, casino_xp: 5000, casino_chips: 5000,
    badges: ["cherry", "lemon", "bell", "dice", "chip", "star", "footy", "clover", "diamond", "crown", "moneybag", "seven"],
  });
  const { unlockedCount, total } = evaluateAchievements(stats);
  assert.equal(unlockedCount, total);
});

test("AchievementUnlock entity exists with owner-readable, admin-write RLS", () => {
  const e = readSchema("../base44/entities/AchievementUnlock.jsonc");
  for (const f of ["user_id", "achievement_id", "tier", "category", "reward_chips", "unlocked_at"]) {
    assert.ok(e.properties[f], `AchievementUnlock missing ${f}`);
  }
  assert.deepEqual(e.required, ["user_id", "achievement_id"]);
  assert.equal(e.rls.create.user_condition.role, "admin");
  assert.equal(e.rls.update.user_condition.role, "admin");
  assert.equal(e.rls.delete.user_condition.role, "admin");
  // read: own rows OR admin
  const reads = JSON.stringify(e.rls.read);
  assert.match(reads, /\{\{user\.id\}\}/, "owner must be able to read their own unlocks");
  assert.match(reads, /admin/, "admin must be able to read all unlocks");
});

test("evaluateAchievements function gates on auth, dedups, and awards once", () => {
  const src = read("../base44/functions/evaluateAchievements/entry.ts");
  assert.match(src, /Login required/, "must require an authenticated caller");
  assert.match(src, /AchievementUnlock\.filter/, "must read existing unlocks to dedup");
  assert.match(src, /newly\s*=\s*metIds\.filter\(\(id\)\s*=>\s*!recorded\.has\(id\)\)/, "must only record not-yet-recorded unlocks");
  assert.match(src, /casino_chips:\s*num\(fullUser\?\.casino_chips\)\s*\+\s*awardedChips/, "must award chips once for new unlocks");
});

test("backend catalog stays in sync with the source catalog size", () => {
  const fnSrc = read("../base44/functions/evaluateAchievements/entry.ts");
  const fnIds = (fnSrc.match(/id:\s*'[a-z0-9_]+'/g) || []).length;
  assert.equal(fnIds, ACHIEVEMENTS.length, "function catalog id count must match src/lib/achievements.js");
});
