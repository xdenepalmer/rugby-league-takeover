// Server-side slot machine spin. The reels are rolled HERE (not in the
// browser), but the daily limit, extra-spin cap/cost, and all reward writes
// are applied by the apply_slot_spin RPC under a single row lock. That makes
// the whole spin atomic: N concurrent requests serialize, so only one free
// daily spin (or one extra spin per slot) can ever win — closing the
// read-then-write race the naive version had. Mirrors the weights in
// src/lib/slot-badges.js.
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
    const spinMode = mode === 'extra' ? 'extra' : 'daily';
    const today = todayKey();

    // ── Roll first (pure RNG — no state touched until the RPC claims it) ──
    const reels = [rollSymbol(), rollSymbol(), rollSymbol()];
    const [a, b, c] = reels;
    const isTriple = a === b && b === c;
    const pairKey = a === b ? a : b === c ? b : a === c ? a : null;

    let chipsWon = 0;
    let xpWon = 0;
    let badgeId: string | null = null;
    if (isTriple) {
      badgeId = a;
      chipsWon = TIER_CHIPS[BADGE_TIER[a] || 'Common'] || 150;
      xpWon = TRIPLE_XP;
    } else if (pairKey) {
      chipsWon = PAIR_CHIPS;
      xpWon = PAIR_XP;
    }

    // ── Atomic claim + reward under a row lock (server-authoritative) ──
    const { data: res, error: rpcError } = await svc.rpc('apply_slot_spin', {
      p_profile_id: me.id,
      p_mode: spinMode,
      p_today: today,
      p_yesterday: yesterdayKey(),
      p_cost: EXTRA_SPIN_COST,
      p_max_extra: MAX_EXTRA_PER_DAY,
      p_chips_won: chipsWon,
      p_xp_won: xpWon,
      p_new_badge: isTriple && badgeId ? badgeId : '',
    });
    if (rpcError) throw rpcError;

    if (!res?.ok) {
      const chips = num(res?.chips ?? me.casino_chips);
      const extraUsed = num(res?.extra_used);
      const extra = {
        cost: EXTRA_SPIN_COST,
        remaining: Math.max(0, MAX_EXTRA_PER_DAY - extraUsed),
        affordable: chips >= EXTRA_SPIN_COST,
      };
      switch (res?.reason) {
        case 'daily_used':
          return json({ error: 'Daily spin already used — come back tomorrow or buy an extra spin', extra }, 429);
        case 'use_daily_first':
          return json({ error: 'Use your free daily spin first' }, 400);
        case 'no_extra_left':
          return json({ error: `No extra spins left today (max ${MAX_EXTRA_PER_DAY})`, extra }, 400);
        case 'insufficient_chips':
          return json({ error: `Not enough chips — an extra spin costs ${EXTRA_SPIN_COST}`, extra }, 400);
        case 'not_found':
          return json({ error: 'Profile not found' }, 404);
        default:
          return json({ error: 'Spin could not be completed' }, 400);
      }
    }

    const isNewBadge = isTriple && !!res.badge_added;
    const chipsBalance = num(res.chips);
    const extraUsedNow = num(res.extra_used);
    const chipsSpent = spinMode === 'extra' ? EXTRA_SPIN_COST : 0;

    // History/log entry (best-effort; the reward itself is already committed).
    if (chipsWon > 0) {
      await svc.from('forum_reward_events').insert({
        user_id: me.id,
        user_email: me.email || '',
        kind: 'slot_win',
        xp: xpWon,
        chips: chipsWon,
        rank_after: me.casino_rank || 'Rookie Punter',
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
      chipsBalance,
      streak: num(res.streak),
      totalSpins: num(res.total_spins),
      extra: {
        cost: EXTRA_SPIN_COST,
        remaining: Math.max(0, MAX_EXTRA_PER_DAY - extraUsedNow),
        affordable: chipsBalance >= EXTRA_SPIN_COST,
      },
    });
  } catch (error) {
    console.error('slotSpin error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
