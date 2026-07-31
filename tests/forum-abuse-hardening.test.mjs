import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const ACTION = read("../supabase/functions/forumAction/index.ts");
const MIGRATION = read("../supabase/migrations/0027_forum_abuse_hardening.sql");

// Assertions about what the code DOES must not be satisfied (or broken) by prose
// in a comment — these files comment heavily on the very fields under test.
const stripComments = (src) =>
  src
    .split("\n")
    .filter((line) => !/^\s*(\/\/|--|\*|\/\*)/.test(line))
    .join("\n");
const ACTION_CODE = stripComments(ACTION);

// RLT-FORUM-001. forum_posts is RLS-locked to admins, so every write goes through
// this service-role function — which makes the function's own checks the entire
// boundary. Three of its actions did not hold up.

test("a reporter can never write into the moderator's own note", () => {
  // moderation_reason is rendered to moderators as "Mod reason: …". Letting a
  // reporter write it meant putting words in a moderator's mouth, and it
  // overwrote any note a moderator had already made.
  const reportBlock = ACTION_CODE.split("action === 'report'")[1]?.split("action === 'view'")[0] || "";
  assert.ok(reportBlock, "the report handler exists");
  assert.ok(
    !/moderation_reason\s*:/.test(reportBlock),
    "the report handler must not write moderation_reason"
  );
  assert.ok(
    /report_reasons\s*:/.test(reportBlock),
    "reporter text goes to its own untrusted column"
  );
});

test("reporting requires an account and respects bans", () => {
  const reportBlock = ACTION_CODE.split("action === 'report'")[1]?.split("action === 'view'")[0] || "";
  assert.ok(/Login required to report/.test(reportBlock), "anonymous reporting is rejected");
  assert.ok(/findActiveBan/.test(reportBlock), "a banned user cannot drive the moderation queue");
  assert.ok(/already_reported|includes\(reporter\)/.test(reportBlock), "re-reporting is idempotent");
});

test("findActiveBan is imported — the report path would crash without it", () => {
  const importBlock = ACTION.split("} from './shared.ts'")[0] || "";
  assert.ok(/findActiveBan/.test(importBlock), "findActiveBan is imported, not just called");
});

test("views and likes go through atomic RPCs, not read-modify-write", () => {
  const viewBlock = ACTION_CODE.split("action === 'view'")[1]?.split("action === 'like'")[0] || "";
  assert.ok(/forum_register_view/.test(viewBlock), "view uses the dedup+atomic RPC");
  assert.ok(
    !/view_count:\s*next|num\(post\.view_count\)\s*\+\s*1/.test(viewBlock),
    "view no longer does a read-modify-write increment"
  );

  const likeBlock = ACTION_CODE.split("action === 'like'")[1]?.split("action === 'react'")[0] || "";
  assert.ok(/forum_toggle_like/.test(likeBlock), "like uses the atomic toggle RPC");
  assert.ok(
    !/likedBy\.splice|likedBy\.push/.test(likeBlock),
    "like no longer mutates the array in the function"
  );
});

test("the view RPC is idempotent per viewer and the like RPC derives its count", () => {
  assert.ok(/on conflict do nothing/i.test(MIGRATION), "repeat views are absorbed by a unique key");
  assert.ok(/if found then/i.test(MIGRATION), "only a genuinely new view increments the counter");
  assert.ok(/for update/i.test(MIGRATION), "the like toggle takes a row lock");
  assert.ok(
    /like_count\s*=\s*jsonb_array_length\(v_liked_by\)/.test(MIGRATION),
    "like_count is derived from liked_by, so they cannot drift apart"
  );
});

