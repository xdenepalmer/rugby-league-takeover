import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LS_KEY,
  TIER_LABELS,
  TIER_ORDER,
  TIER_OPTIONS,
  SORT_OPTIONS,
  emptySponsor,
  validateSponsor,
  canSaveSponsor,
  toSpendField,
  upsertSponsor,
  removeSponsor,
  toggleActiveInList,
  isExistingSponsor,
  getContractStatus,
  getInitials,
  formatDate,
  activeAdCount,
  filterSponsors,
  sortSponsors,
  visibleSponsors,
  sponsorStats,
} from "../src/native/admin/workflows/sponsors-helpers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

// ── Store + create-draft shape parity ────────────────────────────────────
test("sponsors live in the same localStorage key the web writes", () => {
  assert.equal(LS_KEY, "rlt_sponsors");
  const web = read("../src/components/admin/SponsorManager.jsx");
  assert.ok(web.includes('"rlt_sponsors"'), "web SponsorManager uses the rlt_sponsors key");
});

test("emptySponsor is byte-compatible with the web emptySponsor shape", () => {
  const now = "2026-07-13T00:00:00.000Z";
  const { id, ...rest } = emptySponsor(now);
  assert.equal(typeof id, "string");
  assert.ok(id.length > 0, "an id is generated up front (crypto.randomUUID)");
  assert.deepEqual(rest, {
    company_name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    website: "",
    logo_url: "",
    brand_color: "#f97316",
    notes: "",
    tier: "standard",
    total_spend: 0,
    contract_start: "",
    contract_end: "",
    is_active: true,
    created_at: now,
  });
  // Every field the native draft writes must exist in the web manager's source —
  // the native create can never invent a field the web doesn't write.
  const web = read("../src/components/admin/SponsorManager.jsx");
  for (const field of ["id", ...Object.keys(rest)]) {
    assert.ok(web.includes(field), `web SponsorManager writes ${field}`);
  }
});

// ── Validation parity (exact messages + regexes) ─────────────────────────
test("validation mirrors the web SponsorManager rules verbatim", () => {
  assert.deepEqual(validateSponsor(emptySponsor()), ["Company name is required"]);
  assert.deepEqual(validateSponsor({ company_name: "  " }), ["Company name is required"], "whitespace name is empty");
  assert.deepEqual(
    validateSponsor({ company_name: "Telstra", contact_email: "not-an-email" }),
    ["Invalid email format"]
  );
  assert.deepEqual(
    validateSponsor({ company_name: "Telstra", website: "telstra.com" }),
    ["Website must start with http:// or https://"]
  );
  assert.deepEqual(validateSponsor({ company_name: "T", website: "https://t.co" }), [], "valid website passes");
  assert.deepEqual(
    validateSponsor({ company_name: "T", contract_start: "2026-08-01", contract_end: "2026-07-01" }),
    ["Contract end must be after start"]
  );
  assert.deepEqual(validateSponsor({ company_name: "T", contract_start: "2026-07-01", contract_end: "2026-08-01" }), []);
  assert.deepEqual(validateSponsor({ company_name: "T", total_spend: -5 }), ["Total spend cannot be negative"]);
  assert.equal(canSaveSponsor(emptySponsor()), false, "empty draft can't be saved (no company)");
  assert.equal(canSaveSponsor({ company_name: "Telstra", total_spend: 0 }), true);
});

test("total spend coerces like the web input (parseFloat(value) || 0)", () => {
  assert.equal(toSpendField("2500"), 2500);
  assert.equal(toSpendField("2500.75"), 2500.75);
  assert.equal(toSpendField(""), 0);
  assert.equal(toSpendField("abc"), 0);
});

// ── Save transform: exact create/update record the web writes ─────────────
test("upsertSponsor appends on create and replaces on edit, matching the web", () => {
  const now = "2026-07-13T10:00:00.000Z";
  const draft = { ...emptySponsor("2026-01-01T00:00:00.000Z"), id: "a", company_name: "New Co" };
  const created = upsertSponsor([], draft, now);
  assert.equal(created.length, 1);
  // Create overwrites created_at with the save timestamp and adds NO updated_at.
  assert.equal(created[0].created_at, now, "create stamps a fresh created_at (web parity)");
  assert.ok(!("updated_at" in created[0]), "create writes no updated_at");

  const existing = [{ id: "a", company_name: "Old Co", tier: "standard", created_at: "2025-01-01T00:00:00.000Z" }];
  const edited = upsertSponsor(existing, { id: "a", company_name: "Renamed", tier: "premium", created_at: "2025-01-01T00:00:00.000Z" }, now);
  assert.equal(edited.length, 1, "edit replaces in place, no new row");
  assert.equal(edited[0].company_name, "Renamed");
  assert.equal(edited[0].updated_at, now, "edit stamps updated_at (web parity)");
  assert.equal(edited[0].created_at, "2025-01-01T00:00:00.000Z", "edit preserves created_at");
  assert.equal(existing[0].company_name, "Old Co", "source array untouched (immutable)");
});

