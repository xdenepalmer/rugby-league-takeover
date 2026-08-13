import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getVisitorKey, isUncountedPath, isVisitorKey } from "../src/lib/visitor-key.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/0035_visit_stats_split.sql");
const hook = read("src/hooks/use-visitor-count.js");
const counter = read("src/components/public/VisitorCounter.jsx");
const app = read("src/App.jsx");

// ── visitor key ──────────────────────────────────────────────────────────
test("a minted visitor key is a v4 UUID and is reused across calls", () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  try {
    const first = getVisitorKey();
    assert.ok(isVisitorKey(first), `expected a UUID, got ${first}`);
    assert.equal(getVisitorKey(), first, "the same device must not mint a second key");
    assert.equal(store.size, 1);
  } finally {
    delete globalThis.localStorage;
  }
});

test("a corrupted stored key is replaced rather than sent to the server", () => {
  const store = new Map([["rlt_visitor_key", "garbage"]]);
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  try {
    const key = getVisitorKey();
    assert.ok(isVisitorKey(key), "must replace a value the server would reject");
  } finally {
    delete globalThis.localStorage;
  }
});

test("blocked storage yields no key, rather than a throwaway one per page load", () => {
  // Minting per page load would count every private-mode view as a new unique
  // visitor and inflate the figure without bound.
  globalThis.localStorage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
  };
  try {
    assert.equal(getVisitorKey(), null);
  } finally {
    delete globalThis.localStorage;
  }
});

test("admin traffic is not counted", () => {
  assert.equal(isUncountedPath("/admin"), true);
  assert.equal(isUncountedPath("/admin/orders"), true);
  assert.equal(isUncountedPath("/"), false);
  assert.equal(isUncountedPath("/store"), false);
  // Not a prefix match on the string: a public route may legitimately start
  // with the same letters.
  assert.equal(isUncountedPath("/administrators"), false);
});

// ── the two metrics are genuinely different ──────────────────────────────
test("views and uniques are separate columns, counted differently", () => {
  assert.match(migration, /add column if not exists total_views/, "total_views column");
  assert.match(migration, /add column if not exists unique_visitors/, "unique_visitors column");
  // Every call bumps views; only a genuine INSERT bumps uniques.
  assert.match(migration, /total_views = total_views \+ 1/, "every view counts");
  assert.match(
    migration,
    /unique_visitors = unique_visitors \+ \(case when is_new_visitor then 1 else 0 end\)/,
    "uniques must only move for a first-ever visit",
  );
  assert.match(migration, /xmax = 0/, "must detect a real insert to tell new from returning");
});

test("the legacy 882 is carried into total views instead of resetting to zero", () => {
  assert.match(migration, /set total_views = greatest\(total_views, total_visits\)/);
});

test("unique dedup is server-side, not a promise the browser makes to itself", () => {
  assert.match(migration, /create table if not exists public\.site_visitor_keys/);
  assert.match(migration, /on conflict \(visitor_key\) do update/, "dedup happens in Postgres");
  assert.doesNotMatch(hook, /rlt_visit_counted_on/, "the old localStorage day-dedup must be gone");
});

// ── privacy and access ───────────────────────────────────────────────────
test("the counts are admin-only, matching the decision to take them off the footer", () => {
  assert.match(migration, /drop policy if exists "site_visit_stats_public_read"/, "public read must be dropped");
  assert.match(migration, /for select\s+using \(public\.is_admin\(\)\)/, "admin-only select policy");
});

test("the recording RPC hands nothing back to anonymous callers", () => {
  // Otherwise the private metric leaks through the one call anyone can make.
  assert.match(
    migration,
    /create or replace function public\.record_site_visit\(p_visitor_key text\)\s*\nreturns void/,
    "record_site_visit must return void",
  );
});

test("the visitor keys table is readable by nobody through the API", () => {
  assert.match(migration, /alter table public\.site_visitor_keys enable row level security/);
  assert.match(migration, /revoke all on table public\.site_visitor_keys from anon, authenticated/);
  assert.doesNotMatch(
    migration,
    /create policy[^;]*on public\.site_visitor_keys/,
    "the keys table must have no policies at all",
  );
});

test("junk keys are rejected server-side so uniques can't be inflated", () => {
  assert.match(migration, /\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}/, "must validate the UUID shape in SQL");
});

// ── wiring ───────────────────────────────────────────────────────────────
test("views are recorded on every navigation, not once per session", () => {
  assert.match(app, /<VisitTracker \/>/, "the tracker must be mounted");
  assert.match(hook, /useLocation/, "recording must follow route changes");
  assert.match(hook, /\[pathname\]/, "the effect must re-run per path");
});

test("the admin panel shows both metrics, labelled distinctly", () => {
  assert.match(counter, /Total views/);
  assert.match(counter, /Unique visitors/);
  assert.match(counter, /total_views|totalViews/);
  assert.match(counter, /unique_visitors|uniqueVisitors/);
});

test("the counters render nothing rather than a zero they can't stand behind", () => {
  assert.match(counter, /if \(!stats.*\) \{\s*\n\s*return null;/s);
});
