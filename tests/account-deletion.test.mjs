import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public and in-app account deletion routes are present", async () => {
  const [app, page, security] = await Promise.all([
    read("src/App.jsx"),
    read("src/pages/DeleteAccount.jsx"),
    read("src/components/account/SecurityTab.jsx"),
  ]);
  assert.match(app, /path="\/delete-account"/);
  assert.match(page, /functions\.invoke\("deleteAccount"/);
  assert.match(page, /confirmation !== "DELETE"/);
  assert.match(page, /support@rugbyleaguetakeover\.com/);
  assert.match(security, /to="\/delete-account"/);
});

test("account deletion backend authenticates, safeguards admins, and cleans user data", async () => {
  const [edge, migration] = await Promise.all([
    read("supabase/functions/deleteAccount/index.ts"),
    read("supabase/migrations/0011_account_deletion.sql"),
  ]);
  assert.match(edge, /auth\.getUser\(token\)/);
  assert.match(edge, /confirmation !== 'DELETE'/);
  assert.match(edge, /delete_account_data/);
  assert.match(edge, /storage\.from\('media'\)\.remove/);
  assert.match(edge, /auth\.admin\.deleteUser/);
  assert.match(migration, /v_profile\.role = 'admin'/);
  assert.match(migration, /delete from public\.user_push_tokens/);
  assert.match(migration, /update public\.store_orders/);
  assert.match(migration, /grant execute on function public\.delete_account_data\(uuid\) to service_role/);
});
