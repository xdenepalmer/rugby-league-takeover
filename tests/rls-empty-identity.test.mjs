import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// RLT-SEC-001. Owner-scoped RLS compared the row's owner against
// `coalesce(current_profile_email(), '')`. For an anonymous caller that helper
// returns NULL, so the comparison collapsed to `owner = ''` — TRUE for every row
// whose owner column was blank. Edge functions wrote exactly that (`|| ''`), so
// guest checkouts produced world-readable orders (customer name, address, phone).
// Confirmed exploitable against the live project with the publishable anon key.
//
// Two halves must both hold: policies must not equate a blank identity with a
// match, and writers must never store a blank owner in the first place.

const MIGRATION = "../supabase/migrations/0012_rls_empty_identity_fix.sql";

test("migration 0012 exists and rewrites every owner-scoped policy", () => {
  const sql = read(MIGRATION);
  for (const policy of [
    "orders_read",
    "registrations_read",
    "notifications_read",
    "notifications_update",
    "notifications_delete",
    "reward_events_read",
    "achievements_read",
  ]) {
    assert.ok(sql.includes(`"${policy}"`), `0012 redefines ${policy}`);
  }
  assert.ok(
    /create or replace view public\.forum_posts_view/.test(sql),
    "0012 also rebuilds forum_posts_view (its author arm leaked unpublished posts)"
  );
});

test("0012 never equates a blank identity with a match", () => {
  const sql = read(MIGRATION);
  // The bug idiom, in either helper's form. nullif() is the fix: `x = NULL` is
  // NULL, never TRUE, so an absent identity matches nothing.
  assert.ok(
    !/coalesce\(\s*\(?\s*select\s+public\.current_profile_(email|id)\(\)\s*\)?\s*,\s*''\s*\)/i.test(sql),
    "0012 must not reintroduce coalesce(identity, '')"
  );
  assert.ok(sql.includes("nullif"), "0012 uses nullif() to neutralise a blank identity");
  // Every owner comparison also asserts the row's own owner column is non-blank,
  // so an unowned row can never match any caller.
  const guards = sql.match(/<> ''/g) || [];
  assert.ok(guards.length >= 7, `each owner arm guards against a blank column (found ${guards.length})`);
});

test("0012 is idempotent — safe to re-run against a live database", () => {
  const sql = read(MIGRATION);
  const creates = (sql.match(/^create policy/gim) || []).length;
  const drops = (sql.match(/^drop policy if exists/gim) || []).length;
  assert.equal(creates, drops, "every created policy is dropped-if-exists first");
});

test("no edge function writes a blank owner column", () => {
  const dir = new URL("../supabase/functions/", import.meta.url);
  const offenders = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith("_")) continue;
    let src;
    try {
      src = readFileSync(new URL(`${name}/index.ts`, dir), "utf8");
    } catch {
      continue;
    }
    for (const line of src.split("\n")) {
      // e.g. `user_email: user?.email || ''` — a blank owner, not "no owner".
      if (/\b(user_email|user_id|recipient_email|recipient_id)\s*:\s*.*\|\|\s*''/.test(line)) {
        offenders.push(`${name}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, [], "owner columns must be written as null, never ''");
});

test("guest checkout orders are unowned, so only an admin can read them", () => {
  const src = read("../supabase/functions/createCheckout/index.ts");
  assert.ok(
    /user_email: user\?\.email \|\| null/.test(src),
    "createCheckout stores a guest's user_email as null"
  );
  assert.ok(
    /user_id: user\?\.id \|\| null/.test(src),
    "createCheckout stores a guest's user_id as null"
  );
});
