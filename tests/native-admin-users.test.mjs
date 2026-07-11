import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  USER_ROLES,
  USER_ROLE_FILTERS,
  userRoleMeta,
  filterUsers,
  userCounts,
  userRoleFilterCounts,
  buildBanCommonFields,
  buildBanRecords,
  relatedActiveBans,
  isSelfUser,
} from "../src/native/admin/workflows/users-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Roles + filtering mirror the web UsersManager ────────────────────────
test("role set and filter chips mirror the web manager", () => {
  assert.deepEqual(USER_ROLES, ["admin", "moderator", "user"]);
  assert.deepEqual(USER_ROLE_FILTERS.map((f) => f.key), ["all", "admin", "moderator", "user"]);
  assert.equal(userRoleMeta("admin").label, "Admin");
  assert.equal(userRoleMeta(undefined).label, "User", "missing role renders as user");
});

test("user filtering: missing role counts as 'user', search spans name + email", () => {
  const users = [
    { id: "1", full_name: "Deb Admin", email: "deb@rlt.com", role: "admin" },
    { id: "2", full_name: "Mia Mod", email: "mia@rlt.com", role: "moderator" },
    { id: "3", full_name: "", email: "fan@rlt.com" }, // no role → "user"
    { id: "4", full_name: "Sam Fan", email: "sam@x.com", role: "user" },
  ];
  assert.equal(filterUsers(users).length, 4, "no filters shows everyone");
  assert.deepEqual(filterUsers(users, { role: "user" }).map((u) => u.id), ["3", "4"], "missing role treated as user (web parity)");
  assert.deepEqual(filterUsers(users, { query: "DEB" }).map((u) => u.id), ["1"], "search is case-insensitive");
  assert.deepEqual(filterUsers(users, { query: "rlt.com", role: "moderator" }).map((u) => u.id), ["2"], "role + search combine");
  assert.deepEqual(filterUsers(users, { query: "fan@" }).map((u) => u.id), ["3"], "email-only accounts are searchable");
});

test("stat counts match the web header badges", () => {
  const users = [
    { id: "1", role: "admin", is_verified: true },
    { id: "2", role: "moderator", disabled: true },
    { id: "3" },
    { id: "4", role: "user", is_verified: true, disabled: true },
  ];
  assert.deepEqual(userCounts(users), { total: 4, admin: 1, moderator: 1, verified: 2, disabled: 2 });
  assert.deepEqual(userRoleFilterCounts(users), { all: 4, admin: 1, moderator: 1, user: 2 });
  assert.deepEqual(userCounts([]), { total: 0, admin: 0, moderator: 0, verified: 0, disabled: 0 });
});

// ── Ban payload parity ───────────────────────────────────────────────────
test("ban common fields are byte-compatible with the web banUser mutation", () => {
  assert.deepEqual(buildBanCommonFields({ actorEmail: "admin@rlt.com", reason: "abuse", expiresAt: "2026-08-01T00:00:00.000Z" }), {
    reason: "abuse",
    banned_by: "admin@rlt.com",
    expires_at: "2026-08-01T00:00:00.000Z",
    is_active: true,
  });
  // Web defaults: reason falls back, banned_by/expires_at become "".
  assert.deepEqual(buildBanCommonFields({}), {
    reason: "Banned by admin",
    banned_by: "",
    expires_at: "",
    is_active: true,
  });
  // BanDialog passes expiresAt: null for permanent bans → "" like the web.
  assert.equal(buildBanCommonFields({ expiresAt: null }).expires_at, "");
});

test("banning always writes email + user records with lowercased values", () => {
  const records = buildBanRecords({ id: "USER_9", email: "Deb@RLT.com" });
  assert.deepEqual(records, [
    { ban_type: "email", value: "deb@rlt.com" },
    { ban_type: "user", value: "user_9" },
  ]);
  assert.equal(buildBanRecords({ id: "u1" })[0].value, "", "missing email still writes the record like the web (String(email||''))");
});

test("reinstating lifts only the active email/user bans (IP bans stay, web parity)", () => {
  const target = { id: "U1", email: "Deb@rlt.com" };
  const bans = [
    { id: "b1", ban_type: "email", value: "deb@rlt.com", is_active: true },
    { id: "b2", ban_type: "user", value: "u1", is_active: true },
    { id: "b3", ban_type: "ip", value: "1.2.3.4", is_active: true }, // never lifted
    { id: "b4", ban_type: "email", value: "deb@rlt.com", is_active: false }, // already inactive
    { id: "b5", ban_type: "email", value: "other@rlt.com", is_active: true }, // different account
  ];
  assert.deepEqual(relatedActiveBans(bans, target).map((b) => b.id), ["b1", "b2"]);
  assert.deepEqual(relatedActiveBans([], target), []);
});