test("removeSponsor and toggleActiveInList are immutable and id-scoped", () => {
  const list = [{ id: "a", is_active: true }, { id: "b", is_active: false }];
  assert.deepEqual(removeSponsor(list, "a").map((s) => s.id), ["b"]);
  assert.equal(list.length, 2, "remove leaves the source untouched");
  const toggled = toggleActiveInList(list, "a");
  assert.equal(toggled[0].is_active, false, "toggle flips the target");
  assert.equal(toggled[1].is_active, false, "toggle leaves others alone");
  assert.equal(list[0].is_active, true, "toggle leaves the source untouched");
  assert.equal(isExistingSponsor(list, "b"), true);
  assert.equal(isExistingSponsor(list, "zzz"), false);
});

// ── Search / sort / stats parity ─────────────────────────────────────────
test("filterSponsors matches company OR contact name, case-insensitively", () => {
  const list = [
    { id: "1", company_name: "Telstra", contact_name: "Jo" },
    { id: "2", company_name: "Optus", contact_name: "Sam Telford" },
    { id: "3", company_name: "Vodafone", contact_name: "Kim" },
  ];
  assert.deepEqual(filterSponsors(list, "tel").map((s) => s.id), ["1", "2"], "matches company and contact");
  assert.deepEqual(filterSponsors(list, "").map((s) => s.id), ["1", "2", "3"], "empty term keeps all");
});

test("sortSponsors comparators mirror the web sort keys", () => {
  const list = [
    { id: "1", company_name: "Bravo", tier: "community", created_at: "2026-02-01" },
    { id: "2", company_name: "Alpha", tier: "premium", created_at: "2026-01-01" },
    { id: "3", company_name: "Charlie", tier: "standard", created_at: "2026-03-01" },
  ];
  assert.deepEqual(sortSponsors(list, "name-asc").map((s) => s.company_name), ["Alpha", "Bravo", "Charlie"]);
  assert.deepEqual(sortSponsors(list, "name-desc").map((s) => s.company_name), ["Charlie", "Bravo", "Alpha"]);
  assert.deepEqual(sortSponsors(list, "tier").map((s) => s.tier), ["premium", "standard", "community"]);
  assert.deepEqual(sortSponsors(list, "created-desc").map((s) => s.id), ["3", "1", "2"]);
  assert.deepEqual(sortSponsors(list, "created-asc").map((s) => s.id), ["2", "1", "3"]);
  assert.equal(list[0].id, "1", "sort is immutable (source order preserved)");
  assert.equal(TIER_ORDER.premium, 0);
  assert.deepEqual(SORT_OPTIONS.map((o) => o.key), ["name-asc", "name-desc", "tier", "created-desc", "created-asc"]);
  assert.deepEqual(TIER_OPTIONS.map((o) => o.value), ["premium", "standard", "community"]);
  assert.equal(TIER_LABELS.premium, "Premium");
});

test("visibleSponsors filters then sorts, like the web pipeline", () => {
  const list = [
    { id: "1", company_name: "Telstra", tier: "community", created_at: "2026-02-01" },
    { id: "2", company_name: "Telcom", tier: "premium", created_at: "2026-01-01" },
    { id: "3", company_name: "Vodafone", tier: "standard", created_at: "2026-03-01" },
  ];
  assert.deepEqual(visibleSponsors(list, { search: "tel", sortKey: "tier" }).map((s) => s.id), ["2", "1"]);
});

test("sponsorStats mirrors the web header counts (total/active/premium/expiring)", () => {
  const today = new Date("2026-07-13T12:00:00.000Z");
  const list = [
    { id: "1", is_active: true, tier: "premium", contract_end: "2026-07-20" }, // active, premium, 7d left → expiring
    { id: "2", is_active: true, tier: "standard", contract_end: "2026-01-01" }, // active, expired → expiring
    { id: "3", is_active: false, tier: "premium" }, // inactive premium, no contract
    { id: "4", is_active: true, tier: "community", contract_end: "2027-01-01" }, // active, far future → not expiring
  ];
  assert.deepEqual(sponsorStats(list, today), { total: 4, active: 3, premium: 2, expiring: 2 });
  assert.deepEqual(sponsorStats([], today), { total: 0, active: 0, premium: 0, expiring: 0 });
});

// ── Contract status derivation ───────────────────────────────────────────
test("getContractStatus mirrors the web branch logic", () => {
  const today = new Date("2026-07-13T09:00:00.000Z");
  assert.equal(getContractStatus({}, today), null, "no dates → null");
  assert.equal(getContractStatus({ contract_end: "2026-01-01" }, today).label, "Expired");
  assert.equal(getContractStatus({ contract_end: "2026-07-20" }, today).label, "7d left", "≤30 days out → Nd left");
  assert.equal(getContractStatus({ contract_end: "2027-01-01" }, today).label, "Active", ">30 days out is not expiring");
  assert.equal(getContractStatus({ contract_start: "2026-12-01" }, today).label, "Upcoming", "future start → Upcoming");
  assert.equal(getContractStatus({ contract_start: "2026-01-01", contract_end: "2027-01-01" }, today).label, "Active");
});

