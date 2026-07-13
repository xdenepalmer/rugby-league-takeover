/**
 * Pure logic for the native Sponsors workflow. Mirrors the web SponsorManager
 * exactly — the localStorage store ("rlt_sponsors"), the empty-sponsor shape,
 * validation messages, tier ordering, sort options, the filter/search rule,
 * the contract-status derivation, the header stat counts, and the
 * create-vs-update array transform (the exact record the web writes on save).
 *
 * Sponsors are a localStorage-only module: the web SponsorManager holds the
 * array in React state and persists the WHOLE array to localStorage on every
 * change. There is NO entity and NO edge function, so the native workflow
 * mirrors the same localStorage key and the same record shapes byte-for-byte.
 *
 * Audit parity: the web SponsorManager dispatches NO rlt_admin_log events, so
 * the native workflow intentionally emits none either (same event set = ∅).
 *
 * These functions inject `now` where they stamp timestamps so tests can assert
 * the exact recorded payload without wall-clock flake.
 */

/** The single localStorage key the web SponsorManager reads/writes. */
export const LS_KEY = "rlt_sponsors";

/** Tier labels + ordering, mirrored from the web TIERS map + tierOrder. */
export const TIER_LABELS = { premium: "Premium", standard: "Standard", community: "Community" };
export const TIER_ORDER = { premium: 0, standard: 1, community: 2 };

/** Editor tier options, in the same order the web <select> renders. */
export const TIER_OPTIONS = [
  { value: "premium", label: "Premium" },
  { value: "standard", label: "Standard" },
  { value: "community", label: "Community" },
];

/** Sort options — same keys and labels as the web SORT_OPTIONS. */
export const SORT_OPTIONS = [
  { key: "name-asc", label: "Name A–Z" },
  { key: "name-desc", label: "Name Z–A" },
  { key: "tier", label: "Tier (Premium first)" },
  { key: "created-desc", label: "Newest first" },
  { key: "created-asc", label: "Oldest first" },
];

/**
 * Exact create-draft the web seeds (SponsorManager.emptySponsor). The id is
 * generated the same way (crypto.randomUUID) and created_at is stamped up
 * front — on create the web overwrites created_at again, which upsertSponsor
 * mirrors below.
 */
export function emptySponsor(now = new Date().toISOString()) {
  return {
    id: crypto.randomUUID(),
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
  };
}

/** Same validation the web runs on save. Returns an array of error strings. */
export function validateSponsor(s) {
  const errors = [];
  if (!s.company_name?.trim()) errors.push("Company name is required");
  if (s.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.contact_email)) errors.push("Invalid email format");
  if (s.website && !/^https?:\/\/.+/.test(s.website)) errors.push("Website must start with http:// or https://");
  if (s.contract_start && s.contract_end && s.contract_start > s.contract_end) errors.push("Contract end must be after start");
  if (s.total_spend < 0) errors.push("Total spend cannot be negative");
  return errors;
}

/** Save is allowed only when validation is clean (web shows errors otherwise). */
export function canSaveSponsor(s) {
  return validateSponsor(s).length === 0;
}

/** Total-spend coercion, mirroring the web input: parseFloat(value) || 0. */
export function toSpendField(value) {
  return parseFloat(value) || 0;
}

/**
 * The exact array transform SponsorManager.saveSponsor applies (already
 * validated). Update replaces the matched record with the edited record plus a
 * fresh updated_at; create appends the record with a fresh created_at (and no
 * updated_at) — byte-for-byte the web write. Pure + immutable.
 */
export function upsertSponsor(list, sponsor, now = new Date().toISOString()) {
  const arr = list || [];
  const idx = arr.findIndex((s) => s.id === sponsor.id);
  if (idx >= 0) {
    const copy = [...arr];
    copy[idx] = { ...sponsor, updated_at: now };
    return copy;
  }
  return [...arr, { ...sponsor, created_at: now }];
}

/** Remove-by-id, mirroring SponsorManager.deleteSponsor. */
export function removeSponsor(list, id) {
  return (list || []).filter((s) => s.id !== id);
}