test("the RPCs are not callable with a client key", () => {
  for (const fn of ["forum_register_view", "forum_toggle_like", "forum_prune_view_marks"]) {
    assert.ok(
      new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated`).test(MIGRATION),
      `${fn} is revoked from client roles`
    );
  }
  assert.ok(
    /alter table public\.forum_view_marks enable row level security/.test(MIGRATION),
    "the dedup table is RLS-enabled (no policies = deny all)"
  );
});

test("the rebuilt view keeps 0019's masking and the fixed author predicate", () => {
  const view = MIGRATION.split("create or replace view public.forum_posts_view")[1] || "";
  // Every admin/authenticated mask from 0019 must survive — rebuilding this view
  // from an older definition is how member emails would get published.
  for (const masked of ["user_email", "ip_address", "reported_by", "report_reasons"]) {
    assert.ok(
      new RegExp(`case when \\(select public\\.is_admin\\(\\)\\) then ${masked}`).test(view),
      `${masked} stays admin-only`
    );
  }
  assert.ok(/then user_id else null end/.test(view), "user_id stays hidden from anonymous readers");
  // The empty-identity fix must not be reverted by rebuilding the view.
  assert.ok(/nullif\(\(select public\.current_profile_id\(\)\), ''\)/.test(view), "author arm uses nullif");
  assert.ok(
    !/coalesce\(\(select public\.current_profile_id\(\)\), ''\)/.test(view),
    "the blank-identity comparison is not reintroduced"
  );
});

test("moderators can still see why something was reported", () => {
  const manager = read("../src/components/admin/ForumManager.jsx");
  assert.ok(/report_reasons/.test(manager), "the moderation UI surfaces reporter text");
  assert.ok(
    /Reported by users/.test(manager),
    "reporter text is labelled as coming from users, not as a moderator note"
  );
});

test("deleting a post never destroys other members' replies or the evidence", () => {
  // The old path hard-DELETEd the whole reply subtree: a reported member could
  // erase reported_by/report_reasons/ip_address with one tap, and a thread
  // starter could wipe out everyone else's replies with no way back.
  const deleteBlock = ACTION_CODE.split("action === 'delete'")[1]?.split("action === 'update'")[0] || "";
  assert.ok(/deleted_at:/.test(deleteBlock), "delete is a soft delete");
  assert.ok(/is_published: false/.test(deleteBlock), "the post leaves the feed");
  assert.ok(!/\.delete\(\)/.test(deleteBlock), "no hard delete remains in the handler");
  assert.ok(
    !/deleteWithChildren/.test(ACTION_CODE),
    "the recursive hard-delete helper is gone, not just unused"
  );
});

test("a banned member cannot keep editing their live posts", () => {
  const updateBlock = ACTION_CODE.split("action === 'update'")[1]?.split("action === 'pin'")[0] || "";
  assert.ok(/findActiveBan/.test(updateBlock), "the edit path checks for a ban");
  // Must not match on IP: shared mobile CGNAT would block innocent users.
  assert.ok(!/ip:\s*resolveClientIp/.test(updateBlock), "the edit ban check is identity-based, not IP-based");
});

test("forum media must be on a host we control", () => {
  const shared = read("../supabase/functions/_shared/shared.ts");
  assert.ok(/export function safeForumMediaUrl/.test(shared), "a media URL validator exists");
  assert.ok(/protocol !== 'https:'/.test(shared), "only https is accepted");
  assert.ok(/SUPABASE_URL/.test(shared), "the project's own storage host is allowed");
  // Both write paths must use it, or the beacon just moves to the other one.
  for (const fn of ["forumAction", "submitForumPost"]) {
    const src = read(`../supabase/functions/${fn}/index.ts`);
    assert.ok(/safeForumMediaUrl\(input\?\.media_url\)/.test(src), `${fn} validates media_url`);
    assert.ok(
      !/trimToLength\(input\?\.media_url/.test(src),
      `${fn} no longer stores an unvalidated media_url`
    );
  }
});

test("moderator tooling writes null, not '', into timestamp columns", () => {
  // PostgREST casts through the row type, so "" into timestamptz raises 22007
  // and the write never lands — restore was a permanent no-op and the default
  // "Permanent" ban never inserted.
  for (const file of ["ForumManager", "UsersManager"]) {
    const src = read(`../src/components/admin/${file}.jsx`);
    assert.ok(
      !/(deleted_at|expires_at)\s*:\s*[^,\n]*""\s*,/.test(src),
      `${file} never writes an empty string into a timestamp column`
    );
  }
  const forum = read("../src/components/admin/ForumManager.jsx");
  assert.ok(/deleted_at: null/.test(forum), "restore clears deleted_at with null");
});

test("the thread-detail report button actually reports", () => {
  const modal = read("../src/components/forum/feed/ThreadDetailModal.jsx");
  const reportArea = modal.split('"Report this post"')[1]?.slice(0, 1800) || "";
  assert.ok(
    /forumAction[\s\S]{0,120}action: "report"/.test(reportArea),
    "the report reasons call forumAction rather than only showing a toast"
  );
});

test("the forum feed window fits real threads with replies", () => {
  const forum = read("../src/pages/Forum.jsx");
  assert.ok(
    /ForumPost\.list\("-created_date", 500\)/.test(forum),
    "the feed fetches enough rows that threads are not evicted by their own replies"
  );
});

test("the posting quota is claimed atomically, not counted then acted on", () => {
  const submit = stripComments(read("../supabase/functions/submitForumPost/index.ts"));
  const quota = read("../supabase/migrations/0029_forum_post_quota.sql");

  // The old shape: COUNT queries, then an insert several awaits later. A
  // simultaneous burst all read "under the limit" and all got through.
  assert.ok(/forum_claim_post_slot/.test(submit), "a slot is claimed via the RPC");
  assert.ok(
    !/count: 'exact', head: true/.test(submit),
    "the check-then-act COUNT queries are gone"
  );
  // Limits preserved exactly: 5 per 10 minutes, 20 per day.
  assert.ok(/p_window_limit: 5/.test(submit) && /p_day_limit: 20/.test(submit), "limits unchanged");
  assert.ok(/p_window_seconds: 600/.test(submit), "window unchanged");
  // Both 429 codes still returned so existing clients keep working.
  assert.ok(/code: 'daily_rate_limited'/.test(submit) && /code: 'rate_limited'/.test(submit), "error codes preserved");

  // The claim must be a single statement that both tests and consumes.
  assert.ok(
    /where user_id = p_user_id\s*\n\s*and window_count < p_window_limit\s*\n\s*and day_count\s*< p_day_limit/.test(quota),
    "the limits live in the UPDATE's WHERE, so check and decrement cannot interleave"
  );
  assert.ok(/on conflict \(user_id\) do update/.test(quota), "the upsert takes a row lock for the burst to queue on");
});

test("a failed insert hands the posting slot back", () => {
  const submit = stripComments(read("../supabase/functions/submitForumPost/index.ts"));
  assert.ok(/forum_release_post_slot/.test(submit), "the slot is released when the insert fails");
  const quota = read("../supabase/migrations/0029_forum_post_quota.sql");
  assert.ok(/greatest\(window_count - 1, 0\)/.test(quota), "release cannot drive a counter negative");
});

test("the quota cannot be reset by deleting posts, or driven by a client key", () => {
  const quota = read("../supabase/migrations/0029_forum_post_quota.sql");
  // Derived-from-forum_posts counting would let a spammer delete their way to a
  // fresh allowance; a dedicated table cannot be reset that way.
  assert.ok(/create table if not exists public\.forum_post_quota/.test(quota), "the quota has its own table");
  assert.ok(
    /alter table public\.forum_post_quota enable row level security/.test(quota),
    "the quota table is RLS-denied to clients"
  );
  for (const fn of ["forum_claim_post_slot", "forum_release_post_slot"]) {
    assert.ok(
      new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated`).test(quota),
      `${fn} is revoked from client roles`
    );
  }
});
