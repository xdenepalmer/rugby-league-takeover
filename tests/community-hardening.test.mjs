import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeUserHref } from "../src/lib/safe-url.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("user-authored links allow only safe destinations", () => {
  assert.equal(safeUserHref("https://example.com/path"), "https://example.com/path");
  assert.equal(safeUserHref("http://example.com"), "http://example.com/");
  assert.equal(safeUserHref("mailto:support@example.com"), "mailto:support@example.com");
  assert.equal(safeUserHref("/forum?tab=latest"), "/forum?tab=latest");
  assert.equal(safeUserHref("#replies"), "#replies");

  for (const unsafe of [
    "javascript:alert(1)",
    "data:text/html,boom",
    "vbscript:msgbox(1)",
    "//evil.example/path",
    String.raw`https:\evil.example`,
    "#bad anchor",
  ]) {
    assert.equal(safeUserHref(unsafe), "", `${unsafe} must not become an href`);
  }
});

test("markdown routes links through the URL allow-list", () => {
  const markdown = read("src/lib/markdown.jsx");
  assert.match(markdown, /safeUserHref\(m\[2\]\)/);
  assert.match(markdown, /if \(!href\) return <span/);
  assert.match(markdown, /rel=\{external \? "noopener noreferrer"/);
});

test("forum creation and replies require an authenticated profile", () => {
  const submit = read("supabase/functions/submitForumPost/index.ts");
  const forum = read("src/pages/Forum.jsx");
  const compose = read("src/components/forum/feed/ComposeSidebar.jsx");
  const thread = read("src/components/forum/feed/ThreadDetailModal.jsx");
  const replies = read("src/components/forum/ReplyTree.jsx");

  assert.match(submit, /if \(!user\?\.id\)[\s\S]*Login required to post in the forum/);
  assert.match(submit, /authorName = trimToLength\(user\.full_name \|\| user\.email/);
  assert.doesNotMatch(submit, /user\?\.full_name \|\| input\?\.author_name/);
  assert.match(forum, /if \(!isAuthenticated \|\| !user\?\.id\) throw new Error/);
  assert.match(compose, /Sign in to post/);
  assert.match(thread, /Sign in to reply/);
  assert.match(replies, /\{open && isAuthenticated && \(/);
  assert.doesNotMatch(replies, /placeholder="Your name"/);
});

test("forum submissions have a server-side per-profile rate limit", () => {
  const submit = read("supabase/functions/submitForumPost/index.ts");
  // The limit is now claimed ATOMICALLY (RLT-FORUM-002). It used to be three
  // COUNT queries followed several awaits later by the insert — a check-then-act
  // race that a simultaneous burst walked straight through. Same limits (5 per
  // 10 minutes, 20 per day) and same 429 codes; the enforcement is what changed.
  assert.match(submit, /forum_claim_post_slot/);
  assert.match(submit, /p_window_limit: 5/);
  assert.match(submit, /p_window_seconds: 600/);
  assert.match(submit, /p_day_limit: 20/);
  assert.match(submit, /code: 'rate_limited'/);
  assert.match(submit, /code: 'daily_rate_limited'/);
  assert.match(submit, /}, 429\)/);
  // The quota must not be derived from posts, or deleting them resets the gate.
  const quota = read("supabase/migrations/0029_forum_post_quota.sql");
  assert.match(quota, /create table if not exists public\.forum_post_quota/);
});

test("forum replies must target a live published discussion", () => {
  const submit = read("supabase/functions/submitForumPost/index.ts");
  assert.match(submit, /if \(parentId\)[\s\S]*getForumPost\(svc, parentId\)/);
  assert.match(submit, /!parent \|\| parent\.deleted_at \|\| parent\.is_published !== true/);
  assert.match(submit, /no longer available/);
});

test("moderators can remove posts through the checked backend path", () => {
  const action = read("supabase/functions/forumAction/index.ts");
  assert.match(action, /user\.role === 'admin' \|\| user\.role === 'moderator'/);
  assert.match(action, /if \(!isOwner && !isModerator\)/);
  // Removal is now a SOFT delete (RLT-FORUM-001). The previous recursive hard
  // delete let a reported member erase the evidence against them and let any
  // thread starter destroy every other member's replies, with no restore path
  // anywhere in the product. Authorisation is unchanged; only the destructiveness is.
  assert.match(action, /deleted_at: new Date\(\)\.toISOString\(\)/);
  assert.match(action, /is_published: false/);
  assert.doesNotMatch(action, /deleteWithChildren/);
});

test("community migration hides anonymous identity and reaction details", () => {
  const sql = read("supabase/migrations/0019_community_hardening.sql");
  assert.match(sql, /case when \(select public\.is_admin\(\)\) then user_email else null end/);
  assert.match(sql, /case when \(select auth\.role\(\)\) = 'authenticated' then user_id else null end/);
  assert.match(sql, /then liked_by else '\[\]'::jsonb/);
  assert.match(sql, /then reactions else '\{\}'::jsonb/);
  assert.match(sql, /grant select on public\.forum_posts_view to anon, authenticated/);
});

test("achievement and reaction rewards are atomic and one-time", () => {
  const sql = read("supabase/migrations/0019_community_hardening.sql");
  const achievements = read("supabase/functions/evaluateAchievements/index.ts");
  const action = read("supabase/functions/forumAction/index.ts");

  assert.match(sql, /create unique index if not exists achievement_unlocks_user_achievement_uidx/);
  assert.match(sql, /on conflict \(user_id, achievement_id\) do nothing/);
  assert.match(sql, /create unique index if not exists forum_reward_events_reaction_once_uidx/);
  assert.match(sql, /where id = p_user_id\s+for update/);
  assert.match(sql, /service role required/);
  assert.match(sql, /revoke all on function public\.claim_achievement_unlocks[\s\S]*anon, authenticated/);
  assert.match(sql, /revoke all on function public\.claim_forum_reaction_reward[\s\S]*anon, authenticated/);
  assert.match(achievements, /\.rpc\('claim_achievement_unlocks'/);
  assert.doesNotMatch(achievements, /\.from\('achievement_unlocks'\)\.insert/);
  assert.match(action, /\.rpc\('claim_forum_reaction_reward'/);
});

test("own-profile writes cannot bypass server-authoritative slot state", () => {
  const sql = read("supabase/migrations/0019_community_hardening.sql");
  for (const field of [
    "casino_xp",
    "casino_chips",
    "casino_last_active_date",
    "badges",
    "slot_last_spin_date",
    "slot_total_spins",
    "slot_streak",
    "slot_extra_date",
    "slot_extra_count",
    "daily_bonus_date",
  ]) {
    assert.match(sql, new RegExp(`new\\.${field} := old\\.${field}`), `${field} must stay server-owned`);
  }
  assert.match(sql, /revoke execute on function public\.protect_profile_columns\(\) from anon, authenticated, public/);
});

test("community migration can be safely re-applied", () => {
  const sql = read("supabase/migrations/0019_community_hardening.sql");
  assert.match(sql, /create or replace view public\.forum_posts_view/);
  assert.match(sql, /create or replace function public\.protect_profile_columns/);
  assert.match(sql, /create unique index if not exists achievement_unlocks_user_achievement_uidx/);
  assert.match(sql, /create unique index if not exists forum_reward_events_reaction_once_uidx/);
  assert.match(sql, /create or replace function public\.claim_achievement_unlocks/);
  assert.match(sql, /create or replace function public\.claim_forum_reaction_reward/);
});
