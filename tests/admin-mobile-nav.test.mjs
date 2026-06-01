import test from "node:test";
import assert from "node:assert/strict";

import {
  getActiveMobileAdminTab,
  getAdminSectionLabel,
  mobileMoreAdminItems,
  mobilePrimaryAdminTabs,
} from "../src/lib/admin-mobile-nav.js";

test("mobile admin tab bar keeps one-handed primary actions to five slots", () => {
  assert.deepEqual(
    mobilePrimaryAdminTabs.map((item) => item.label),
    ["Overview", "Content", "Store", "Community", "More"]
  );
  assert.equal(mobilePrimaryAdminTabs.length, 5);
  assert.equal(mobilePrimaryAdminTabs.at(-1).kind, "more");
});

test("mobile admin more sheet keeps management destinations reachable", () => {
  const labels = mobileMoreAdminItems.map((item) => item.label);

  assert.ok(labels.includes("Events"), "events management must stay reachable on phone");
  assert.ok(labels.includes("People"), "people management must stay reachable on phone");
  assert.ok(labels.includes("Settings"), "settings management must stay reachable on phone");
  assert.ok(labels.includes("View Site"), "site preview action must stay reachable on phone");
  assert.ok(labels.includes("Export Data"), "export action must stay reachable on phone");
});

test("mobile admin active tab groups secondary routes under More", () => {
  assert.equal(getActiveMobileAdminTab("/admin/store"), "Store");
  assert.equal(getActiveMobileAdminTab("/admin/community"), "Community");
  assert.equal(getActiveMobileAdminTab("/admin/events"), "More");
  assert.equal(getActiveMobileAdminTab("/admin/people"), "More");
  assert.equal(getActiveMobileAdminTab("/admin/settings"), "More");
});

test("admin section labels remain specific even when active tab is More", () => {
  assert.equal(getAdminSectionLabel("/admin/events"), "Events");
  assert.equal(getAdminSectionLabel("/admin/people"), "People");
  assert.equal(getAdminSectionLabel("/admin/settings"), "Settings");
  assert.equal(getAdminSectionLabel("/admin/unknown"), "Dashboard");
});
