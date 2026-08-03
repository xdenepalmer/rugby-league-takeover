import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// The gamification work was built against the pre-refactor monolithic slot
// component and got stranded when main decomposed it into slot/*. These tests
// pin the re-integrated wiring so a future refactor can't silently drop it
// again — the symptom last time was a casino that looked fine but paid nothing.

// ── Slot machine: the house rolls, not the browser ──────────────────────
test("signed-in slot spins are server-authoritative", () => {
  const slot = read("src/components/forum/SlotMachineBadgeUnlock.jsx");
  assert.ok(slot.includes('functions.invoke("slotSpin"'), "spins must go through the slotSpin edge function");
  assert.ok(slot.includes("serverSpinRef"), "the server result must drive finishSpin");
  // The reels animate TO the server's symbols, so the payout the player sees
  // is the payout the database recorded.
  assert.ok(slot.includes("SYMBOL_BY_KEY"), "server symbol keys must map back to reel symbols");
  assert.ok(slot.includes("startSpinAnimation(symbols)"), "animation must replay the server's reels");
});

test("guests keep a local spin and are never told they earned anything", () => {
  const slot = read("src/components/forum/SlotMachineBadgeUnlock.jsx");
  assert.ok(slot.includes("if (!isAuthenticated)"), "guest branch must exist");
  assert.ok(slot.includes("startSpinAnimation(spinReels())"), "guests use local RNG");
});

test("the daily gate follows the account, not the device", () => {
  const slot = read("src/components/forum/SlotMachineBadgeUnlock.jsx");
  // localStorage alone let a player clear storage (or switch device) for a
  // second free spin; the server's UTC day is the authority when signed in.
  assert.ok(slot.includes("serverSpunDateRef"), "server spin date must gate the cooldown");
  assert.ok(slot.includes("msToNextUtcMidnight"), "cooldown must run to the server's UTC day boundary");
});

test("extra spins are offered only after the free spin and only when affordable", () => {
  const slot = read("src/components/forum/SlotMachineBadgeUnlock.jsx");
  assert.ok(slot.includes('handleSpin("extra")'), "extra-spin call site");
  assert.ok(/extraInfo\.remaining > 0/.test(slot), "must respect the daily extra allowance");
  assert.ok(/disabled=\{!extraInfo\.affordable/.test(slot), "must not offer a spin the player cannot pay for");
});

test("the port kept main's haptic + reduced-motion choreography", () => {
  const slot = read("src/components/forum/SlotMachineBadgeUnlock.jsx");
  for (const token of ["mediumImpact()", "lightImpact()", "successImpact()", "warningImpact()", "useReducedMotion"]) {
    assert.ok(slot.includes(token), `slot machine lost ${token} during the server-wiring port`);
  }
});

// ── Tipping: real settled points, not an estimate ───────────────────────
test("finished matchups trigger server settlement", () => {
  const sp = read("src/components/forum/ScorePredictor.jsx");
  assert.ok(sp.includes('functions.invoke("settleTips"'), "settlement must be server-side");
  assert.ok(sp.includes("settleTriggeredRef"), "must not re-trigger settlement every render");
  assert.ok(sp.includes("!e.settled_at"), "only unsettled entries should trigger a settle");
});

test("the ladder ranks on settled points and degrades to participation", () => {
  // The ladder now lives in its own component (TipLadder) over a pure
  // aggregation module (ladder.js) with round/season scopes.
  const ladder = read("src/components/forum/tipping/TipLadder.jsx");
  const rows = read("src/components/forum/tipping/ladder.js");
  assert.ok(rows.includes("entry.points"), "rival points must come from settled entries");
  assert.ok(!/points:\s*r\.tips\s*\*\s*2/.test(rows + ladder), "must not fabricate points from tip count");
  // Before any fixture settles every row is on zero, so the bars fall back to
  // tips rather than all collapsing to the minimum width.
  assert.ok(ladder.includes("anyPoints"), "must handle the pre-settlement case");
  // Display names collide; accounts don't.
  assert.ok(rows.includes("entry.user_id || `name:"), "rows must key on user_id when present");
});

// ── Daily missions ──────────────────────────────────────────────────────
test("daily missions card is mounted on both mobile and desktop", () => {
  const forum = read("src/pages/Forum.jsx");
  assert.ok(forum.includes('import DailyMissions from "@/components/forum/feed/DailyMissions"'), "import");
  const mounts = forum.match(/<DailyMissions \/>/g) || [];
  assert.equal(mounts.length, 2, "expected a mount in the mobile tools tab and the desktop sidebar");
});

test("the missions card reads and claims through the server", () => {
  const dm = read("src/components/forum/feed/DailyMissions.jsx");
  assert.ok(dm.includes('invoke("claimDailyBonus", { claim: false })'), "status read");
  assert.ok(dm.includes('invoke("claimDailyBonus", { claim: true })'), "claim");
  assert.ok(dm.includes("refreshUser()"), "claiming must refresh the profile so chips appear");
});

test("the tall sidebar scrolls independently instead of running off-screen", () => {
  const forum = read("src/pages/Forum.jsx");
  const sidebar = forum.split("\n").find((l) => l.includes('id="forum-compose-sidebar"') && l.includes("className"));
  assert.ok(sidebar, "sidebar element");
  assert.ok(sidebar.includes("lg:sticky") && sidebar.includes("lg:overflow-y-auto"), "sidebar must scroll on its own");
});

// ── Backend present in the repo, not just deployed ──────────────────────
test("the edge functions and migrations are committed, not only live", () => {
  for (const fn of ["slotSpin", "settleTips", "claimDailyBonus"]) {
    assert.ok(existsSync(new URL(`../supabase/functions/${fn}/index.ts`, import.meta.url)), `${fn} source missing`);
  }
  assert.ok(existsSync(new URL("../supabase/migrations/0014_gamification.sql", import.meta.url)));
  assert.ok(existsSync(new URL("../supabase/migrations/0015_slot_spin_rpc.sql", import.meta.url)));
});

test("the spin RPC cannot be called directly by end users", () => {
  const sql = read("supabase/migrations/0015_slot_spin_rpc.sql");
  // Without these revokes a signed-in user could POST /rest/v1/rpc/apply_slot_spin
  // with an arbitrary p_chips_won and mint themselves chips.
  assert.ok(/revoke all on function public\.apply_slot_spin[\s\S]*from anon/.test(sql), "must be revoked from anon");
  assert.ok(/revoke all on function public\.apply_slot_spin[\s\S]*from authenticated/.test(sql), "must be revoked from authenticated");
  assert.ok(sql.includes("for update"), "the claim must hold a row lock to close the double-spin race");
});
