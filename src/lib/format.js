// Display formatters shared by the store, account and admin surfaces.
// Money is AUD everywhere in this app; `formatAud` groups thousands (used by the
// admin revenue panels) while `formatAudFixed` keeps the plain two-decimal form
// used on order lines and product prices.
export const AUD_LOCALE = "en-AU";

const TWO_DECIMALS = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

export function toAmount(value) {
  return Number(value || 0);
}

export function formatAmount(value) {
  return toAmount(value).toLocaleString(AUD_LOCALE, TWO_DECIMALS);
}

export function formatAmountFixed(value) {
  return toAmount(value).toFixed(2);
}

export function formatAud(value) {
  return `$${formatAmount(value)}`;
}

export function formatAudFixed(value) {
  return `$${formatAmountFixed(value)}`;
}

export function formatCount(value) {
  return toAmount(value).toLocaleString(AUD_LOCALE);
}
