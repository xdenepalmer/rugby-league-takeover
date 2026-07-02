// Durably evaluates and records fan achievements.
// The catalog + thresholds here MIRROR src/lib/achievements.js — keep in sync.
import { json, preflight, serviceClient, getCaller, num } from './shared.ts';

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

function parseBadgeIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

// deno-lint-ignore no-explicit-any
function buildStats(user: any) {
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
  } as Record<string, number>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const user = await getCaller(req, svc);
    if (!user?.id) return json({ error: 'Login required' }, 401);

    const { data: fullUser } = await svc.from('profiles').select('*').eq('id', user.id).maybeSingle();
    const stats = buildStats(fullUser || user);

    const metIds = ACHIEVEMENTS.filter((a) => num(stats[a.metric]) >= a.threshold).map((a) => a.id);

    // Already-recorded unlocks for this user (dedup so rewards grant once).
    const { data: existing } = await svc
      .from('achievement_unlocks')
      .select('achievement_id')
      .eq('user_id', user.id)
      .limit(500);
    const recorded = new Set((existing || []).map((r) => r.achievement_id));

    const newly = metIds.filter((id) => !recorded.has(id));
    const now = new Date().toISOString();
    let awardedChips = 0;

    for (const id of newly) {
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (!def) continue;
      await svc.from('achievement_unlocks').insert({
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
      await svc.from('profiles')
        .update({ casino_chips: num(fullUser?.casino_chips) + awardedChips })
        .eq('id', user.id);
    }

    return json({ ok: true, unlocked: metIds, newlyUnlocked: newly, awardedChips });
  } catch (error) {
    console.error('evaluateAchievements error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
