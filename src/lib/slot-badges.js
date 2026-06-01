// Shared slot-machine model so the game and the forum agree on badges.
// Symbols are weighted (rarer = better badge), wins come ONLY from a real
// 3-of-a-kind landing — no forced wins, so most spins lose.

export const SLOT_SYMBOLS = [
  { key: "cherry", emoji: "🍒", weight: 30 },
  { key: "lemon", emoji: "🍋", weight: 26 },
  { key: "bell", emoji: "🔔", weight: 20 },
  { key: "dice", emoji: "🎲", weight: 18 },
  { key: "chip", emoji: "🟡", weight: 16 },
  { key: "star", emoji: "⭐", weight: 13 },
  { key: "footy", emoji: "🏉", weight: 10 },
  { key: "clover", emoji: "🍀", weight: 8 },
  { key: "diamond", emoji: "💎", weight: 6 },
  { key: "crown", emoji: "👑", weight: 4 },
  { key: "moneybag", emoji: "💰", weight: 3 },
  { key: "seven", emoji: "7️⃣", weight: 2 },
];

// One collectible badge per 3-of-a-kind. Higher rarity = rarer symbol.
export const SLOT_BADGES = [
  { id: "cherry", emoji: "🍒", label: "Cherry Picker", rarity: 1, tier: "Common" },
  { id: "lemon", emoji: "🍋", label: "Fresh Squeeze", rarity: 2, tier: "Common" },
  { id: "bell", emoji: "🔔", label: "Bell Ringer", rarity: 3, tier: "Common" },
  { id: "dice", emoji: "🎲", label: "Dice Roller", rarity: 4, tier: "Uncommon" },
  { id: "chip", emoji: "🟡", label: "Chip Collector", rarity: 5, tier: "Uncommon" },
  { id: "star", emoji: "⭐", label: "Lucky Star", rarity: 6, tier: "Rare" },
  { id: "footy", emoji: "🏉", label: "Footy Legend", rarity: 7, tier: "Rare" },
  { id: "clover", emoji: "🍀", label: "Four Leaf Flyer", rarity: 8, tier: "Epic" },
  { id: "diamond", emoji: "💎", label: "Diamond Hands", rarity: 9, tier: "Epic" },
  { id: "crown", emoji: "👑", label: "Casino Royalty", rarity: 10, tier: "Legendary" },
  { id: "moneybag", emoji: "💰", label: "High Roller", rarity: 11, tier: "Legendary" },
  { id: "seven", emoji: "7️⃣", label: "Triple Seven", rarity: 12, tier: "Mythic" },
];

const BADGE_BY_ID = Object.fromEntries(SLOT_BADGES.map((b) => [b.id, b]));
const SYMBOL_BY_KEY = Object.fromEntries(SLOT_SYMBOLS.map((s) => [s.key, s]));
const TOTAL_WEIGHT = SLOT_SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

export function getBadge(id) {
  return BADGE_BY_ID[id] || null;
}

// One weighted-random symbol.
export function weightedSymbol() {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const s of SLOT_SYMBOLS) {
    roll -= s.weight;
    if (roll <= 0) return s;
  }
  return SLOT_SYMBOLS[0];
}

// Three independent reels — the genuine outcome (no rigging).
export function spinReels() {
  return [weightedSymbol(), weightedSymbol(), weightedSymbol()];
}

// Evaluate the ACTUAL landed reels (array of symbol objects). Honest: the result
// always reflects what's on screen.
export function evaluateReels(reels) {
  const [a, b, c] = reels.map((r) => r.key);
  if (a === b && b === c) {
    return { type: "win", symbol: SYMBOL_BY_KEY[a], badge: BADGE_BY_ID[a] };
  }
  // Find the genuinely matching pair, if any.
  const pairKey = a === b ? a : b === c ? b : a === c ? a : null;
  if (pairKey) return { type: "near", symbol: SYMBOL_BY_KEY[pairKey] };
  return { type: "none" };
}

// The best (rarest) badge a user owns, for display next to their name.
export function topBadge(ids = []) {
  const owned = (ids || []).map((id) => BADGE_BY_ID[id]).filter(Boolean);
  if (!owned.length) return null;
  return owned.slice().sort((x, y) => y.rarity - x.rarity)[0];
}

// Normalise whatever is stored (array, or comma string) into an id array.
export function parseBadgeIds(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

export const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const SLOT_BADGES_KEY = "rlt_slot_badges";
export const SLOT_LAST_SPIN_KEY = "rlt_slot_last_spin";