import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  readTipQueue,
  enqueueTip,
  removeTipFromQueue,
  isTipStillSyncable,
  prunedTipQueue,
} from "../src/lib/tip-sync-queue.js";

const memStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ── Tip sync queue (offline robustness) ────────────────────────────────
test("failed tips queue, dedupe by game, and clear on sync", () => {
  const storage = memStorage();
  assert.deepEqual(readTipQueue(storage), []);
  enqueueTip({ game_id: "g1", selected_team: "A", kickoff: "2099-01-01T00:00:00Z" }, storage);
  enqueueTip({ game_id: "g2", selected_team: "B" }, storage);
  // Re-locking the same game replaces, never duplicates
  enqueueTip({ game_id: "g1", selected_team: "C", kickoff: "2099-01-01T00:00:00Z" }, storage);
  const queue = readTipQueue(storage);
  assert.equal(queue.length, 2);
  assert.equal(queue.find((t) => t.game_id === "g1").selected_team, "C");
  removeTipFromQueue("g1", storage);
  assert.equal(readTipQueue(storage).length, 1);
});

test("queue survives corrupt storage and bad payloads", () => {
  const storage = memStorage();
  storage.setItem("rlt_tips_unsynced", "{not json");
  assert.deepEqual(readTipQueue(storage), []);
  enqueueTip(null, storage);
  enqueueTip({ no_game_id: true }, storage);
  assert.deepEqual(readTipQueue(storage), []);
});

test("pruning drops tips whose kickoff has passed (server would reject)", () => {
  const storage = memStorage();
  const now = new Date("2026-03-01T12:00:00Z");
  enqueueTip({ game_id: "past", kickoff: "2026-03-01T10:00:00Z" }, storage);
  enqueueTip({ game_id: "future", kickoff: "2026-03-01T20:00:00Z" }, storage);
  enqueueTip({ game_id: "tba" }, storage); // no kickoff: server decides
  const kept = prunedTipQueue(storage, now);
  assert.deepEqual(kept.map((t) => t.game_id).sort(), ["future", "tba"]);
  assert.equal(isTipStillSyncable({ kickoff: "invalid-date" }, now), true);
});

// ── Wiring contracts ────────────────────────────────────────────────────
test("tipping still routes through submitTip and now queues failures", () => {
  const sp = read("src/components/forum/ScorePredictor.jsx");
  assert.ok(sp.includes('functions.invoke("submitTip"'), "server-authoritative path must remain");
  assert.ok(sp.includes("enqueueTip(") && sp.includes("prunedTipQueue()"), "failed tips must queue and flush");
  assert.ok(sp.includes('window.addEventListener("online", flush)'), "queue must flush on reconnect");
  assert.ok(sp.includes("successImpact()"), "lock-in haptic");
});

test("slot machine has haptic choreography and reduced-motion gates", () => {
  const slot = read("src/components/forum/SlotMachineBadgeUnlock.jsx");
  for (const token of ["mediumImpact()", "lightImpact()", "successImpact()", "warningImpact()", "useReducedMotion"]) {
    assert.ok(slot.includes(token), `slot machine missing ${token}`);
  }
  const effects = read("src/components/forum/slot/effects.jsx");
  assert.ok(effects.includes("reduced = false"), "effects must accept a reduced prop");
});

test("slot side panels have no sub-8px text", () => {
  for (const p of ["slot/BadgeCard.jsx", "slot/LuckyMeter.jsx", "slot/StatsPanel.jsx", "slot/WinHistoryLog.jsx"]) {
    const src = read(`src/components/forum/${p}`);
    assert.ok(!/text-\[[0-7](?:\.\d+)?px\]/.test(src), `${p} still has sub-8px text`);
  }
});
