// Canonical achievement catalog for the fan gamification system.
//
// Achievements are DERIVED from server-durable stats already tracked on the User
// entity (casino_* counters + the badges array), so the cabinet works with no
// extra writes. The evaluateAchievements backend function records each unlock in
// the AchievementUnlock entity (dedup + one-time chip reward) — this module is
// the single source of truth for the catalog and the threshold logic, mirrored
// (inlined) inside that function. Keep the two in sync.
//
// Pure + dependency-light on purpose so it is unit-testable under `node --test`.
import { parseBadgeIds, SLOT_BADGES } from "./slot-badges.js";

export const ACHIEVEMENT_CATEGORIES = [
  { key: "forum", label: "Forum" },
  { key: "streak", label: "Streaks" },
  { key: "rank", label: "Rank & XP" },
  { key: "slots", label: "Slot Badges" },
  { key: "community", label: "Community" },
];

export const ACHIEVEMENT_TIERS = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];

// Slot badge ids that count as a "legendary" pull (Legendary + Mythic tiers).
export const LEGENDARY_SLOT_BADGE_IDS = SLOT_BADGES
  .filter((b) => b.tier === "Legendary" || b.tier === "Mythic")
  .map((b) => b.id);

// Each achievement: id, title, description, emoji, category, tier, the stat
// `metric` it reads, the `threshold` to unlock, and a one-time `reward_chips`.
export const ACHIEVEMENTS = [
  // ── Forum ──────────────────────────────────────────────────────────────
  { id: "forum_first_post", title: "First Words", description: "Start your first forum thread.", emoji: "📝", category: "forum", tier: "Common", metric: "posts", threshold: 1, reward_chips: 25 },
  { id: "forum_posts_10", title: "Regular Poster", description: "Start 10 forum threads.", emoji: "🗣️", category: "forum", tier: "Uncommon", metric: "posts", threshold: 10, reward_chips: 75 },
  { id: "forum_posts_50", title: "Thread Machine", description: "Start 50 forum threads.", emoji: "🏟️", category: "forum", tier: "Epic", metric: "posts", threshold: 50, reward_chips: 250 },
  { id: "forum_first_reply", title: "Joining In", description: "Post your first reply.", emoji: "💬", category: "forum", tier: "Common", metric: "replies", threshold: 1, reward_chips: 25 },
  { id: "forum_replies_25", title: "Conversationalist", description: "Post 25 replies.", emoji: "🔁", category: "forum", tier: "Rare", metric: "replies", threshold: 25, reward_chips: 150 },
  { id: "forum_reactions_given_50", title: "Hype Crew", description: "Give 50 reactions to other fans.", emoji: "👏", category: "forum", tier: "Uncommon", metric: "reactions_given", threshold: 50, reward_chips: 100 },
  { id: "forum_reactions_received_100", title: "Crowd Favourite", description: "Receive 100 reactions on your posts.", emoji: "❤️", category: "forum", tier: "Epic", metric: "reactions_received", threshold: 100, reward_chips: 300 },

  // ── Streaks ────────────────────────────────────────────────────────────
  { id: "streak_3", title: "Warming Up", description: "Stay active 3 days in a row.", emoji: "🔥", category: "streak", tier: "Common", metric: "streak", threshold: 3, reward_chips: 50 },
  { id: "streak_7", title: "Week Warrior", description: "Keep a 7-day activity streak.", emoji: "📅", category: "streak", tier: "Rare", metric: "streak", threshold: 7, reward_chips: 150 },
  { id: "streak_30", title: "Ever Present", description: "Keep a 30-day activity streak.", emoji: "🏅", category: "streak", tier: "Legendary", metric: "streak", threshold: 30, reward_chips: 500 },

  // ── Rank & XP ──────────────────────────────────────────────────────────
  { id: "rank_table_regular", title: "Table Regular", description: "Reach 180 XP.", emoji: "🎟️", category: "rank", tier: "Uncommon", metric: "xp", threshold: 180, reward_chips: 75 },
  { id: "rank_high_roller", title: "High Roller", description: "Reach 900 XP.", emoji: "🎩", category: "rank", tier: "Rare", metric: "xp", threshold: 900, reward_chips: 200 },
  { id: "rank_vegas_royalty", title: "Vegas Royalty", description: "Reach 2,500 XP.", emoji: "👑", category: "rank", tier: "Legendary", metric: "xp", threshold: 2500, reward_chips: 600 },

  // ── Slot Badges ──────────────────────────────────────────────────────────
  { id: "slots_first_badge", title: "First Spin Win", description: "Collect your first slot badge.", emoji: "🎰", category: "slots", tier: "Common", metric: "badge_count", threshold: 1, reward_chips: 50 },
  { id: "slots_badges_5", title: "Badge Hunter", description: "Collect 5 different slot badges.", emoji: "🧩", category: "slots", tier: "Rare", metric: "badge_count", threshold: 5, reward_chips: 200 },
  { id: "slots_legendary", title: "Jackpot Legend", description: "Land a Legendary or Mythic slot badge.", emoji: "💰", category: "slots", tier: "Epic", metric: "legendary_badge_count", threshold: 1, reward_chips: 300 },
  { id: "slots_full_set", title: "The Whole Collection", description: "Collect all 12 slot badges.", emoji: "🏆", category: "slots", tier: "Legendary", metric: "badge_count", threshold: SLOT_BADGES.length, reward_chips: 750 },

  // ── Community ────────────────────────────────────────────────────────────
  { id: "chips_500", title: "Stacking Chips", description: "Bank 500 chips.", emoji: "🪙", category: "community", tier: "Uncommon", metric: "chips", threshold: 500, reward_chips: 0 },
  { id: "chips_2500", title: "Chip Tycoon", description: "Bank 2,500 chips.", emoji: "💎", category: "community", tier: "Epic", metric: "chips", threshold: 2500, reward_chips: 0 },
];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Normalise a Base44 User record into the flat stat shape the catalog reads.
export function normalizeStats(user = {}) {
  const ownedBadges = parseBadgeIds(user.badges);
  const legendarySet = new Set(LEGENDARY_SLOT_BADGE_IDS);
  return {
    posts: num(user.casino_total_posts),
    replies: num(user.casino_total_replies),
    reactions_given: num(user.casino_total_reactions_given),
    reactions_received: num(user.casino_total_reactions_received),
    streak: num(user.casino_streak),
    xp: num(user.casino_xp),
    chips: num(user.casino_chips),
    badge_count: ownedBadges.length,
    legendary_badge_count: ownedBadges.filter((id) => legendarySet.has(id)).length,
  };
}

// Evaluate the full catalog against a stat object. Returns per-achievement
// progress plus the set of unlocked ids — used by the UI for instant display
// and mirrored server-side for durable unlock recording.
export function evaluateAchievements(stats = {}) {
  const items = ACHIEVEMENTS.map((a) => {
    const value = num(stats[a.metric]);
    const unlocked = value >= a.threshold;
    const pct = a.threshold > 0 ? Math.min(100, Math.round((value / a.threshold) * 100)) : 0;
    return { ...a, value, unlocked, pct };
  });
  return {
    items,
    unlockedIds: items.filter((i) => i.unlocked).map((i) => i.id),
    unlockedCount: items.filter((i) => i.unlocked).length,
    total: items.length,
  };
}