/** Flip is_active for one id, mirroring SponsorManager.toggleActive. */
export function toggleActiveInList(list, id) {
  return (list || []).map((s) => (s.id === id ? { ...s, is_active: !s.is_active } : s));
}

/** True when this record already exists in the store (edit vs create copy). */
export function isExistingSponsor(list, id) {
  return (list || []).some((s) => s.id === id);
}

/**
 * Contract status derivation — identical branch logic to the web
 * getContractStatus. Returns { key, label, tone } or null. `tone` uses the
 * native border/bg/text idiom; `key` + `label` carry the same meaning as web.
 */
export function getContractStatus(sponsor, today = new Date()) {
  if (!sponsor.contract_start && !sponsor.contract_end) return null;
  const midnight = new Date(today);
  midnight.setHours(0, 0, 0, 0);
  if (sponsor.contract_end) {
    const end = new Date(sponsor.contract_end);
    end.setHours(0, 0, 0, 0);
    if (end < midnight) {
      return { key: "expired", label: "Expired", tone: "border-red-500/40 bg-red-500/10 text-red-300" };
    }
    const daysLeft = Math.ceil((end - midnight) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 30) {
      return { key: "expiring", label: `${daysLeft}d left`, tone: "border-amber-500/40 bg-amber-500/10 text-amber-300" };
    }
  }
  if (sponsor.contract_start) {
    const start = new Date(sponsor.contract_start);
    start.setHours(0, 0, 0, 0);
    if (start > midnight) {
      return { key: "upcoming", label: "Upcoming", tone: "border-sky-500/40 bg-sky-500/10 text-sky-300" };
    }
  }
  return { key: "active", label: "Active", tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };
}

/** Two-letter initials, mirroring the web getInitials. */
export function getInitials(name) {
  if (!name) return "??";
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** Localised date, mirroring the web formatDate ("—" for empty). */
export function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

/**
 * Active-ad count for a sponsor, mirroring the web getActiveAdCount. Pure:
 * the workflow reads the "rlt_ad_config" array from localStorage and passes it
 * in (the web reads it inline). Read-only — no write impact on ads.
 */
export function activeAdCount(ads, sponsorId) {
  return (ads || []).filter((a) => a.sponsor_id === sponsorId && a.is_active).length;
}

/** Search predicate — company_name/contact_name contains, like the web. */
export function filterSponsors(list, search = "") {
  const term = String(search || "").toLowerCase();
  return (list || []).filter(
    (s) =>
      (s.company_name || "").toLowerCase().includes(term) ||
      (s.contact_name || "").toLowerCase().includes(term)
  );
}

/** Sort by the given key — identical comparators to the web sortSponsors. */
export function sortSponsors(list, sortKey) {
  const copy = [...(list || [])];
  switch (sortKey) {
    case "name-asc":
      return copy.sort((a, b) => (a.company_name || "").localeCompare(b.company_name || ""));
    case "name-desc":
      return copy.sort((a, b) => (b.company_name || "").localeCompare(a.company_name || ""));
    case "tier":
      return copy.sort((a, b) => (TIER_ORDER[a.tier] ?? 1) - (TIER_ORDER[b.tier] ?? 1));
    case "created-desc":
      return copy.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    case "created-asc":
      return copy.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    default:
      return copy;
  }
}

/** Filter then sort — the exact visibleSponsors pipeline the web computes. */
export function visibleSponsors(list, { search = "", sortKey = "tier" } = {}) {
  return sortSponsors(filterSponsors(list, search), sortKey);
}

/**
 * Header stats — total/active/premium/expiring, mirroring the web math. An
 * "expiring" sponsor is one whose contract status label is "Expired" or ends
 * in "d left" (web: status.label.includes("d left") || label === "Expired").
 */
export function sponsorStats(list, today = new Date()) {
  const arr = list || [];
  return {
    total: arr.length,
    active: arr.filter((s) => s.is_active).length,
    premium: arr.filter((s) => s.tier === "premium").length,
    expiring: arr.filter((s) => {
      const status = getContractStatus(s, today);
      return status && (status.label.includes("d left") || status.label === "Expired");
    }).length,
  };
}
