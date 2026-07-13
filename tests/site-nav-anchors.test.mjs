import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// Regression: in the mobile hamburger drawer, anchor links (About Us → /#about,
// Travel Packages → /#travel, Events → /#events) used to run scrollToHash while
// the body was still position:fixed (a no-op), and closing the drawer restored
// the pre-open scroll — so those items appeared to do nothing. The fix DEFERS
// the anchor scroll until the drawer has closed and the body is unlocked.
test("mobile drawer defers anchor scrolling until the body is unlocked", () => {
  const src = read("../src/components/public/SiteNav.jsx");

  // The buggy pattern — scrolling inline in the drawer onClick — must be gone.
  assert.ok(
    !src.includes("scrollToHash(link.href, e); setOpen(false)"),
    "drawer must not scroll a still-locked body inline on click"
  );

  // The drawer now routes taps through the deferring handler.
  assert.ok(src.includes("handleDrawerNav"), "drawer taps go through handleDrawerNav");
  assert.ok(src.includes("onClick={(e) => handleDrawerNav(link.href, e)}"), "drawer link wired to handleDrawerNav");

  // A pending-hash latch carries the anchor across the drawer close.
  assert.ok(src.includes("pendingHashRef"), "a pending-hash ref defers the anchor");
  assert.ok(src.includes("pendingHashRef.current = href.substring(1)"), "hash links set the pending hash");

  // The body-unlock effect consumes the pending hash and scrolls AFTER unlocking.
  const effectHasGoToHash = /unlockBody\(\)[\s\S]*?pendingHashRef\.current[\s\S]*?goToHash\(hash\)/.test(src);
  assert.ok(effectHasGoToHash, "the unlock effect scrolls to the pending anchor after unlocking the body");

  // The shared goToHash still retries for lazily-mounted sections and handles
  // both same-page and cross-page anchors.
  assert.ok(src.includes("const goToHash"), "goToHash helper exists");
  assert.ok(src.includes("attempt < 6"), "retries while lazy sections mount");

  // Desktop nav keeps its direct scroll (page is scrollable there).
  assert.ok(src.includes("onClick={(e) => scrollToHash(link.href, e)}"), "desktop nav still scrolls directly");
});
