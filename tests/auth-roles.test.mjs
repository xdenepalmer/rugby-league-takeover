import test from "node:test";
import assert from "node:assert/strict";

import { hasAdminRole } from "../src/lib/auth-roles.js";

test("detects admin users across common role shapes", () => {
  assert.equal(hasAdminRole({ role: "admin" }), true);
  assert.equal(hasAdminRole({ role: "Admin" }), true);
  assert.equal(hasAdminRole({ roles: ["member", "admin"] }), true);
  assert.equal(hasAdminRole({ is_admin: true }), true);
});

test("does not grant admin access to non-admin users", () => {
  assert.equal(hasAdminRole({ role: "user" }), false);
  assert.equal(hasAdminRole({ roles: ["member"] }), false);
  assert.equal(hasAdminRole({}), false);
  assert.equal(hasAdminRole(null), false);
});
