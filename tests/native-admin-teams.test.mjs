import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normTeamName,
  parseBulkLogos,
  rosterCustomTeams,
  matchBulkRows,
  TEAM_GROUPS,
  teamRoster,
  filterTeamRoster,
  buildLogoWrite,
  buildCustomTeamPayload,
} from "../src/native/admin/workflows/teams-helpers.js";
import { ALL_TEAMS } from "../src/lib/nrl-teams.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Bulk import parsing mirrors the web TeamsManager.parseBulk ───────────
test("bulk lines parse with =, |, comma and tab separators", () => {
  const rows = parseBulkLogos(
    [
      "Penrith Panthers = https://cdn.x/penrith.png",
      "Melbourne Storm|https://cdn.x/storm.png",
      "Wigan Warriors, https://cdn.x/wigan.png",
      "Leeds Rhinos\thttps://cdn.x/leeds.png",
    ].join("\n")
  );
  assert.deepEqual(rows.map((r) => r.name), ["Penrith Panthers", "Melbourne Storm", "Wigan Warriors", "Leeds Rhinos"]);
  assert.ok(rows.every((r) => r.url.startsWith("https://cdn.x/")));
});

test("bulk parsing drops blank lines, bad urls and separator-less lines", () => {
  const rows = parseBulkLogos(
    ["", "   ", "just a club name", "Storm = notaurl", "Storm = ftp://cdn.x/storm.png", "Storm = https://ok.x/s.png"].join("\n")
  );
  assert.equal(rows.length, 1, "only the http(s) row survives");
  assert.deepEqual(rows[0], { name: "Storm", url: "https://ok.x/s.png" });
  assert.deepEqual(parseBulkLogos(null), [], "null-safe");
});

test("bulk rows match known clubs case-insensitively, including custom DB teams", () => {
  const teams = [{ id: "t1", name: "Vegas Invitational" }];
  const rows = matchBulkRows(
    [
      { name: "penrith PANTHERS", url: "https://x/p.png" },
      { name: "vegas invitational", url: "https://x/v.png" },
      { name: "Unknown Club", url: "https://x/u.png" },
    ],
    teams
  );
  assert.equal(rows[0].team.name, "Penrith Panthers", "roster match is case-insensitive");
  assert.equal(rows[1].team.name, "Vegas Invitational", "custom DB teams are known clubs too");
  assert.equal(rows[2].team, undefined, "unknown clubs stay unmatched (and get skipped)");
});

// ── Payload parity with the web setLogo / addCustom / applyBulk writes ───
test("logo write updates the existing Team with logo_url only", () => {
  const write = buildLogoWrite({ id: "abc" }, { name: "Melbourne Storm", short_name: "Storm" }, "https://x/s.png");
  assert.deepEqual(write, { op: "update", id: "abc", data: { logo_url: "https://x/s.png" } });
});

test("logo write creates missing clubs with the web's exact field set", () => {
  const write = buildLogoWrite(null, { name: "Melbourne Storm", short_name: "Storm" }, "https://x/s.png");
  assert.equal(write.op, "create");
  assert.deepEqual(write.data, {
    name: "Melbourne Storm",
    short_name: "Storm",
    logo_url: "https://x/s.png",
    is_active: true,
    sort_order: 1,
  });
  const noShort = buildLogoWrite(null, { name: "Dolphins" }, "https://x/d.png");
  assert.equal(noShort.data.short_name, "Dolphins", "short_name falls back to name (web parity)");
});

test("custom team create payload matches the web addCustom mutation", () => {
  assert.deepEqual(buildCustomTeamPayload("Vegas Invitational"), {
    name: "Vegas Invitational",
    short_name: "Vegas Invitational",
    logo_url: "",
    is_active: true,
    sort_order: 1,
  });
});

// ── Roster + grouping mirror the web's NRL / Super League / Custom view ──
test("roster carries every built-in club plus flagged custom DB teams", () => {
  const teams = [
    { id: "t1", name: "Melbourne Storm", logo_url: "https://x/s.png" },
    { id: "t2", name: "Vegas Invitational" },
  ];
  const roster = teamRoster(teams);
  assert.equal(roster.length, ALL_TEAMS.length + 1);
  const storm = roster.find((t) => t.name === "Melbourne Storm");
  assert.equal(storm.custom, false, "roster clubs are never custom");
  assert.equal(storm.db.id, "t1", "DB record attached for logo + lookups");
  const vegas = roster.find((t) => t.name === "Vegas Invitational");
  assert.equal(vegas.custom, true, "non-roster DB teams are custom (deletable)");
  assert.equal(vegas.league, "Custom");
  assert.deepEqual(rosterCustomTeams(teams).map((t) => t.id), ["t2"]);
  assert.equal(normTeamName("  Melbourne STORM "), "melbourne storm");
});

