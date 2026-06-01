import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cssPath = new URL("../src/index.css", import.meta.url);

test("global CSS exposes native-feeling iOS mobile primitives", () => {
  const css = fs.readFileSync(cssPath, "utf8");

  for (const token of [
    ".ios-tabbar",
    ".ios-tabbar-item",
    ".ios-sheet",
    ".ios-pressable",
    ".ios-scroll",
    ".ios-keyboard-spacer",
  ]) {
    assert.ok(css.includes(token), `missing ${token}`);
  }

  assert.match(css, /-webkit-tap-highlight-color:\s*transparent/);
  assert.match(css, /-webkit-overflow-scrolling:\s*touch/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(css, /padding-bottom:\s*max\(.*var\(--safe-bottom\)/s);
});
