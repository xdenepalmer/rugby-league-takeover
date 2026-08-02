import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
const forum = () => read("../src/pages/Forum.jsx");

// ── Correctness fixes from the launch review ────────────────────────────────

test("thread modal derives its post from the live list, never a stored snapshot", () => {
  const source = forum();
  assert.ok(source.includes("threadModalId"), "modal state must be the thread ID");
  assert.ok(!source.includes("setThreadModalPost"), "storing the post object froze a snapshot — replies posted from the modal never appeared");
  assert.ok(/allThreads\.find\(\(t\) => t\.id === threadModalId\)/.test(source), "modal post must be derived from allThreads");
});

test("read tracker parses backend dates as UTC and scans the whole reply tree", () => {
  const source = read("../src/lib/forum-read-tracker.js");
  assert.ok(source.includes("parseForumDate"), "raw new Date() read tz-less UTC as local time and killed unread badges for AEST users");
  assert.ok(source.includes("flattenReplies"), "a flat scan missed replies-to-replies");
});

test("posting and replying carry an in-flight guard against double submits", () => {
  const source = forum();
  assert.ok(source.includes("if (createMutation.isPending || updateMutation.isPending) return;"), "handlePost needs a double-tap guard");
  // handleReply reads the in-flight flag via a ref so the callback stays
  // referentially stable (memoised feed cards).
  assert.ok(source.includes("if (createPendingRef.current) return; // double-tap guard"), "handleReply needs a double-tap guard");
});

test("edit mode never leaks into the new-thread draft autosave", () => {
  const source = forum();
  assert.ok(/if \(editTarget\) return;/.test(source), "autosaving while editing offered someone's published post as a recovered draft");
});

test("reply drafts persist with a TTL so a backgrounded app keeps the text", () => {
  const source = forum();
  assert.ok(source.includes("rlt_forum_reply_drafts"), "reply drafts must persist");
  assert.ok(source.includes("REPLY_DRAFT_TTL_MS"), "persisted reply drafts need a TTL");
});

test("overlays share the ref-counted body scroll lock", () => {
  assert.ok(read("../src/lib/scroll-lock.js").includes("lockCount"), "scroll lock must be ref-counted");
  assert.ok(forum().includes("lockBodyScroll"), "compose sheet must use the shared lock");
  assert.ok(read("../src/components/forum/feed/ThreadDetailModal.jsx").includes("lockBodyScroll"), "thread modal must use the shared lock");
});

test("the hover card no longer fabricates a member-since date", () => {
  const source = read("../src/components/forum/feed/UserProfileHoverCard.jsx");
  assert.ok(!source.includes("memberDays"), "member-since was a hash of the display name shown as fact");
  assert.ok(!source.includes("Member since"), "fabricated join dates must stay gone");
});

// ── Mobile above-the-fold budget ────────────────────────────────────────────

test("forum chrome is compressed on phones so posts reach the first screens", () => {
  const source = forum();
  // Hero description and stat grid step back to sm+; phones get one stat line.
  assert.ok(source.includes("hidden max-w-md text-sm"), "hero description must be hidden on phones");
  assert.ok(/threads · .*replies · .*members/.test(source), "phones need the one-line stats summary");
  // Trending: desktop-only and gated until it has enough threads to differ
  // from the feed right under it.
  assert.ok(source.includes("allThreads.length >= 8"), "trending must wait for enough threads");
  // The in-feed ad renders IN the feed, not above the first post.
  assert.ok(source.includes("index === 3 && <AdSlot"), "in-feed ad belongs inside the feed");
});

test("the compose FAB waits for the inline compose buttons to scroll away", () => {
  const source = forum();
  assert.ok(source.includes("pastFold"), "FAB must not cover content while the header compose actions are visible");
});

test("the mobile compose sheet sizes itself to the visual viewport (keyboard)", () => {
  const source = forum();
  assert.ok(source.includes("composeViewport"), "keyboard coverage: the sheet must track window.visualViewport");
});

// ── Pokie (slot machine) launch fixes ───────────────────────────────────────

test("slot reels rest with the landed symbol on the payline", () => {
  const source = read("../src/components/forum/slot/ReelWindow.jsx");
  assert.ok(source.includes("restY"), "a lone resting cell must be pushed down to the payline row");
  assert.ok(/animate=\{\{ y: spinning \? \[0, targetY - 14, targetY\] : restY \}\}/.test(source), "resting position must use restY, not 0");
});

test("the slot win celebration clears itself instead of covering the app until tomorrow", () => {
  const source = read("../src/components/forum/SlotMachineBadgeUnlock.jsx");
  assert.ok(/setIsWin\(false\); setIsNewBadgeWin\(false\); \}, isNew \? 3500 : 2500\)/.test(source), "the full-viewport overlay needs an end timer");
});

test("the slot prize wall ships collapsed behind a tier summary", () => {
  const source = read("../src/components/forum/SlotMachineBadgeUnlock.jsx");
  assert.ok(source.includes("wallExpanded"), "the 12-card ??? wall must be collapsible");
  assert.ok(source.includes("Show all"), "the full ladder stays one tap away");
});

test("signed-in slot cooldown follows the server day only, and 429s sync the client", () => {
  const source = read("../src/components/forum/SlotMachineBadgeUnlock.jsx");
  assert.ok(source.includes("if (isAuthenticated) {\n        const spunToday"), "a stale guest timestamp must not lock out a signed-in user");
  assert.ok(source.includes('err?.status === 429'), "daily-already-used must set the cooldown so the extra-spin offer appears");
});
