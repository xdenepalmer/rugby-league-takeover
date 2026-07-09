// Server-side slot machine spin. The reels are rolled HERE (not in the
// browser), the daily limit is enforced per profile, and rewards — chips,
// XP, badges, streak — are written to the profile so they follow the
// account across devices. Mirrors the weights in src/lib/slot-badges.js.
//
// Modes:
//   daily  — one free spin per UTC day.
//   extra  — costs EXTRA_SPIN_COST chips, up to MAX_EXTRA_PER_DAY per day.
import { json, preflight, serviceClient, getCaller, num, todayKey } from './shared.ts';

const SLOT_SYMBOLS = [
  { key: 'cherry', weight: 30 },
  { key: 'lemon', weight: 26 },
  { key: 'bell', weight: 20 },
  { key: 'dice', weight: 18 },
  { key: 'chip', weight: 16 },
  { key: 'star', weight: 13 },
  { key: 'footy', weight: 10 },
  { key: 'clover', weight: 8 },
  { key: 'diamond', weight: 6 },
  { key: 'crown', weight: 4 },
  { key: 'moneybag', weight: 3 },
  { key: 'seven', weight: 2 },
];
const TOTAL_WEIGHT = SLOT_SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

const BADGE_TIER: Record<string, string> = {
  cherry: 'Common', lemon: 'Common', bell: 'Common',
  dice: 'Uncommon', chip: 'Uncommon',
  star: 'Rare', footy: 'Rare',
  clover: 'Epic', diamond: 'Epic',
  crown: 'Legendary', moneybag: 'Legendary',
  seven: 'Mythic',
};
const TIER_CHIPS: Record<string, number> = {
  Common: 150, Uncommon: 250, Rare: 400, Epic: 600, Legendary: 900, Mythic: 2000,
};
const BADGE_LABEL: Record<string, string> = {
  cherry: 'Cherry Picker', lemon: 'Fresh Squeeze', bell: 'Bell Ringer',
  dice: 'Dice Roller', chip: 'Chip Collector', star: 'Lucky Star',
  footy: 'Footy Legend', clover: 'Four Leaf Flyer', diamond: 'Diamond Hands',
  crown: 'Casino Royalty', moneybag: 'High Roller', seven: 'Triple Seven',
};

const PAIR_CHIPS = 20;
const PAIR_XP = 5;
const TRIPLE_XP = 25;
const EXTRA_SPIN_COST = 300;
const MAX_EXTRA_PER_DAY = 3;

function rollSymbol() {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const s of SLOT_SYMBOLS) {
    roll -= s.weight;
    if (roll <= 0) return s.key;
  }
  return SLOT_SYMBOLS[0].key;
}

const yesterdayKey = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  try {
    const svc = serviceClient();
    const me = await getCaller(req, svc);
    if (!me) return json({ error: 'Sign in to spin for real rewards' }, 401);

    const { mode = 'daily' } = await req.json().catch(() => ({}));
    const today = todayKey();

    // Re-read the profile fresh (getCaller may be slightly stale under rapid calls).
    const { data: profile } = await svc.from('profiles').select('*').eq('id', me.id).maybeSingle();
    if (!profile) return json({ error: 'Profile not found' }, 404);

    const chips = num(profile.casino_chips);
    const extraDate = String(profile.slot_extra_date || '');
    const extraUsedToday = extraDate === today ? num(profile.slot_extra_count) : 0;
    const dailyUsed = String(profile.slot_last_spin_date || '') === today;

    // deno-lint-ignore no-explicit-any
    const update: Record<string, any> = {};
    let chipsSpent = 0;

    if (mode === 'extra') {
      if (!dailyUsed) return json({ error: 'Use your free daily spin first' }, 400);
      if (extraUsedToday >= MAX_EXTRA_PER_DAY) return json({ error: `No extra spins left today (max ${MAX_EXTRA_PER_DAY})` }, 400);
      if (chips < EXTRA_SPIN_COST) return json({ error: `Not enough chips — an extra spin costs ${EXTRA_SPIN_COST}` }, 400);
      chipsSpent = EXTRA_SPIN_COST;
      update.slot_extra_date = today;
      update.slot_extra_count = extraUsedToday + 1;
    } else {
      if (dailyUsed) {
        return json({
          error: 'Daily spin already used — come back tomorrow or buy an extra spin',
          extra: { cost: EXTRA_SPIN_COST, remaining: Math.max(0, MAX_EXTRA_PER_DAY - extraUsedToday), affordable: chips >= EXTRA_SPIN_COST },
        }, 429);
      }
      update.slot_last_spin_date = today;
      // Consecutive-day streak (server-side, device-independent).
      const last = String(profile.slot_last_spin_date || '');
      update.slot_streak = last === yesterdayKey() ? num(profile.slot_streak) + 1 : 1;
    }

    // ── Roll (three independent reels; wins only from genuine 3-of-a-kind) ──
    const reels = [rollSymbol(), rollSymbol(), rollSymbol()];
    const [a, b, c] = reels;
    const isTriple = a === b && b === c;
    const pairKey = a === b ? a : b === c ? b : a === c ? a : null;

    let chipsWon = 0;
    let xpWon = 0;
    let badgeId: string | null = null;
    let isNewBadge = false;

    const ownedBadges: string[] = Array.isArray(profile.badges)
      ? profile.badges.map((v: unknown) => String(v))
      : [];

    if (isTriple) {
      badgeId = a;
      const tier = BADGE_TIER[a] || 'Common';
      chipsWon = TIER_CHIPS[tier] || 150;
      xpWon = TRIPLE_XP;
      if (!ownedBadges.includes(badgeId)) {
        isNewBadge = true;
        update.badges = [...ownedBadges, badgeId];
      }
    } else if (pairKey) {
      chipsWon = PAIR_CHIPS;
      xpWon = PAIR_XP;
    }

    update.slot_total_spins = num(profile.slot_total_spins) + 1;
    update.casino_chips = Math.max(0, chips - chipsSpent + chipsWon);
    if (xpWon > 0) update.casino_xp = num(profile.casino_xp) + xpWon;

    const { error: updateError } = await svc.from('profiles').update(update).eq('id', me.id);
    if (updateError) throw updateError;

    if (chipsWon > 0) {
      await svc.from('forum_reward_events').insert({
        user_id: me.id,
        user_email: me.email || '',
        kind: 'slot_win',
        xp: xpWon,
        chips: chipsWon,
        rank_after: profile.casino_rank || 'Rookie Punter',
        post_id: '',
        note: isTriple
          ? `Slot jackpot — ${BADGE_LABEL[badgeId!] || badgeId} (${BADGE_TIER[badgeId!] || ''} 3-of-a-kind)`
          : 'Slot near-miss — pair consolation',
      });
    }

    return json({
      ok: true,
      reels,
      outcome: isTriple ? 'triple' : pairKey ? 'pair' : 'none',
      badgeId,
      isNewBadge,
      chipsWon,
      chipsSpent,
      xpWon,
      chipsBalance: update.casino_chips,
      streak: num(update.slot_streak ?? profile.slot_streak),
      totalSpins: update.slot_total_spins,
      extra: {
        cost: EXTRA_SPIN_COST,
        remaining: Math.max(0, MAX_EXTRA_PER_DAY - (mode === 'extra' ? extraUsedToday + 1 : extraUsedToday)),
        affordable: update.casino_chips >= EXTRA_SPIN_COST,
      },
    });
  } catch (error) {
    console.error('slotSpin error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
