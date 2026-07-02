// Shared runtime helpers for Rugby League Takeover Supabase Edge Functions.
// Each function directory carries a copy of this file (deployed alongside
// index.ts) so every function stays self-contained, mirroring the original
// Base44 function layout. Edit THIS file and run scripts/sync-shared.mjs
// (or copy manually) to fan changes out.
import { createClient } from 'npm:@supabase/supabase-js@2';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

export const preflight = () => new Response('ok', { headers: CORS });

// Service-role client — bypasses RLS. SUPABASE_* env vars are injected by the
// Supabase Edge runtime automatically.
export function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

// Resolve the calling app user (their profiles row) from the Authorization
// header. Returns null for anonymous callers, invalid tokens, or disabled
// accounts — matching base44.auth.me() semantics.
// deno-lint-ignore no-explicit-any
export async function getCaller(req: Request, svc: any) {
  try {
    const header = req.headers.get('authorization') || '';
    const token = header.replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;
    const { data, error } = await svc.auth.getUser(token);
    if (error || !data?.user) return null;
    const { data: profile } = await svc
      .from('profiles')
      .select('*')
      .eq('auth_user_id', data.user.id)
      .maybeSingle();
    if (!profile || profile.disabled) return null;
    return profile;
  } catch {
    return null;
  }
}

export const trimToLength = (value: unknown, maxLength: number) =>
  String(value ?? '').trim().slice(0, maxLength);

export const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const isEmail = (email: unknown) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

export const isLikelyBot = (input: Record<string, unknown> | null | undefined) =>
  Boolean(trimToLength(input?.website, 256) || trimToLength(input?.company, 256));

export function resolveClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return (req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || '').trim();
}

// Returns the first matching active, non-expired ban, or null.
// deno-lint-ignore no-explicit-any
export async function findActiveBan(svc: any, { ip, emails = [], userId }: { ip?: string; emails?: (string | null | undefined)[]; userId?: string }) {
  const now = Date.now();
  const candidates: { ban_type: string; value: string }[] = [];
  if (ip) candidates.push({ ban_type: 'ip', value: ip.toLowerCase() });
  for (const email of emails) {
    if (email) candidates.push({ ban_type: 'email', value: String(email).toLowerCase() });
  }
  if (userId) candidates.push({ ban_type: 'user', value: String(userId).toLowerCase() });

  for (const candidate of candidates) {
    const { data } = await svc
      .from('bans')
      .select('*')
      .eq('ban_type', candidate.ban_type)
      .eq('value', candidate.value)
      .eq('is_active', true);
    for (const ban of data || []) {
      if (!ban.expires_at || new Date(ban.expires_at).getTime() > now) return ban;
    }
  }
  return null;
}

// Automatic profanity censoring. Word-boundary match, keeps the first letter
// and masks the rest (e.g. "shit" -> "s***"). Applied to post body and title.
const PROFANITY = [
  'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bullshit', 'bitch', 'cunt',
  'asshole', 'arsehole', 'bastard', 'dickhead', 'piss', 'slut', 'whore', 'wanker',
  'prick', 'bollocks', 'bugger', 'twat', 'fag', 'faggot', 'nigger', 'nigga', 'retard',
];
const PROFANITY_RE = new RegExp(`\\b(${PROFANITY.join('|')})\\b`, 'gi');
export const censorProfanity = (text: unknown) =>
  String(text || '').replace(PROFANITY_RE, (match) => match[0] + '*'.repeat(Math.max(match.length - 1, 1)));

export const FORUM_CATEGORIES = ['General', 'Travel', 'Events', 'MatchDay', 'VegasTips'];

const CASINO_RANKS = [
  { min: 2500, name: 'Vegas Royalty' }, { min: 1500, name: 'Whale' }, { min: 900, name: 'High Roller' },
  { min: 450, name: 'Pit Boss' }, { min: 180, name: 'Table Regular' }, { min: 60, name: 'Lucky Local' }, { min: 0, name: 'Rookie Punter' },
];
export const todayKey = () => new Date().toISOString().slice(0, 10);
export const rankForXp = (xp: number) => CASINO_RANKS.find((r) => xp >= r.min)?.name || 'Rookie Punter';

// Award casino XP/chips for forum activity + log a ForumRewardEvent.
// Mirrors the Base44 awardForumReward logic (incl. daily streak bonus).
// deno-lint-ignore no-explicit-any
export async function awardForumReward(svc: any, user: { id?: string; email?: string } | null, { kind, xp, chips, postId, note, counter }: { kind: string; xp: number; chips: number; postId?: string; note: string; counter?: string }) {
  if (!user?.id) return null;
  try {
    const { data: fullUser } = await svc.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (!fullUser) return null;
    const today = todayKey();
    const last = String(fullUser.casino_last_active_date || '');
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const streak = last === today ? num(fullUser.casino_streak) : last === yesterday ? num(fullUser.casino_streak) + 1 : 1;
    const streakBonus = last === today ? 0 : Math.min(50, streak * 5);
    const nextXp = num(fullUser.casino_xp) + xp + streakBonus;
    const nextChips = num(fullUser.casino_chips) + chips + streakBonus;
    const rank = rankForXp(nextXp);
    const update: Record<string, unknown> = {
      casino_xp: nextXp, casino_chips: nextChips, casino_rank: rank,
      casino_streak: streak, casino_last_active_date: today,
    };
    if (counter) update[counter] = num(fullUser[counter]) + 1;
    await svc.from('profiles').update(update).eq('id', user.id);
    await svc.from('forum_reward_events').insert({
      user_id: user.id, user_email: user.email || '', kind,
      xp: xp + streakBonus, chips: chips + streakBonus, rank_after: rank,
      post_id: postId || '', note: streakBonus ? `${note} · ${streak} day streak bonus` : note,
    });
    return { xp: xp + streakBonus, chips: chips + streakBonus, rank, streak };
  } catch (error) {
    console.error('awardForumReward error:', error);
    return null;
  }
}

// deno-lint-ignore no-explicit-any
export async function getForumPost(svc: any, postId: unknown) {
  const id = String(postId || '').trim();
  if (!id) return null;
  const { data } = await svc.from('forum_posts').select('*').eq('id', id).maybeSingle();
  return data || null;
}
