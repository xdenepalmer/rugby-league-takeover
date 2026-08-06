import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  teamMatches,
  wantsTeam,
  sizeOk,
  isMutualMatch,
  findMatches,
} from "../src/lib/swap-match.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const listing = (over = {}) => ({
  id: over.id || Math.random().toString(36).slice(2),
  status: "active",
  is_me: false,
  swapper_key: over.swapper_key || `key-${over.id || Math.random()}`,
  have_team: "Canterbury Bulldogs",
  have_size: "L",
  want_teams: [],
  want_sizes: [],
  created_date: "2026-08-01T00:00:00Z",
  ...over,
});

// ── Team matching is fuzzy in both directions ───────────────────────────
test("fans typing 'Rhinos', 'Leeds' or 'Leeds Rhinos' all mean the same club", () => {
  assert.ok(teamMatches("Leeds Rhinos", "rhinos"));
  assert.ok(teamMatches("Rhinos", "Leeds Rhinos"));
  assert.ok(!teamMatches("Leeds Rhinos", "Wigan"));
  assert.ok(!teamMatches("", "Rhinos"));
});

test("an empty want list means open to offers, not closed to everything", () => {
  // The board starts thin; strict matching against nothing would never fire.
  assert.ok(wantsTeam([], "Anything At All"));
  assert.ok(wantsTeam(undefined, "Anything"));
  assert.ok(wantsTeam(["Rhinos"], "Leeds Rhinos"));
  assert.ok(!wantsTeam(["Rhinos"], "Wigan Warriors"));
});

test("size gates only when both sides declared one", () => {
  assert.ok(sizeOk("L", []));            // they take any size
  assert.ok(sizeOk("", ["M", "L"]));     // lister didn't specify — humans decide
  assert.ok(sizeOk("L", ["m", "l"]));    // case-insensitive
  assert.ok(!sizeOk("XS", ["M", "L"]));
});

// ── Mutual matching (the JERSEY SWAP screenshot scenario) ──────────────
test("Bulldogs-for-Rhinos matches Rhinos-for-Bulldogs", () => {
  const kirsten = listing({ id: "a", have_team: "Leeds Rhinos", have_size: "M", want_teams: ["Bulldogs"] });
  const tMace = listing({ id: "b", have_team: "Canterbury Bulldogs", have_size: "M", want_teams: ["Leeds"], want_sizes: ["M"] });
  assert.ok(isMutualMatch(kirsten, tMace));
});

test("one-sided interest is not a match", () => {
  const a = listing({ id: "a", have_team: "Rhinos", want_teams: ["Bulldogs"] });
  const b = listing({ id: "b", have_team: "Bulldogs", want_teams: ["Storm"] }); // wants Storm, not Rhinos
  assert.ok(!isMutualMatch(a, b));
});

test("you never match your own listings", () => {
  const a = listing({ id: "a", swapper_key: "same-person", want_teams: [] });
  const b = listing({ id: "b", swapper_key: "same-person", want_teams: [] });
  assert.ok(!isMutualMatch(a, b));
  assert.ok(!isMutualMatch(a, a));
});

test("findMatches only pairs active listings and skips my own cards", () => {
  const mine = listing({ id: "m", is_me: true, have_team: "Bulldogs", want_teams: ["Rhinos"] });
  const match = listing({ id: "x", have_team: "Leeds Rhinos", want_teams: ["Bulldogs"] });
  const completed = listing({ id: "y", status: "completed", have_team: "Rhinos", want_teams: ["Bulldogs"] });
  const alsoMine = listing({ id: "z", is_me: true, have_team: "Rhinos", want_teams: ["Bulldogs"] });
  const found = findMatches([mine], [mine, match, completed, alsoMine]);
  assert.equal(found.length, 1);
  assert.equal(found[0].theirs.id, "x");
});

// ── Server-side guards (source-pinned) ─────────────────────────────────
test("completion is two-sided and finalised atomically under row locks", () => {
  const fn = read("supabase/functions/swapBoard/index.ts");
  const sql = read("supabase/migrations/0033_jersey_swap.sql");
  // The function must check the RECIPROCAL confirmation was written by the
  // counterpart's real owner, not just any row with the right ids.
  assert.ok(fn.includes(".eq('user_id', theirs.user_id)"), "reciprocal check must verify the counterpart owner");
  assert.ok(fn.includes("finalize_swap"), "completion goes through the RPC");
  assert.ok(sql.includes("for update"), "the RPC must lock both listings");
  assert.ok(/least\(p_a, p_b\)/.test(sql), "rows locked in id order so racing pairs cannot deadlock");
  // Solo confirms pay nothing.
  assert.ok(fn.includes("state: 'waiting'"), "one-sided confirms must wait, not pay");
});

test("the swap RPC cannot be called by end users directly", () => {
  const sql = read("supabase/migrations/0033_jersey_swap.sql");
  assert.ok(/revoke all on function public\.finalize_swap[\s\S]*from anon/.test(sql));
  assert.ok(/revoke all on function public\.finalize_swap[\s\S]*from authenticated/.test(sql));
});

test("swap_count is server-owned and the view masks identities", () => {
  const sql = read("supabase/migrations/0033_jersey_swap.sql");
  assert.ok(sql.includes("new.swap_count := old.swap_count"), "protect_profile_columns must cover swap_count");
  assert.ok(sql.includes("md5(l.user_id) as swapper_key"), "view exposes an opaque key, not the uuid");
  assert.ok(/case when \(select public\.is_admin\(\)\)[\s\S]*user_email/.test(sql), "email is admin-only");
});

test("a listing can only link the caller's own live top-level thread", () => {
  const fn = read("supabase/functions/swapBoard/index.ts");
  assert.ok(fn.includes("thread.user_id !== me.id"), "must reject someone else's thread");
  assert.ok(fn.includes("thread.parent_id"), "must reject replies");
  assert.ok(fn.includes("!thread.is_published"), "must reject unpublished drafts");
});

// ── Wiring guards ──────────────────────────────────────────────────────
test("JerseySwap category exists everywhere a category is validated or drawn", () => {
  assert.ok(read("src/lib/public-forms.js").includes('"JerseySwap"'), "client validation list");
  assert.ok(read("supabase/functions/_shared/shared.ts").includes("'JerseySwap'"), "server validation list");
  assert.ok(read("supabase/functions/submitForumPost/shared.ts").includes("'JerseySwap'"), "deployed copy synced");
  assert.ok(read("src/components/forum/feed/forumHelpers.js").includes("JerseySwap"), "category meta for the rail");
});

test("the board is routed, readable, and cross-linked from the forum", () => {
  assert.ok(read("src/App.jsx").includes('path="/swap"'), "route exists");
  assert.ok(read("src/api/base44Client.js").includes("SwapListing: 'swap_listings_view'"), "read-only entity mapping");
  assert.ok(read("src/pages/Forum.jsx").includes('to="/swap"'), "forum category links to the board");
  const page = read("src/pages/SwapBoard.jsx");
  assert.ok(page.includes('invoke("submitForumPost"'), "listing creates its forum thread through the front door");
  assert.ok(page.includes("thread=${"), "cards deep-link to the negotiation thread");
  assert.ok(page.includes("no cash"), "swap-only rule is stated to users");
});