test("group chips and search filter the roster like the web groupings", () => {
  const roster = teamRoster([{ id: "t2", name: "Vegas Invitational" }]);
  assert.deepEqual(TEAM_GROUPS.map((g) => g.key), ["all", "nrl", "super", "custom"]);
  assert.equal(filterTeamRoster(roster, { group: "all" }).length, roster.length);
  assert.ok(filterTeamRoster(roster, { group: "nrl" }).every((t) => t.league === "NRL"));
  assert.ok(filterTeamRoster(roster, { group: "super" }).every((t) => t.league === "Super League"));
  assert.deepEqual(filterTeamRoster(roster, { group: "custom" }).map((t) => t.name), ["Vegas Invitational"]);
  assert.deepEqual(filterTeamRoster(roster, { query: "storm" }).map((t) => t.name), ["Melbourne Storm"]);
  assert.ok(filterTeamRoster(roster, { query: "sea eagles" }).length === 1, "nickname search works");
  assert.equal(filterTeamRoster(roster, { query: "storm", group: "super" }).length, 0);
});

// ── Source contracts: writes, authority and native UX rules ──────────────
test("native teams workflow writes through the same entity as the web manager", () => {
  const src = read("../src/native/admin/workflows/NativeTeamsWorkflow.jsx");
  assert.ok(src.includes("base44.entities.Team.update"), "crest updates go through Team.update");
  assert.ok(src.includes("base44.entities.Team.create"), "new clubs go through Team.create");
  assert.ok(src.includes("base44.entities.Team.delete"), "custom removal goes through Team.delete");
  assert.ok(src.includes('Team.list("sort_order", 100)'), "same fetch shape as the web panel wiring");
  assert.ok(src.includes('queryKey: ["teams"]'), "same query key — cache shared with web panels");
  assert.ok(src.includes('invalidateQueries({ queryKey: ["teams"] })'), "same invalidation the web performs");
  assert.ok(!src.includes("functions.invoke"), "teams has no edge functions on the web — none invented");
});

test("payload builders are the single write path (no inline drift)", () => {
  const src = read("../src/native/admin/workflows/NativeTeamsWorkflow.jsx");
  assert.ok(src.includes("buildLogoWrite"), "logo writes flow through the shared builder");
  assert.ok(src.includes("buildCustomTeamPayload"), "custom create flows through the shared builder");
  assert.ok(src.includes("matchBulkRows") && src.includes("parseBulkLogos"), "bulk import reuses the parsed/matched helpers");
  assert.ok(!src.includes("rlt_admin_log") && !src.includes("emitAdminLog"), "web TeamsManager emits no admin-log events — native must not invent any");
});

test("crest uploads reuse the exact web control (Core.UploadFile via ImageField)", () => {
  const src = read("../src/native/admin/workflows/NativeTeamsWorkflow.jsx");
  assert.ok(src.includes('import ImageField from "@/components/admin/ImageField"'), "same upload control as the web manager");
  const imageField = read("../src/components/admin/ImageField.jsx");
  assert.ok(imageField.includes("base44.integrations.Core.UploadFile"), "ImageField still uploads through the base44 client");
});

test("native teams UX follows the house rules", () => {
  const src = read("../src/native/admin/workflows/NativeTeamsWorkflow.jsx");
  assert.ok(src.includes("AdminConfirmSheet"), "destructive delete is confirmed");
  assert.ok(src.includes("MobileActionDrawer"), "forms live in drawers");
  assert.ok(src.includes("mutateAsync"), "awaiting drawers use mutateAsync");
  assert.ok(src.includes("useWindowedList") && src.includes('restoreKey: "admin-teams"'), "30+ club roster is windowed with scroll restore");
  assert.ok(src.includes("NativeEmptyState") && src.includes("NativeSkeleton"), "loading + empty states");
  assert.ok(src.includes("NativeTopBar"), "self-chromed");
  assert.ok(src.includes('fallback="/admin/events"'), "top bar falls back to the events hub");
  assert.ok(src.includes("PullToRefresh"), "pull to refresh on the list");
  assert.ok(!src.includes("group-hover:"), "no hover-only affordances");
  assert.ok(!/from ["']@capacitor/.test(src), "no static @capacitor imports");
  for (const event of ["tab.select", "action.primary", "mutation.warning", "save.success", "mutation.error"]) {
    assert.ok(src.includes(`"${event}"`), `emits ${event} haptics`);
  }
});

test("detail screen is URL-addressable and export names are stable", () => {
  const src = read("../src/native/admin/workflows/NativeTeamsWorkflow.jsx");
  assert.ok(src.includes("export default function NativeTeamsList"), "default export is the list screen");
  assert.ok(src.includes("export function NativeTeamDetail"), "named detail export for the route");
  assert.ok(src.includes("useParams"), "detail resolves the club from the URL");
  assert.ok(src.includes("/admin/events/teams/${encodeURIComponent("), "list rows deep-link to the detail route");
});
