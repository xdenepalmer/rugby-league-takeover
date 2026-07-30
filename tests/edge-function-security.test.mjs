import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const fn = (name) => read(`../supabase/functions/${name}/index.ts`);
const FUNCTIONS_DIR = new URL("../supabase/functions/", import.meta.url);
const functionNames = fs
  .readdirSync(FUNCTIONS_DIR)
  .filter((entry) => entry !== "_shared" && fs.statSync(new URL(entry, FUNCTIONS_DIR)).isDirectory());

/* notifyProductRelease emails every subscriber of a product and burns their
 * one-shot notified_at flag, so an anonymous caller must not be able to fire it
 * (RLT-AUDIT: it previously ran with the service role for anyone who knew the
 * URL). */
test("notifyProductRelease is admin-only (or automation with a shared secret)", () => {
  const src = fn("notifyProductRelease");
  assert.match(src, /getCaller\(req, svc\)/, "must resolve the caller");
  assert.match(src, /role !== 'admin'/, "must reject non-admin callers");
  assert.match(src, /RELEASE_NOTIFY_SECRET/, "automation path must present a shared secret");
  assert.match(src, /timingSafeEqual/, "the shared secret must be compared in constant time");
});

/* Postgres errors carry table/column/constraint text and sometimes row values.
 * Anonymous-reachable functions must log the cause and answer generically. */
test("client-reachable functions do not echo raw error messages", () => {
  const adminOnly = new Set(["adminUsers", "inviteUser", "cancelOrder", "stripeRefund", "auspostTrack", "auspostCreateLabel"]);
  for (const name of functionNames) {
    if (adminOnly.has(name)) continue;
    const src = fn(name);
    assert.doesNotMatch(
      src,
      /json\(\{ error: \(error as Error\)\.message/,
      `${name} must return a generic 500 (use serverError) instead of the raw error`,
    );
  }
});

test("every function directory carries a synced copy of shared.ts", () => {
  const shared = read("../supabase/functions/_shared/shared.ts");
  for (const name of functionNames) {
    assert.equal(
      read(`../supabase/functions/${name}/shared.ts`),
      shared,
      `${name}/shared.ts is stale — run node scripts/sync-shared.mjs`,
    );
  }
});

/* forum_posts_view is granted to anon, so an unmasked user_email column exposed
 * the email address of every member who has ever posted. */
test("forum_posts_view masks author emails for everyone but admins and the owner", () => {
  const migration = read("../supabase/migrations/0018_forum_author_email_privacy.sql");
  assert.match(migration, /create or replace view public\.forum_posts_view/);
  assert.match(
    migration,
    /when public\.is_admin\(\)[\s\S]*current_profile_email\(\)[\s\S]*then user_email[\s\S]*else null[\s\S]*end as user_email/,
    "user_email must be masked like ip_address already is",
  );
});
