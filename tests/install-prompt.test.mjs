import test from "node:test";
import assert from "node:assert/strict";

import {
  getInstallPromptMode,
  shouldShowInstallNudge,
} from "../src/lib/install-prompt.js";

test("install prompt chooses iOS guidance for mobile Safari outside standalone", () => {
  const mode = getInstallPromptMode({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    displayModeStandalone: false,
    navigatorStandalone: false,
    hasBeforeInstallPrompt: false,
  });

  assert.equal(mode, "ios");
});

test("install prompt hides inside an already installed app shell", () => {
  assert.equal(getInstallPromptMode({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    displayModeStandalone: true,
    navigatorStandalone: false,
    hasBeforeInstallPrompt: true,
  }), "hidden");

  assert.equal(getInstallPromptMode({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    displayModeStandalone: false,
    navigatorStandalone: true,
    hasBeforeInstallPrompt: true,
  }), "hidden");
});

test("install nudge respects dismissal cool-down", () => {
  const now = Date.UTC(2026, 5, 1);

  assert.equal(shouldShowInstallNudge({ dismissedAt: null, now }), true);
  assert.equal(shouldShowInstallNudge({ dismissedAt: now - 2 * 86400000, now }), false);
  assert.equal(shouldShowInstallNudge({ dismissedAt: now - 15 * 86400000, now }), true);
});
