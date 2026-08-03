// Aggregate settled server entries into ladder rows. Rows are keyed by
// user_id when we have one — display names collide, accounts don't.
// Pure module (no JSX) so the behaviour is unit-testable under node:test.
export function buildLadderRows(entries, { myUserId, myName, roundLabel } = {}) {
  const totals = new Map();
  const seen = new Set();
  (entries || []).forEach((entry) => {
    if (roundLabel && entry.game_label !== roundLabel) return;
    const name = entry.tipper_name || "Mystery Fan";
    const key = entry.user_id || `name:${name}`;
    const dedupe = `${entry.game_id}|${key}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    const row = totals.get(key) || {
      key, name, tips: 0, points: 0, wins: 0, settled: 0,
      me: (myUserId && entry.user_id === myUserId) || (!myUserId && myName && name === myName),
    };
    row.name = entry.tipper_name || row.name; // latest name wins
    row.tips += 1;
    row.points += Number(entry.points) || 0;
    if (entry.settled_at) row.settled += 1;
    if (entry.result === "win" || entry.result === "perfect") row.wins += 1;
    totals.set(key, row);
  });
  return Array.from(totals.values())
    .sort((a, b) => (b.points - a.points) || (b.wins - a.wins) || (b.tips - a.tips) || a.name.localeCompare(b.name))
    .map((row, i) => ({ ...row, rank: i + 1 }));
}
