// Canonical parcel-size rules. Mirrored into supabase/functions/*/index.ts —
// keep the two in sync (the tests here are the source of truth).
//
// AusPost's service.json lists every domestic product that fits the declared
// dimensions: the two calculated services (Parcel Post / Express Post, priced on
// real weight) plus every flat-rate satchel and box at or above that size. Handing
// all of them to the shopper meant a t-shirt showed a "Large $25.20" alongside the
// correct "$11.70", with duplicate-looking rows because the satchel and box ranges
// reuse the same size words.

export const PARCEL_SIZES = ["satchel", "small", "medium", "large"];
export const DEFAULT_PARCEL_SIZE = "satchel";

// Ascending capacity. A cart may use any packaging up to its largest item's size.
const RANK = new Map(PARCEL_SIZES.map((size, i) => [size, i]));

export function normalizeParcelSize(value) {
  const size = String(value ?? "").trim().toLowerCase();
  return RANK.has(size) ? size : DEFAULT_PARCEL_SIZE;
}

/** The smallest packaging that fits every item in the cart. */
export function requiredParcelSize(products) {
  let best = DEFAULT_PARCEL_SIZE;
  for (const product of products || []) {
    const size = normalizeParcelSize(product?.parcel_size);
    if (RANK.get(size) > RANK.get(best)) best = size;
  }
  return best;
}

// AusPost names packaging on two axes: a range (satchel or box) and a size
// qualifier (small/medium/large). The qualifier is what determines capacity — a
// "Medium satchel" holds more than a plain satchel and is priced accordingly — so
// the qualifier is checked first and a bare "satchel" is only the fallback.
// Ordered largest-first so "extra large" is never matched as "large".
const SIZE_WORDS = [
  ["extra large", "large"],
  ["extralarge", "large"],
  ["large", "large"],
  ["medium", "medium"],
  ["small", "small"],
  ["satchel", "satchel"], // unqualified satchel — the baseline flat rate
];

/**
 * The packaging size a service implies, or null when it is priced on the parcel's
 * actual weight and dimensions (Parcel Post / Express Post). Those are always
 * honest for the real parcel, so they are never filtered out.
 */
export function serviceParcelSize(service) {
  const haystack = `${service?.code ?? ""} ${service?.name ?? ""}`.toLowerCase();
  for (const [word, size] of SIZE_WORDS) {
    if (haystack.includes(word)) return size;
  }
  return null;
}

/**
 * Drop flat-rate options bigger than the cart needs. Calculated services survive
 * untouched, so there is always something to pick even if nothing matches.
 */
export function allowedServices(services, required) {
  const ceiling = RANK.get(normalizeParcelSize(required));
  return (services || []).filter((service) => {
    const size = serviceParcelSize(service);
    if (size === null) return true; // weight-priced — always legitimate
    return RANK.get(size) <= ceiling;
  });
}

/** True when `code` is one the server would have offered for this cart. */
export function isServiceAllowed(code, services, required) {
  const wanted = String(code ?? "").trim();
  if (!wanted) return false;
  return allowedServices(services, required).some((s) => String(s.code) === wanted);
}
