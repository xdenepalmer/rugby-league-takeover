import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("forum submission requires an account and enforces a server-side rate limit", () => {
  const source = read("../supabase/functions/submitForumPost/index.ts");
  assert.match(source, /if \(!user\?\.id\)/);
  assert.match(source, /Login required to post in the forum/);
  assert.match(source, /\.eq\('user_id', user\.id\)/);
  assert.match(source, /\.gte\('created_date', rateWindowStart\)/);
  assert.match(source, /recentPostCount \|\| 0\) >= 5/);
  assert.match(source, /code: 'rate_limited'/);
  assert.match(source, /\}, 429\)/);
});

test("moderators can delete forum content through the trusted backend", () => {
  const source = read("../supabase/functions/forumAction/index.ts");
  assert.match(source, /user\.role === 'admin' \|\| user\.role === 'moderator'/);
  assert.match(source, /if \(!isOwner && !isModerator\)/);
});

test("community migration masks public identity data", () => {
  const migration = read("../supabase/migrations/0012_community_hardening.sql");
  assert.match(migration, /is_admin\(\)\) then user_email else null/);
  assert.match(migration, /auth\.role\(\)\) = 'authenticated' then user_id else null/);
  assert.match(migration, /auth\.role\(\)\) = 'authenticated' then liked_by else '\[\]'::jsonb/);
  assert.match(migration, /auth\.role\(\)\) = 'authenticated' then reactions else '\{\}'::jsonb/);
});

test("achievement rewards are unique and claimed atomically by a service-only RPC", () => {
  const migration = read("../supabase/migrations/0012_community_hardening.sql");
  const fn = read("../supabase/functions/evaluateAchievements/index.ts");
  assert.match(migration, /unique index if not exists achievement_unlocks_user_achievement_uidx/);
  assert.match(migration, /on conflict \(user_id, achievement_id\) do nothing/);
  assert.match(migration, /casino_chips = coalesce\(casino_chips, 0\) \+ v_awarded_chips/);
  assert.match(migration, /revoke all on function public\.claim_achievement_unlocks[\s\S]*from public, anon, authenticated/);
  assert.match(fn, /\.rpc\('claim_achievement_unlocks'/);
  assert.doesNotMatch(fn, /\.update\(\{ casino_chips:/);
});

test("reaction rewards are one-time and database-atomic", () => {
  const migration = read("../supabase/migrations/0012_community_hardening.sql");
  const action = read("../supabase/functions/forumAction/index.ts");
  assert.match(migration, /forum_reward_events_reaction_once_uidx/);
  assert.match(migration, /create or replace function public\.claim_forum_reaction_reward/);
  assert.match(migration, /for update;/);
  assert.match(migration, /on conflict do nothing/);
  assert.match(action, /\.rpc\('claim_forum_reaction_reward'/);
  assert.doesNotMatch(action, /awardForumReward\(svc, user, \{ kind: 'reaction_given'/);
});

test("slot collection tells users it is device-only and does not pretend to sync", () => {
  const slot = read("../src/components/forum/SlotMachineBadgeUnlock.jsx");
  const achievements = read("../src/components/account/AchievementsTab.jsx");
  assert.match(slot, /saved only on this device/);
  assert.doesNotMatch(slot, /updateProfile\(\{ badges:/);
  assert.match(achievements, /slot collection is stored only on the device/);
  assert.doesNotMatch(achievements, /slot badges — and they follow you across devices/);
});