test("getInitials and formatDate mirror the web helpers", () => {
  assert.equal(getInitials("Telstra Corp"), "TC");
  assert.equal(getInitials("Optus"), "O");
  assert.equal(getInitials(""), "??");
  assert.equal(formatDate(""), "—", "empty date renders an em dash");
  assert.equal(formatDate(null), "—");
});

test("activeAdCount counts a sponsor's active ads (read-only, web parity)", () => {
  const ads = [
    { sponsor_id: "a", is_active: true },
    { sponsor_id: "a", is_active: false },
    { sponsor_id: "a", is_active: true },
    { sponsor_id: "b", is_active: true },
  ];
  assert.equal(activeAdCount(ads, "a"), 2);
  assert.equal(activeAdCount(ads, "b"), 1);
  assert.equal(activeAdCount(ads, "c"), 0);
  assert.equal(activeAdCount(null, "a"), 0);
});

// ── Source contracts: storage, cache and UX parity ───────────────────────
test("native sponsors workflow persists to the same localStorage key (no entities, no edge fns)", () => {
  const native = read("../src/native/admin/workflows/NativeSponsorsWorkflow.jsx");
  assert.ok(native.includes("localStorage.setItem(LS_KEY"), "writes the sponsors array to localStorage");
  assert.ok(native.includes('queryKey: SPONSORS_KEY') || native.includes('["sponsors"]'), "caches over a native ['sponsors'] key");
  assert.ok(native.includes("invalidateQueries({ queryKey: SPONSORS_KEY })"), "invalidates the native cache after writes");
  assert.ok(!native.includes("base44.entities"), "sponsors are localStorage-only — no entity writes");
  assert.ok(!native.includes("functions.invoke"), "sponsors call no edge functions (web parity)");
});

test("logo uploads reuse the exact client call the web ImageField uses", () => {
  const native = read("../src/native/admin/workflows/NativeSponsorsWorkflow.jsx");
  const webField = read("../src/components/admin/ImageField.jsx");
  assert.ok(webField.includes("base44.integrations.Core.UploadFile({ file })"), "web upload mechanism unchanged");
  assert.ok(native.includes("base44.integrations.Core.UploadFile({ file })"), "native uploads through the same call");
});

test("no invented audit events: the web SponsorManager dispatches none", () => {
  const web = read("../src/components/admin/SponsorManager.jsx");
  const native = read("../src/native/admin/workflows/NativeSponsorsWorkflow.jsx");
  assert.ok(!web.includes("rlt_admin_log") && !web.includes("emitAdminLog"), "web dispatches no sponsor audit events");
  assert.ok(
    !native.includes("emitAdminLog") && !native.includes("rlt_admin_log") && !native.includes("dispatchEvent"),
    "native matches: same (empty) event set"
  );
});

test("destructive delete is confirmed and dialogs await via mutateAsync", () => {
  const native = read("../src/native/admin/workflows/NativeSponsorsWorkflow.jsx");
  assert.ok(native.includes("AdminConfirmSheet"), "delete goes through the confirm sheet");
  assert.ok(native.includes("Delete this sponsor?"), "confirm sheet has a delete title");
  assert.ok(native.includes("deleteMutation.mutateAsync"), "delete sheet awaits settlement");
  assert.ok(native.includes("saveMutation.mutateAsync"), "save awaits settlement");
});

test("toast copy matches the web manager verbatim", () => {
  const native = read("../src/native/admin/workflows/NativeSponsorsWorkflow.jsx");
  for (const title of ["Sponsor saved", "Sponsor removed", "Validation Error", "Email copied"]) {
    assert.ok(native.includes(`"${title}"`), `native keeps the web toast: ${title}`);
  }
  assert.ok(native.includes('has been saved.'), "save toast keeps the web description shape");
});

test("native sponsors UX contracts: windowing, haptics, no hover-only affordances", () => {
  const native = read("../src/native/admin/workflows/NativeSponsorsWorkflow.jsx");
  assert.ok(native.includes("useWindowedList"), "long lists are windowed");
  assert.ok(native.includes('restoreKey: "admin-sponsors"'), "window depth survives remounts for scroll restore");
  assert.ok(native.includes("emitHaptic"), "haptics on primary actions");
  for (const event of ["tab.select", "action.primary", "mutation.warning", "save.success", "mutation.error"]) {
    assert.ok(native.includes(`"${event}"`), `haptic event ${event} used`);
  }
  assert.ok(!native.includes("group-hover:"), "no hover-only affordances");
  assert.ok(!/from ["']@capacitor/.test(native), "no static @capacitor imports");
  assert.ok(native.includes("NativeEmptyState") && native.includes("NativeSkeleton"), "empty + loading states");
  assert.ok(native.includes("PullToRefresh"), "pull to refresh the sponsors cache");
  assert.ok(native.includes("canSaveSponsor") || native.includes("validateSponsor"), "save gated by the shared validation rule");
});
