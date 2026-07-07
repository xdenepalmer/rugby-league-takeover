/**
 * Offline-safe sync queue for tipping entries.
 *
 * Tips are locked locally first (instant UX, works offline); the server write
 * goes through the submitTip edge function (kickoff deadline is enforced
 * server-side). When that call fails — offline, timeout, transient 5xx — the
 * payload is queued here (rlt_ localStorage convention) and flushed on the
 * next mount / reconnect, so a tip locked in a stadium dead-zone still reaches
 * the leaderboard. Server-side rejections (e.g. past-deadline) are dropped on
 * flush failure after kickoff via the pure helpers below.
 */
const QUEUE_KEY = "rlt_tips_unsynced";
const MAX_QUEUE = 50;

export function readTipQueue(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function enqueueTip(payload, storage = globalThis.localStorage) {
  if (!payload || !payload.game_id) return readTipQueue(storage);
  const queue = readTipQueue(storage).filter((t) => t.game_id !== payload.game_id);
  queue.push(payload);
  const bounded = queue.slice(-MAX_QUEUE);
  try {
    storage.setItem(QUEUE_KEY, JSON.stringify(bounded));
  } catch {
    // Storage full/blocked — queue lives in memory for this session only.
  }
  return bounded;
}

export function removeTipFromQueue(gameId, storage = globalThis.localStorage) {
  const queue = readTipQueue(storage).filter((t) => t.game_id !== gameId);
  try {
    storage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* best effort */
  }
  return queue;
}

/**
 * A queued tip is only worth retrying before kickoff — the server enforces the
 * deadline anyway, so retrying after kickoff just burns a rejected call.
 */
export function isTipStillSyncable(tip, now = new Date()) {
  if (!tip) return false;
  if (!tip.kickoff) return true; // TBA fixtures: let the server decide
  const kickoff = new Date(tip.kickoff);
  if (Number.isNaN(kickoff.getTime())) return true;
  return now < kickoff;
}

export function prunedTipQueue(storage = globalThis.localStorage, now = new Date()) {
  const kept = readTipQueue(storage).filter((t) => isTipStillSyncable(t, now));
  try {
    storage.setItem(QUEUE_KEY, JSON.stringify(kept));
  } catch {
    /* best effort */
  }
  return kept;
}
