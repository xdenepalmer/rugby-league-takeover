import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
const migration = () => read("../supabase/migrations/0031_launch_hardening.sql");

// Every finding below was verified against the LIVE database before the fix
// and re-probed after it — not inferred from the migration history, which for
// several of these did not match production.

test("owner-keyed policies never match a blank identity", () => {
  // current_profile_id() is NULL for a signed-out caller, so coalesce(...,'')
  // matches every blank-owner row. Verified live: an anonymous POST to
  // /rest/v1/user_push_tokens with user_id:"" returned HTTP 201 before this,
  // and 401 (RLS violation) after.
  const sql = migration();
  const pushBlock = sql.slice(sql.indexOf("push_tokens_select_own"), sql.indexOf("2. profiles.id"));
  assert.doesNotMatch(pushBlock, /coalesce\(\(select public\.current_profile_id\(\)\), ''\)/,
    "coalesce lets a signed-out caller match blank-owner rows");
  const matches = pushBlock.match(/nullif\(\(select public\.current_profile_id\(\)\), ''\)/g) || [];
  assert.ok(matches.length >= 4, "all four push-token policies must use nullif");
  assert.ok(pushBlock.includes("user_id <> ''"), "and exclude blank-owner rows outright");
});

test("profiles.id — the ownership key for the whole schema — is not client-writable", () => {
  // profiles_update_self's WITH CHECK constrains only auth_user_id, so the
  // trigger is the only thing holding this. It reverted 26 columns and not id.
  const sql = migration();
  const fn = sql.slice(sql.indexOf("function public.protect_profile_columns"));
  assert.match(fn, /new\.id := old\.id;/, "id must be reverted for non-admin writers");
  // The columns it already protected must not have been dropped in the edit.
  for (const col of ["role", "membership_expires_at", "casino_chips", "badges", "auth_user_id"]) {
    assert.match(fn, new RegExp(`new\\.${col} := old\\.${col};`), `${col} must stay protected`);
  }
});

test("one tip per person per game is held by the database, not by a read-then-insert", () => {
  // settleTips pays per ROW, so two rows for one person on one game means
  // backing both teams and being guaranteed a payout.
  const sql = migration();
  assert.match(sql, /create unique index if not exists tipping_entries_user_game_uidx/);
  assert.match(sql, /create unique index if not exists tipping_entries_ip_game_uidx/);
  // Identity differs by caller type — accounts by user_id, guests by IP.
  assert.match(sql, /where coalesce\(user_id, ''\) <> ''/);
  assert.match(sql, /where coalesce\(user_id, ''\) = '' and coalesce\(ip_address, ''\) <> ''/);

  // Losing the race must converge, not 500.
  const submit = read("../supabase/functions/submitTip/index.ts");
  assert.match(submit, /error\?\.code === '23505'/, "a unique violation must be handled");
  assert.match(submit, /updated: true/, "the loser of the race applies its tip as an edit");
});

test("the repo can rebuild production's RLS, not the version it drifted from", () => {
  // The live policies carried the hardened form but NO repo migration did —
  // 0005_performance_policies.sql still has the vulnerable coalesce. Rebuilding
  // from migrations would have restored the insecure version.
  const sql = migration();
  for (const policy of ["registrations_read", "orders_read", "reward_events_read", "achievements_read", "notifications_read"]) {
    assert.ok(sql.includes(`create policy "${policy}"`), `${policy} must be codified`);
  }
  const codified = sql.slice(sql.indexOf('drop policy if exists "registrations_read"'));
  assert.doesNotMatch(codified, /coalesce\(\(select public\.current_profile_(email|id)\(\)\), ''\)/,
    "no codified policy may reintroduce the blank-identity match");
});
