import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const adminDir = fileURLToPath(new URL("../src/components/admin/", import.meta.url));

function adminSources() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".jsx")) files.push(full);
    }
  };
  walk(adminDir);
  return files;
}

// A bare `grid` has auto-sized columns, and grid items default to
// min-width:auto — so a single wide child (a nowrap pill row, a long token)
// refuses to shrink and widens the WHOLE admin page on a phone, dragging the
// sticky header sideways with it. Tailwind's grid-cols-N compiles to
// repeat(N, minmax(0,1fr)); the minmax(0,…) is what allows shrinking.
test("admin grids declare a mobile column track so they can shrink", () => {
  const offenders = [];
  for (const file of adminSources()) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/className="grid ([^"]*)"/g)) {
      const classes = match[1];
      if (!/(^|\s)grid-cols-/.test(classes)) {
        offenders.push(`${path.basename(file)}: "grid ${classes}"`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `admin grids missing an unprefixed grid-cols-* (causes horizontal overflow on mobile):\n${offenders.join("\n")}`,
  );
});

// `flex-1 overflow-x-auto` only scrolls if the flex item may shrink. Without
// min-w-0 it is sized by its min-w-max child and pushes the page wide instead.
test("admin filter pills scroll inside themselves rather than widening the page", () => {
  const source = fs.readFileSync(path.join(adminDir, "shared/AdminFilterBar.jsx"), "utf8");
  const scroller = source.match(/className="[^"]*flex-1[^"]*overflow-x-auto[^"]*"/);
  assert.ok(scroller, "AdminFilterBar should keep its horizontal pill scroller");
  assert.ok(
    scroller[0].includes("min-w-0"),
    "the flex-1 overflow-x-auto scroller needs min-w-0, or its min-w-max child widens the admin page",
  );
});
