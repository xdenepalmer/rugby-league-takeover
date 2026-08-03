// Ladder aggregation.
//
// Rows come from tipping_ladder_view (migration 0029), which groups in the
// DATABASE by real user_id and per round. That matters twice over:
//   * tipping_entries_view masks user_id to null for everyone but the row's
//     owner, so a client-side aggregate could only key rivals by display
//     name — two accounts sharing a name merged into one row.
//   * the client's raw-entry fetch is capped, so a client-side season ladder
//     silently covered only the last couple of rounds.
// Guests (no account) are not on the ladder: the server can't tell one
// anonymous tipper from another without exposing IPs, and a shared "Vegas
// Fan" row that accrues everyone's points is worse than saying so plainly.
//
// Pure module (no JSX) so the behaviour is unit-testable under node:test.
export function buildLadderRows(ladderRows, { roundLabel } = {}) {
  const totals = new Map();
  (ladderRows || []).forEach((row) => {
    if (roundLabel && row.game_label !== roundLabel) return;
    const key = row.tipster_key;
    if (!key) return;
    const acc = totals.get(key) || {
      key,
      name: row.tipper_name || "Mystery Fan",
      tips: 0,
      points: 0,
      wins: 0,
      settled: 0,
      me: false,
    };
    acc.name = row.tipper_name || acc.name;
    acc.tips += Number(row.tips) || 0;
    acc.points += Number(row.points) || 0;
    acc.wins += Number(row.wins) || 0;
    acc.settled += Number(row.settled) || 0;
    acc.me = acc.me || row.is_me === true;
    totals.set(key, acc);
  });
  return Array.from(totals.values())
    .sort((a, b) => (b.points - a.points) || (b.wins - a.wins) || (b.tips - a.tips) || a.name.localeCompare(b.name))
    .map((row, i) => ({ ...row, rank: i + 1 }));
}
