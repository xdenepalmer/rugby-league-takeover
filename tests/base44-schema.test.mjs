import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const readSchema = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));

test("schemas keep metadata fields used by account and moderation flows", () => {
  const forum = readSchema("../base44/entities/ForumPost.jsonc");
  const registration = readSchema("../base44/entities/InterestRegistration.jsonc");
  const order = readSchema("../base44/entities/StoreOrder.jsonc");

  for (const field of ["user_email", "user_id", "ip_address"]) {
    assert.ok(forum.properties[field], `ForumPost is missing ${field}`);
  }

  for (const field of ["user_email", "user_id", "ip_address", "trip_details"]) {
    assert.ok(registration.properties[field], `InterestRegistration is missing ${field}`);
  }

  for (const field of ["user_email", "user_id"]) {
    assert.ok(order.properties[field], `StoreOrder is missing ${field}`);
  }
});
