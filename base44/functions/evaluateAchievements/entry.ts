import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';

// Durably evaluates and records fan achievements.
//
// Self-contained by design: Base44 deploys each function from its own directory
// and does not support cross-function imports. The catalog + thresholds here
// MIRROR src/lib/achievements.js — keep the two in sync.
//
// Flow: identify caller -> read their casino_* stats + badges -> compute which
// catalog achievements are met -> create an AchievementUnlock row for each one
// not already recorded (dedup) -> award the one-time chip rewards once.

const LEGENDARY_SLOT_BADGE_IDS = ['crown', 'moneybag', 'seven'];
const SLOT_BADGE_TOTAL = 12;

const ACHIEVEMENTS = [
  { id: 'forum_first_post', category: 'forum', tier: 'Common', metric: 'posts', threshold: 1, reward_chips: 25 },
  { id: 'forum_posts_10', category: 'forum', tier: 'Uncommon', metric: 'posts', threshold: 10, reward_chips: 75 },
  { id: 'forum_posts_50', category: 'forum', tier: 'Epic', metric: 'posts', threshold: 50, reward_chips: 250 },
  { id: 'forum_first_reply', category: 'forum', tier: 'Common', metric: 'replies', threshold: 1, reward_chips: 25 },
  { id: 'forum_replies_25', category: 'forum', tier: 'Rare', metric: 'replies', threshold: 25, reward_chips: 150 },
  { id: 'forum_reactions_given_50', category: 'forum', tier: 'Uncommon', metric: 'reactions_given', threshold: 50, reward_chips: 100 },
  { id: 'forum_reactions_received_100', category: 'forum', tier: 'Epic', metric: 'reactions_received', threshold: 100, reward_chips: 300 },
  { id: 'streak_3', category: 'streak', tier: 'Common', metric: 'streak', threshold: 3, reward_chips: 50 },
  { id: 'streak_7', category: 'streak', tier: 'Rare', metric: 'streak', threshold: 7, reward_chips: 150 },
  { id: 'streak_30', category: 'streak', tier: 'Legendary', metric: 'streak', threshold: 30, reward_chips: 500 },
  { id: 'rank_table_regular', category: 'rank', tier: 'Uncommon', metric: 'xp', threshold: 180, reward_chips: 75 },
  { id: 'rank_high_roller', category: 'rank', tier: 'Rare', metric: 'xp', threshold: 900, reward_chips: 200 },
  { id: 'rank_vegas_royalty', category: 'rank', tier: 'Legendary', metric: 'xp', threshold: 2500, reward_chips: 600 },
  { id: 'slots_first_badge', category: 'slots', tier: 'Common', metric: 'badge_count', threshold: 1, reward_chips: 50 },
  { id: 'slots_badges_5', category: 'slots', tier: 'Rare', metric: 'badge_count', threshold: 5, reward_chips: 200 },
  { id: 'slots_legendary', category: 'slots', tier: 'Epic', metric: 'legendary_badge_count', threshold: 1, reward_chips: 300 },
  { id: 'slots_full_set', category: 'slots', tier: 'Legendary', metric: 'badge_count', threshold: SLOT_BADGE_TOTAL, reward_chips: 750 },
  { id: 'chips_500', category: 'community', tier: 'Uncommon', metric: 'chips', threshold: 500, reward_chips: 0 },
  { id: 'chips_2500', category: 'community', tier: 'Epic', metric: 'chips', threshold: 2500, reward_chips: 0 },
];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function parseBadgeIds(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

function buildStats(user) {
  const owned = parseBadgeIds(user?.badges);
  const legendary = new Set(LEGENDARY_SLOT_BADGE_IDS);
  return {
    posts: num(user?.casino_total_posts),
    replies: num(user?.casino_total_replies),
    reactions_given: num(user?.casino_total_reactions_given),
    reactions_received: num(user?.casino_total_reactions_received),
    streak: num(user?.casino_streak),
    xp: num(user?.casino_xp),
    chips: num(user?.casino_chips),
    badge_count: owned.length,
    legendary_badge_count: owned.filter((id) => legendary.has(id)).length,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }
    if (!user?.id) return Response.json({ error: 'Login required' }, { status: 401 });

    // Read the freshest stats via service role (the caller token can read self,
    // but service role guarantees the counter fields regardless of RLS).
    const fullUser = await base44.asServiceRole.entities.User.get(user.id);
    const stats = buildStats(fullUser || user);

    const metIds = ACHIEVEMENTS.filter((a) => num(stats[a.metric]) >= a.threshold).map((a) => a.id);

    // Already-recorded unlocks for this user (dedup so rewards grant once).
    const existing = await base44.asServiceRole.entities.AchievementUnlock.filter(
      { user_id: user.id }, '-created_date', 500,
    );
    const recorded = new Set((existing || []).map((r) => r.achievement_id));

    const newly = metIds.filter((id) => !recorded.has(id));
    const now = new Date().toISOString();
    let awardedChips = 0;

    for (const id of newly) {
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (!def) continue;
      await base44.asServiceRole.entities.AchievementUnlock.create({
        user_id: user.id,
        user_email: user.email || '',
        achievement_id: def.id,
        category: def.category,
        tier: def.tier,
        reward_chips: def.reward_chips || 0,
        unlocked_at: now,
      });
      awardedChips += num(def.reward_chips);
    }

    if (awardedChips > 0) {
      await base44.asServiceRole.entities.User.update(user.id, {
        casino_chips: num(fullUser?.casino_chips) + awardedChips,
      });
    }

    return Response.json({
      ok: true,
      unlocked: metIds,
      newlyUnlocked: newly,
      awardedChips,
    });
  } catch (error) {
    console.error('evaluateAchievements error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
