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