test("self-guard: you can't act on your own account", () => {
  assert.equal(isSelfUser({ id: "u1" }, { id: "u1" }), true);
  assert.equal(isSelfUser({ id: "u1" }, { id: "u2" }), false);
  assert.equal(isSelfUser({ id: "u1" }, null), false);
  assert.equal(isSelfUser(null, { id: "u1" }), false);
});

// ── Source contracts: same authority, no new write paths ────────────────
test("native users workflow reads and writes only through the adminUsers edge function", () => {
  const src = read("../src/native/admin/workflows/NativeUsersWorkflow.jsx");
  assert.ok(src.includes('invoke("adminUsers", { action: "list" })'), "list goes through the edge function");
  assert.ok(src.includes('invoke("adminUsers", { action: "update", userId:'), "updates go through the edge function");
  assert.ok(!/entities\.User\./.test(src), "the User entity is never written or read directly");
  assert.ok(!src.includes("adminUsers\", { action: \"delete"), "no delete action is invented (web has none)");
});

test("ban/unban flows carry the exact web entity writes", () => {
  const src = read("../src/native/admin/workflows/NativeUsersWorkflow.jsx");
  assert.ok(src.includes("buildBanCommonFields"), "ban fields come from the shared parity builder");
  assert.ok(src.includes("buildBanRecords"), "email + user ban records via the shared builder");
  assert.ok(src.includes("Ban.create"), "ban records write through the Ban entity");
  assert.ok(src.includes('ForumPost.filter({ user_email: targetUser.email }, "-created_date", 1)'), "best-effort IP ban uses the same recent-post lookup");
  assert.ok(src.includes('ban_type: "ip", value: String(ip).toLowerCase()'), "IP ban record matches the web shape");
  assert.ok(src.includes("relatedActiveBans"), "reinstate deactivates the same related bans");
  assert.ok(src.includes("Ban.update(ban.id, { is_active: false })"), "reinstate deactivates rather than deletes");
  assert.ok(src.includes("Promise.allSettled"), "ban deactivation is best-effort like the web");
  assert.ok(src.includes("banUser.mutateAsync"), "BanDialog awaits settlement (pending guard is live)");
});

test("web query keys are reused so the cache stays shared with the web panels", () => {
  const src = read("../src/native/admin/workflows/NativeUsersWorkflow.jsx");
  assert.ok(src.includes('queryKey: ["users"]'), "users key shared");
  assert.ok(src.includes('queryKey: ["bans"]'), "bans key shared");
  assert.ok(src.includes('invalidateQueries({ queryKey: ["users"] })'), "mutations invalidate the users key");
  assert.ok(src.includes('invalidateQueries({ queryKey: ["bans"] })'), "ban/unban invalidate the bans key");
});

test("self-protection and confirmation UX match the web rules", () => {
  const src = read("../src/native/admin/workflows/NativeUsersWorkflow.jsx");
  assert.ok(src.includes("isSelfUser"), "self-guard helper used");
  assert.ok(src.includes("AdminConfirmSheet"), "state changes are confirmed");
  assert.ok(src.includes("BanDialog"), "bans reuse the shared web dialog (reason + expiry shape)");
  assert.ok(src.match(/disabled=\{isSelf/g)?.length >= 2, "self cannot change own role or access");
});

test("mobile-native hygiene: no hover-only affordances, no static capacitor imports", () => {
  const src = read("../src/native/admin/workflows/NativeUsersWorkflow.jsx");
  const helpers = read("../src/native/admin/workflows/users-helpers.js");
  for (const [name, s] of [["workflow", src], ["helpers", helpers]]) {
    assert.ok(!s.includes("group-hover:"), `${name} must not hide actions behind hover`);
    assert.ok(!/from ["']@capacitor/.test(s), `${name} must not statically import capacitor`);
  }
  assert.ok(src.includes("min-h-11"), "44pt touch targets");
  assert.ok(src.includes("restoreKey"), "windowed list restores scroll depth");
  assert.ok(src.includes("NativeSkeleton") && src.includes("NativeEmptyState"), "loading + empty states");
  assert.ok(src.includes("emitHaptic"), "haptics on primary/destructive actions");
});

test("edge-function failure shows the web's adminUsers deploy note (no silent blank)", () => {
  const src = read("../src/native/admin/workflows/NativeUsersWorkflow.jsx");
  assert.ok(src.includes("adminUsers</span> backend function"), "isError explains the adminUsers dependency");
  assert.ok(src.includes("retry: false"), "matches the web's non-retrying users query");
});

test("strict parity: users module emits no admin-log events (the web dispatches none)", () => {
  const src = read("../src/native/admin/workflows/NativeUsersWorkflow.jsx");
  const web = read("../src/components/admin/UsersManager.jsx");
  assert.ok(!web.includes("rlt_admin_log") && !web.includes("emitAdminLog"), "web UsersManager has no audit events");
  assert.ok(!src.includes("emitAdminLog"), "native mirrors that exactly — no invented audit trail");
});
