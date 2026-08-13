import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("visitor-counter migration is safe: RLS on, read-only policy, guarded writes", () => {
  const sql = read("../supabase/migrations/0010_site_visit_counter.sql");
  assert.ok(/create table if not exists public\.site_visit_stats/.test(sql), "counter table");
  assert.ok(/id = 1/.test(sql), "single-row (singleton) counter");
  assert.ok(/enable row level security/.test(sql), "RLS enabled");
  // 0010 shipped the count as world-readable; 0035 narrows that to admins when
  // the metric moved off the public footer. Both assertions are checked against
  // their own migration — see visit-stats.test.mjs for the current policy.
  assert.ok(/for select\s+using \(true\)/.test(sql), "0010's original policy");
  // No write policies — the only mutation path is the SECURITY DEFINER function.
  assert.ok(!/for (insert|update|delete)/i.test(sql), "no direct write policies");
  assert.ok(/security definer/.test(sql), "increment runs as definer to bypass RLS for the update");
  assert.ok(/set search_path = public/.test(sql), "search_path pinned (advisor hardening)");
  assert.ok(/grant execute on function public\.increment_site_visits\(\) to anon/.test(sql), "anon may increment");
});

test("visitor hook records views and fails closed", () => {
  // The per-day localStorage dedup this used to assert was deliberately dropped
  // in 0035: it produced a number that was neither views nor uniques, and the
  // browser is not a trustworthy place to decide who is new. Dedup is now
  // server-side — see visit-stats.test.mjs.
  const src = read("../src/hooks/use-visitor-count.js");
  assert.ok(src.includes('supabase.rpc("record_site_visit"'), "records via the RPC");
  assert.ok(src.includes("useState(null)"), "starts null so the UI can hide until known");
  // Every backend path is wrapped so an error never throws into render.
  assert.ok(/catch\s*\{|\) => \{\s*\n\s*\/\* leave null/.test(src), "backend failures are swallowed");
});

test("visitor counters render nothing until they have real numbers", () => {
  const src = read("../src/components/public/VisitorCounter.jsx");
  assert.ok(/if \(!stats/.test(src), "hides when the stats are unknown");
  assert.ok(/!Number\.isFinite\(stats\.totalViews\)/.test(src), "hides on a non-numeric view count");
  assert.ok(/!Number\.isFinite\(stats\.uniqueVisitors\)/.test(src), "hides on a non-numeric unique count");
  assert.ok(src.includes("toLocaleString()"), "thousands-formatted");
});

test("the counter lives in the admin overview, NOT the public footers", () => {
  // Owner call: the visitor tally is for the team, not the crowd. It moved off
  // both public footers into the Command Centre overview.
  const home = read("../src/pages/Home.jsx");
  const layout = read("../src/components/public/PublicLayout.jsx");
  const overview = read("../src/components/admin/panels/OverviewPanel.jsx");
  assert.ok(!home.includes("<VisitorCounter"), "home footer must not show the counter");
  assert.ok(!layout.includes("<VisitorCounter"), "non-home footer must not show the counter");
  assert.ok(overview.includes("<VisitorCounter"), "admin overview shows the counter");
});
