import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  INVITE_ROLES,
  DEFAULT_INVITE_ROLE,
  isValidInviteRole,
  inviteRoleMeta,
  validateInviteEmail,
  buildInviteArgs,
  inviteSuccessMessage,
  inviteErrorMessage,
} from "../src/native/admin/workflows/invites-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// Forbidden-pattern scans look at CODE, not the doc comments that explain
// why those patterns are absent.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ── Roles: mirror the web select exactly ────────────────────────────────
test("invite roles mirror the web manager's select options and default", () => {
  assert.deepEqual(INVITE_ROLES.map((r) => r.key), ["admin", "user"], "same two roles the web <Select> offers");
  assert.equal(DEFAULT_INVITE_ROLE, "admin", "web role state initialises to admin");
  assert.equal(isValidInviteRole("admin"), true);
  assert.equal(isValidInviteRole("user"), true);
  assert.equal(isValidInviteRole("superadmin"), false, "no invented roles");
  assert.equal(inviteRoleMeta("user").label, "User");
  assert.equal(inviteRoleMeta("unknown").key, "admin", "unknown roles fall back to the web default");
});

// ── Email validation: never looser than the web ─────────────────────────
test("invite email validation blocks empties and obvious non-addresses", () => {
  assert.equal(validateInviteEmail("").ok, false, "web disables the button on empty email");
  assert.equal(validateInviteEmail("   ").ok, false, "whitespace-only rejected");
  assert.equal(validateInviteEmail(null).ok, false);
  assert.equal(validateInviteEmail("not-an-email").ok, false);
  assert.equal(validateInviteEmail("a@b").ok, false, "domain needs a dot");
  assert.equal(validateInviteEmail("two words@x.com").ok, false, "no spaces");
  const good = validateInviteEmail("  deb@example.com  ");
  assert.deepEqual(good, { ok: true, email: "deb@example.com", error: null }, "trimmed value is what gets sent");
});

// ── Payload parity: same args the web hands to inviteUser ───────────────
test("invite args carry exactly { email, role } with the web's defaults", () => {
  assert.deepEqual(buildInviteArgs(" deb@example.com ", "user"), { email: "deb@example.com", role: "user" });
  assert.deepEqual(buildInviteArgs("deb@example.com", "admin"), { email: "deb@example.com", role: "admin" });
  const fallback = buildInviteArgs("deb@example.com", "owner");
  assert.equal(fallback.role, "admin", "unknown roles collapse to the web default, never a new value");
  assert.deepEqual(Object.keys(fallback), ["email", "role"], "no extra fields ride along to the edge function");
});

test("status copy matches the web banner strings", () => {
  assert.equal(inviteSuccessMessage("deb@example.com"), "Invite sent to deb@example.com");
  assert.equal(inviteErrorMessage(new Error("boom")), "boom");
  assert.equal(inviteErrorMessage(null), "Invite could not be sent", "same fallback as the web catch block");
  assert.equal(inviteErrorMessage({}), "Invite could not be sent");
});

// ── Source contracts: same write authority, no invented surface ─────────
test("native invites write ONLY through the web's inviteUser client call", () => {
  const native = read("../src/native/admin/workflows/NativeInvitesWorkflow.jsx");
  const code = stripComments(native);
  assert.ok(code.includes("base44.users.inviteUser("), "the one write is the shared users.inviteUser helper");
  assert.ok(!/base44\.entities\.\w+\.(create|update|delete)\(/.test(code), "no direct entity writes — the web manager has none");
  assert.ok(!/functions\.invoke\(/.test(code), "no ad-hoc edge-function calls beyond the users helper");
  assert.ok(!/revoke/i.test(code), "no revoke flow is invented — the web surface has none");
  assert.ok(!/localStorage/.test(code), "session sends stay in memory; invite emails never touch disk");
  assert.ok(native.includes("mutateAsync"), "the confirm sheet awaits settlement");
  assert.ok(native.includes("AdminConfirmSheet"), "sending access is confirmed before it fires");
  assert.ok(native.includes("MobileActionDrawer"), "the form lives in a native sheet");
  assert.ok(native.includes("buildInviteArgs"), "args go through the shared parity builder");
  assert.ok(native.includes("validateInviteEmail"), "email is validated via the shared helper");
});

test("client helper still invokes the same inviteUser edge function as the web", () => {
  const client = read("../src/api/base44Client.js");
  assert.match(client, /inviteUser\(email, role[^)]*\)\s*\{\s*const \{ data \} = await functions\.invoke\('inviteUser', \{ email, role \}\)/, "users.inviteUser → edge fn inviteUser({ email, role })");
  const web = read("../src/components/admin/UserInviteManager.jsx");
  assert.ok(web.includes("base44.users.inviteUser(email, role)"), "web manager still uses the shared helper (parity anchor)");
});

test("native invites emit no audit events the web doesn't dispatch", () => {
  const native = read("../src/native/admin/workflows/NativeInvitesWorkflow.jsx");
  const web = read("../src/components/admin/UserInviteManager.jsx");
  assert.ok(!web.includes("rlt_admin_log"), "web manager dispatches no admin-log events (source of truth)");
  assert.ok(!native.includes("emitAdminLog") && !native.includes("rlt_admin_log"), "so native invents none either");
});

test("native invites UX rules: haptics, touch targets, no hover-only affordances", () => {
  const native = read("../src/native/admin/workflows/NativeInvitesWorkflow.jsx");
  assert.ok(!native.includes("group-hover:"), "no hover-hidden actions");
  assert.ok(!/from ["']@capacitor/.test(native), "no static @capacitor imports");
  assert.ok(native.includes("min-h-11"), "44pt touch targets");
  for (const event of ["tab.select", "action.primary", "save.success", "mutation.error"]) {
    assert.ok(native.includes(`"${event}"`), `emits ${event}`);
  }
  assert.ok(native.includes("NativeTopBar"), "self-chromed with its own top bar");
  assert.ok(native.includes('fallback="/admin/people"'), "back falls back to the People hub");
  assert.ok(native.includes("NativeEmptyState"), "empty session log uses the shared empty state");
});
