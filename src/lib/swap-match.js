// Jersey swap matching. Pure functions — tested directly in
// tests/swap-rules.test.mjs, consumed by src/pages/SwapBoard.jsx.
//
// A mutual match means each side's HAVE satisfies the other side's WANT:
// my Bulldogs L is on their want list AND their Rhinos M is on mine. Team
// matching is deliberately fuzzy (case-insensitive containment either way),
// because fans type "Rhinos", "Leeds", or "Leeds Rhinos" for the same club.
// An empty want list is a wildcard — "open to offers" — which matters most
// early on, when the board is thin and strict matching would show nothing.

const norm = (value) => String(value ?? "").trim().toLowerCase();

export function teamMatches(haveTeam, wantTeam) {
  const have = norm(haveTeam);
  const want = norm(wantTeam);
  if (!have || !want) return false;
  return have.includes(want) || want.includes(have);
}

export function wantsTeam(wantTeams, haveTeam) {
  const wants = Array.isArray(wantTeams) ? wantTeams.filter(Boolean) : [];
  if (wants.length === 0) return true; // open to offers
  return wants.some((want) => teamMatches(haveTeam, want));
}

export function sizeOk(haveSize, wantSizes) {
  const wants = Array.isArray(wantSizes) ? wantSizes.filter(Boolean) : [];
  if (wants.length === 0) return true; // any size
  const have = norm(haveSize);
  if (!have) return true; // lister didn't specify — let the humans decide
  return wants.some((want) => norm(want) === have);
}

/** Does listing `b`'s want list accept listing `a`'s jersey? */
export function sideAccepts(a, b) {
  return wantsTeam(b?.want_teams, a?.have_team) && sizeOk(a?.have_size, b?.want_sizes);
}

export function isMutualMatch(a, b) {
  if (!a || !b || a.id === b.id) return false;
  // swapper_key is the view's opaque per-user key — same person, no match.
  if (a.swapper_key && b.swapper_key && a.swapper_key === b.swapper_key) return false;
  return sideAccepts(a, b) && sideAccepts(b, a);
}

/**
 * All mutual matches between my listings and everyone else's.
 * Returns [{ mine, theirs }] sorted newest-counterpart-first.
 */
export function findMatches(myListings, allListings) {
  const matches = [];
  for (const mine of myListings || []) {
    if (mine?.status !== "active") continue;
    for (const theirs of allListings || []) {
      if (theirs?.status !== "active" || theirs?.is_me) continue;
      if (isMutualMatch(mine, theirs)) matches.push({ mine, theirs });
    }
  }
  return matches.sort((x, y) => new Date(y.theirs.created_date) - new Date(x.theirs.created_date));
}
