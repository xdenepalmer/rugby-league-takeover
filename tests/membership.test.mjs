import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  isActiveMember, hasLapsed, daysRemaining, isExpiringSoon,
  membershipStatusLine, MEMBERSHIP_TERM_MONTHS,
} from "../src/lib/membership.js";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
const migration = () => read("../supabase/migrations/0030_membership.sql");
const card = () => read("../supabase/functions/membershipCard/index.ts");

const days = (n) => new Date(Date.now() + n * 86400000).toISOString();

// ── Term semantics ──────────────────────────────────────────────────────────

test("membership is judged against the clock, never a stored flag", () => {
  assert.equal(isActiveMember({ membership_expires_at: days(30) }), true);
  assert.equal(isActiveMember({ membership_expires_at: days(-1) }), false, "yesterday is not active");
  assert.equal(isActiveMember({ membership_expires_at: null }), false, "never joined");
  assert.equal(isActiveMember({}), false);
  assert.equal(isActiveMember({ membership_expires_at: "not a date" }), false, "garbage is not a membership");
});

test("a lapsed member is distinguishable from someone who never joined", () => {
  assert.equal(hasLapsed({ membership_expires_at: days(-5) }), true);
  assert.equal(hasLapsed({ membership_expires_at: days(5) }), false, "still active, not lapsed");
  assert.equal(hasLapsed({ membership_expires_at: null }), false, "never a member is not lapsed");
  // The two states need different copy — "renew" vs "join".
  assert.match(membershipStatusLine({ membership_expires_at: days(-5) }), /Expired/);
  assert.match(membershipStatusLine({}), /Not a member/);
});

test("the renewal nudge fires only inside the last month", () => {
  assert.equal(isExpiringSoon({ membership_expires_at: days(10) }), true);
  assert.equal(isExpiringSoon({ membership_expires_at: days(200) }), false, "no nagging all year");
  assert.equal(isExpiringSoon({ membership_expires_at: days(-1) }), false, "expired is not 'expiring'");
  assert.equal(daysRemaining({ membership_expires_at: days(9.5) }), 10);
  assert.equal(daysRemaining({}), null);
  assert.match(membershipStatusLine({ membership_expires_at: days(2) }), /Expires in \d+ days?/);
});

// ── Server: entitlement is server-owned ─────────────────────────────────────

test("a member can never grant themselves membership", () => {
  // profiles is self-updatable under RLS; this trigger is the ONLY thing
  // stopping a user writing their own expiry through the profile update path.
  const sql = migration();
  const trigger = sql.slice(sql.indexOf("function public.protect_profile_columns"), sql.indexOf("revoke execute on function public.protect_profile_columns"));
  for (const column of ["membership_started_at", "membership_expires_at", "membership_number", "membership_source"]) {
    assert.ok(
      new RegExp(`new\\.${column} := old\\.${column};`).test(trigger),
      `${column} must be reverted for non-admin writers`,
    );
  }
});

test("membership is granted from the product row inside the paid-order transaction", () => {
  const sql = migration();
  // Which SKU grants membership is DATA an admin controls, not a product id
  // hardcoded in the backend.
  assert.match(sql, /add column if not exists membership_months integer not null default 0/);
  assert.match(sql, /v_membership_months \+ \(v_product\.membership_months \* v_qty\)/, "term comes off the product, times quantity");
  // Idempotency: the grant sits inside process_store_order_payment, which
  // already returns early on a duplicate Stripe event, so a webhook retry
  // cannot double the term.
  const rpc = sql.slice(sql.indexOf("create or replace function public.process_store_order_payment"));
  assert.ok(rpc.indexOf("duplicate_event") < rpc.indexOf("grant_membership"), "the duplicate-event guard must precede the grant");
  // Paid-for-but-unattachable membership must be surfaced, not swallowed.
  assert.match(sql, /membership_unassigned/);
});

test("renewing extends the existing term instead of resetting it", () => {
  const sql = migration();
  const grant = sql.slice(sql.indexOf("create or replace function public.grant_membership"), sql.indexOf("revoke execute on function public.grant_membership"));
  assert.match(grant, /when v_profile\.membership_expires_at is not null and v_profile\.membership_expires_at > now\(\)\s*\n\s*then v_profile\.membership_expires_at/,
    "an active member's new term starts at their CURRENT expiry — they never lose paid time");
  assert.match(grant, /else now\(\)/, "a lapsed member starts fresh from today");
  assert.match(grant, /coalesce\(nullif\(trim\(v_profile\.membership_number\), ''\), public\.next_membership_number\(\)\)/,
    "a renewal keeps the same member number");
});

