/**
 * Pure logic for the native Travel Packages workflow. Mirrors the web
 * TravelPackagesManager's rules — draft shape, payload field set, the
 * create guard, the "coming soon" default — so the native screens write
 * payload-parity creates/updates through the same TravelPackage entity.
 * No admin-log events: the web manager dispatches none for this module.
 */

/** Exact create-draft shape the web manager seeds (emptyPackage). */
export const EMPTY_TRAVEL_PACKAGE = Object.freeze({
  name: "",
  description: "",
  image_url: "",
  booking_url: "",
  booking_label: "",
  is_coming_soon: true,
  sort_order: 1,
});

/** The complete field set the web manager ever writes on a TravelPackage. */
export const TRAVEL_PACKAGE_FIELDS = Object.freeze([
  "name",
  "description",
  "image_url",
  "booking_url",
  "booking_label",
  "is_coming_soon",
  "sort_order",
]);

/**
 * Edit-draft seeding — same defaults the web PackageCard uses, including
 * the `is_coming_soon !== false` truthiness (unset counts as coming soon).
 */
export function buildPackageDraft(pkg) {
  const p = pkg || {};
  return {
    name: p.name || "",
    description: p.description || "",
    sort_order: p.sort_order || 1,
    image_url: p.image_url || "",
    booking_url: p.booking_url || "",
    booking_label: p.booking_label || "",
    is_coming_soon: p.is_coming_soon !== false,
  };
}

/**
 * Restrict a draft to exactly the fields the web manager writes — nothing
 * invented, nothing extra (no id, no client-side timestamps). sort_order is
 * coerced with Number() the same way the web inputs coerce on change.
 */
export function buildPackagePayload(draft) {
  const d = draft || {};
  return {
    name: d.name || "",
    description: d.description || "",
    image_url: d.image_url || "",
    booking_url: d.booking_url || "",
    booking_label: d.booking_label || "",
    is_coming_soon: d.is_coming_soon !== false,
    sort_order: Number(d.sort_order) || 1,
  };
}

/** Web parity: the create button is disabled until a name is entered. */
export function canCreatePackage(draft) {
  return !!(draft && draft.name);
}

/**
 * Client-side search over the loaded list (native affordance for long
 * lists — read-only, never changes what gets written).
 */
export function filterPackages(packages, query = "") {
  const q = String(query).trim().toLowerCase();
  if (!q) return packages || [];
  return (packages || []).filter((pkg) =>
    `${pkg.name || ""} ${pkg.description || ""} ${pkg.booking_label || ""}`
      .toLowerCase()
      .includes(q)
  );
}

/** Availability badge — same rule the web card renders. */
export function packageStatusMeta(pkg) {
  return pkg?.is_coming_soon !== false
    ? { key: "coming_soon", label: "Coming Soon", tone: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300" }
    : { key: "available", label: "Available", tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };
}

/** Same 100-char description preview the web card shows. */
export function descriptionPreview(text, limit = 100) {
  const value = text || "";
  return value.length > limit ? value.slice(0, limit) + "…" : value;
}
