import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("visitor-counter migration is safe: RLS on, read-only policy, guarded writes", () => {
  const sql = read("../supabase/migrations/0010_site_visit_counter.sql");
  assert.ok(/create table if not exists public\.site_visit_stats/.test(sql), "counter table");
  assert.ok(/id = 1/.test(sql), "single-row (singleton) counter");
  assert.ok(/enable row level security/.test(sql), "RLS enabled");
  assert.ok(/for select\s+using \(true\)/.test(sql), "count is world-readable");
  // No write policies — the only mutation path is the SECURITY DEFINER function.
  assert.ok(!/for (insert|update|delete)/i.test(sql), "no direct write policies");
  assert.ok(/security definer/.test(sql), "increment runs as definer to bypass RLS for the update");
  assert.ok(/set search_path = public/.test(sql), "search_path pinned (advisor hardening)");
  assert.ok(/grant execute on function public\.increment_site_visits\(\) to anon/.test(sql), "anon may increment");
});

test("visitor hook dedups per device per day and fails closed", () => {
  const src = read("../src/hooks/use-visitor-count.js");
  assert.ok(src.includes('supabase.rpc("increment_site_visits")'), "increments via the RPC");
  assert.ok(src.includes("localStorage") && src.includes("todayKey"), "dedups per calendar day");
  assert.ok(src.includes("useState(null)"), "starts null so the UI can hide until known");
  // Every backend path is wrapped so an error never throws into render.
  assert.ok(/catch\s*\{/.test(src), "backend failures are swallowed (count stays null)");
});

test("visitor counter renders nothing until it has a real number", () => {
  const src = read("../src/components/public/VisitorCounter.jsx");
  assert.ok(/count === null \|\| !Number\.isFinite\(count\)/.test(src), "hides when count is unknown");
  assert.ok(src.includes("toLocaleString()"), "thousands-formatted");
});

test("the counter is mounted in both footers (site-wide)", () => {
  const home = read("../src/pages/Home.jsx");
  const layout = read("../src/components/public/PublicLayout.jsx");
  assert.ok(home.includes("<VisitorCounter"), "home footer shows the counter");
  assert.ok(layout.includes("<VisitorCounter"), "non-home footer shows the counter");
});
