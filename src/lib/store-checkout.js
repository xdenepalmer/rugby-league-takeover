export const CHECKOUT_REQUEST_ID_STORAGE_KEY = "rlt_checkout_request_id";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCheckoutRequestId(value) {
  return UUID_PATTERN.test(String(value || ""));
}

function fallbackUuid() {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createCheckoutRequestId(cryptoImpl = globalThis.crypto) {
  const nativeUuid = cryptoImpl?.randomUUID?.();
  if (isCheckoutRequestId(nativeUuid)) return nativeUuid.toLowerCase();

  if (cryptoImpl?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoImpl.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Very old WebViews may expose neither method. The ID is an idempotency
  // token, not an authentication secret, so a standards-shaped fallback is
  // safer than blocking a legitimate checkout.
  return fallbackUuid();
}

export function getOrCreateCheckoutRequestId(
  storage = globalThis.localStorage,
  cryptoImpl = globalThis.crypto,
) {
  try {
    const current = storage?.getItem(CHECKOUT_REQUEST_ID_STORAGE_KEY);
    if (isCheckoutRequestId(current)) return current.toLowerCase();
  } catch {
    // Private browsing can deny storage; continue with an in-memory ID.
  }

  const next = createCheckoutRequestId(cryptoImpl);
  try {
    storage?.setItem(CHECKOUT_REQUEST_ID_STORAGE_KEY, next);
  } catch {
    // The caller still retains `next` for this invocation.
  }
  return next;
}

export function clearCheckoutRequestId(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(CHECKOUT_REQUEST_ID_STORAGE_KEY);
  } catch {
    // Private browsing / quota errors do not affect checkout completion.
  }
}

const normalizedIdentity = (value) =>
  String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, "");

export function trustedCheckoutName(user) {
  const candidate = String(user?.full_name || user?.name || "").trim().replace(/\s+/g, " ");
  if (!candidate) return "";

  const normalized = normalizedIdentity(candidate);
  const emailLocal = normalizedIdentity(String(user?.email || "").split("@")[0]);
  const username = normalizedIdentity(user?.username);

  // Signup historically stored the email local-part as `full_name`. Treating
  // that placeholder as a delivery name produced values such as t_mace,
  // deneop24 and googleplayreview on real orders.
  if (normalized === emailLocal || (username && normalized === username)) return "";
  return candidate;
}

export function scrollCheckoutFieldIntoView(element) {
  if (!element?.scrollIntoView) return;
  window.setTimeout(() => {
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }, 80);
}
