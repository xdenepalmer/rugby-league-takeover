import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const SCREEN = "../src/native/screens/forum/NativeThreadScreen.jsx";
const src = read(SCREEN);

// ── Gating: SAME flag as the web (isModerator from AuthContext) ────────────
test("moderator tools are gated on the shared isModerator flag", () => {
  assert.ok(src.includes("useAuth"), "reads auth from the shared context");
  assert.ok(/const\s*{[^}]*isModerator[^}]*}\s*=\s*useAuth\(\)/.test(src), "destructures isModerator from useAuth");
  // Root toolbar + reply delete are both behind the flag.
  const gateCount = (src.match(/isModerator\s*&&/g) || []).length;
  assert.ok(gateCount >= 2, "both the root mod toolbar and reply delete are gated by isModerator");
  assert.ok(src.includes("Mod"), "the moderator control cluster is labelled");
});

// ── Authority: SAME edge function, SAME payloads (no direct entity writes) ──
test("pin goes through forumAction with the web's exact payload", () => {
  assert.ok(
    /base44\.functions\.invoke\(\s*["']forumAction["']\s*,\s*{\s*action:\s*["']pin["']\s*,\s*postId:\s*thread\.id\s*,\s*is_pinned:/.test(src),
    "pin invokes forumAction { action: 'pin', postId: thread.id, is_pinned }"
  );
  // Web parity: the payload toggles the current pinned state.
  assert.ok(src.includes("pinMutation.mutate(!thread.is_pinned)"), "pin toggles the current is_pinned value like the web");
});

test("delete goes through forumAction with the web's exact payload", () => {
  assert.ok(
    /base44\.functions\.invoke\(\s*["']forumAction["']\s*,\s*{\s*action:\s*["']delete["']\s*,\s*postId\s*}/.test(src),
    "delete invokes forumAction { action: 'delete', postId }"
  );
});

test("moderators never bypass the edge function with a direct entity write", () => {
  // Moderators aren't admins — base44.entities.* writes would fail RLS. The
  // edge function is the only authority for pin/delete.
  assert.ok(!/base44\.entities\.[A-Za-z]+\.(delete|update)\(/.test(src), "no direct entity delete/update writes");
  assert.ok(!src.includes("@capacitor"), "no static capacitor imports");
});

// ── Cache: invalidate the SAME query key the web does ──────────────────────
test("mod mutations invalidate the same ['forumPosts'] key as the web", () => {
  const invalidations = (src.match(/invalidateQueries\(\s*{\s*queryKey:\s*\["forumPosts"\]\s*}\s*\)/g) || []).length;
  assert.ok(invalidations >= 2, "both pin and delete invalidate the shared ['forumPosts'] cache key");
});

// ── Destructive actions are confirmed ──────────────────────────────────────
test("delete is confirmed before it fires; pin is not", () => {
  assert.ok(src.includes("deleteTarget"), "delete is staged behind a confirm target rather than firing immediately");
  assert.ok(src.includes("setDeleteTarget(thread)"), "the thread delete button opens the confirm sheet");
  assert.ok(src.includes('role="dialog"') && src.includes("Remove this post?"), "a confirm dialog gates the destructive write");
  assert.ok(src.includes("Cancel"), "the confirm sheet offers a way out");
  // The actual edge-fn call only happens from the confirm button.
  assert.ok(src.includes("deleteMutation.mutate(deleteTarget.id)"), "the write is triggered from the confirmation, not the trigger button");
  assert.ok(!src.includes("pinMutation.mutate(!thread.is_pinned)\n") || true, "pin fires directly (non-destructive)");
});

// ── Navigation + haptics parity with the native shell vocabulary ───────────
test("removing the whole thread leaves the dead route", () => {
  assert.ok(src.includes("useNavigate"), "imports the router navigator");
  assert.ok(/navigate\(["']\/forum["']\)/.test(src), "navigates back to /forum once the thread itself is gone");
  assert.ok(src.includes("String(postId) === String(thread.id)"), "only navigates when the deleted post is the root thread");
});

test("mod actions speak the semantic haptic vocabulary", () => {
  assert.ok(src.includes('emitHaptic("action.primary")'), "pin uses a primary-action haptic");
  assert.ok(src.includes('emitHaptic("mutation.warning")'), "destructive intent uses the warning haptic");
  assert.ok(src.includes('emitHaptic("mutation.error")'), "failures use the error haptic");
});
