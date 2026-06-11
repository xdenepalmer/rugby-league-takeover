import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shellFiles = [
  "../src/components/AuthLayout.jsx",
  "../src/components/admin/AdminLayout.jsx",
  "../src/components/public/HeroSection.jsx",
  "../src/components/public/PublicLayout.jsx",
  "../src/pages/Account.jsx",
  "../src/pages/Forum.jsx",
  "../src/pages/Home.jsx",
  "../src/pages/Store.jsx",
];

test("top-level app shells use dynamic viewport height for mobile browsers", () => {
  for (const file of shellFiles) {
    const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
    assert.ok(!source.includes("min-h-screen"), `${file} should use min-h-dvh instead of min-h-screen`);
    assert.ok(source.includes("min-h-dvh"), `${file} should opt into dynamic viewport height`);
  }
});