test("assigning a member number never quietly extends the term", () => {
  // grant_membership clamps months to a minimum of 1, so routing a
  // number-backfill through it would have added a month to the member.
  const sql = migration();
  assert.match(sql, /create or replace function public\.ensure_membership_number/);
  assert.match(card(), /ensure_membership_number/, "the card must use the number-only allocator");
  assert.doesNotMatch(card(), /rpc\('grant_membership'/, "the card must never call the granting RPC");
});

// ── Card + verification ─────────────────────────────────────────────────────

test("the scannable code is short-lived and signed, not a bare member number", () => {
  const src = card();
  // A bare number is copied off a photo of someone else's card and works
  // forever; a signed token that expires is useless once shared.
  assert.match(src, /TOKEN_TTL_SECONDS/);
  assert.match(src, /crypto\.subtle\.sign\('HMAC'/);
  assert.match(src, /exp\) \* 1000 <= Date\.now\(\)/, "an expired token must be rejected");
  assert.match(src, /function safeEqual/, "signature comparison must be constant-time");
});

test("verification re-reads live membership and is staff-only", () => {
  const src = card();
  // The token proves WHO; whether they're a member is always read fresh, so a
  // refund or revocation takes effect at the bar immediately.
  assert.match(src, /if \(me\.role !== 'admin' && me\.role !== 'moderator'\)/, "membership status is not public info");
  const verify = src.slice(src.indexOf("if (action === 'verify')"));
  assert.match(verify, /\.from\('profiles'\)/, "verify must hit the database, not trust the token");
  assert.match(verify, /isActive\(profile\.membership_expires_at\)/);
  assert.match(verify, /input\?\.number/, "staff need a manual lookup when a code won't scan");
});

test("the QR opens the staff check page so any phone camera works", () => {
  const ui = read("../src/components/membership/MembershipCard.jsx");
  assert.match(ui, /\/verify-member\?t=\$\{encodeURIComponent\(data\.token\)\}/);
  assert.match(read("../src/App.jsx"), /path="\/verify-member"/, "the route must exist");
});

test("wallet buttons stay hidden until the passes are actually provisioned", () => {
  const ui = read("../src/components/membership/MembershipCard.jsx");
  const pass = read("../supabase/functions/membershipPass/index.ts");
  assert.match(ui, /if \(!status\?\.apple && !status\?\.google\) return null;/, "no dead 'Add to Wallet' buttons");
  assert.match(pass, /apple: appleConfigured\(\), google: !!google/, "status reflects configured secrets");
  assert.match(pass, /apple_unconfigured/, "Apple must fail honestly rather than half-work");
});

// ── Forum badge ─────────────────────────────────────────────────────────────

test("the forum badge is a live boolean and never leaks membership dates", () => {
  const fn = read("../supabase/functions/forumAvatars/index.ts");
  assert.match(fn, /new Date\(u\.membership_expires_at\)\.getTime\(\) > Date\.now\(\)/, "computed against now(), so a lapse removes it");
  assert.match(fn, /is_member: isMember/);
  assert.doesNotMatch(fn, /membership_number|membership_started_at:/, "only the boolean is public");
  // A member with an otherwise-empty profile must still reach the feed.
  assert.match(fn, /row\.casino_xp > 0 \|\| row\.is_member/);
});

test("the member badge renders from one component on every author surface", () => {
  const badge = read("../src/components/forum/feed/MemberBadge.jsx");
  assert.match(badge, /if \(!meta\?\.is_member\) return null;/);
  for (const file of [
    "../src/components/forum/feed/AuthorMeta.jsx",
    "../src/components/forum/ReplyTree.jsx",
    "../src/components/forum/feed/UserProfileHoverCard.jsx",
  ]) {
    assert.match(read(file), /MemberBadge/, `${file} must render the shared badge`);
  }
  // AuthorMeta bailed out early when a member had no location/team/slot badge
  // and no casino XP — the badge they paid for would never have rendered.
  assert.match(read("../src/components/forum/feed/AuthorMeta.jsx"), /!meta\.casino_xp && !meta\.is_member\)\) return null;/);
});

test("is_member survives the trip from the server to the badge", () => {
  const forum = read("../src/pages/Forum.jsx");
  // forumAvatars returns is_member, but the client rebuilds each row field by
  // field — dropping it there meant NOBODY's badge rendered, however correct
  // the server was.
  assert.match(forum, /is_member: a\.is_member === true/, "the server row must carry is_member into the map");
  // The viewer's OWN row replaces the server row (so their live profile edits
  // show instantly), which made their badge the one badge they never saw.
  assert.match(forum, /is_member: isActiveMember\(user\)/, "the viewer's own row must derive membership from their profile");
  assert.match(forum, /from "@\/lib\/membership"/);
});

test("attachments size to the image, not to a fixed letterboxed frame", () => {
  const media = read("../src/components/forum/ForumMedia.jsx");
  // w-full + object-contain stretched every attachment to the post width and
  // padded the rest, so portrait photos sat in a slab of empty background.
  assert.doesNotMatch(media, /className="[^"]*w-full object-contain/, "attachments must not be letterboxed");
  assert.match(media, /h-auto max-h-\[26rem\] w-auto max-w-full/, "image keeps its own aspect ratio, capped");
  // The FRAME hugs the image too: leaving it full-width just moved the dead
  // space from inside the image element to the container behind it.
  assert.match(media, /flex w-fit max-w-full/, "the frame must size to the image");
});

test("admins can grant and end memberships, and see who is a member", () => {
  const fn = read("../supabase/functions/adminUsers/index.ts");
  assert.match(fn, /'membership_number', 'membership_started_at', 'membership_expires_at', 'membership_source'/,
    "the People screen needs these fields projected");
  assert.match(fn, /action === 'grantMembership'/);
  assert.match(fn, /action === 'revokeMembership'/);
  assert.match(fn, /months < 1 \|\| months > 120/, "months must be bounded");
  // A comp uses the SAME rpc as a paid order, so renewal semantics can't drift.
  assert.match(fn, /rpc\('grant_membership'/);
  assert.equal(MEMBERSHIP_TERM_MONTHS, 12);
});
