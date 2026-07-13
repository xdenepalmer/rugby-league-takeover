/**
 * Pure logic for the native Site Settings workflow. Mirrors the web
 * SiteSettingsManager exactly — the single-record default seed, the
 * defaults+record merge, the dirty snapshot, the "custom vs default"
 * indicator, the background-video textarea parsing, the postcode
 * sanitiser and the rlt_admin_log text — so the native screen writes a
 * byte-identical record through the same SiteSettings entity.
 *
 * Shared cross-workflow logic (emitAdminLog) is imported from
 * ./workflow-helpers.js; this module never re-implements it.
 */
import { emitAdminLog } from "./workflow-helpers.js";

export { emitAdminLog };

/**
 * The web manager's `defaults` object, copied verbatim. Save writes the
 * whole merged record, so these are the values the native form must seed
 * and the exact keys the payload carries when a field is left untouched.
 */
export const SETTINGS_DEFAULTS = {
  site_logo_url: "/icons/icon-192.png",
  hero_eyebrow: "Las Vegas • Rugby League • Supporter Takeover",
  hero_title: "The annual\nVegas takeover",
  hero_description:
    "Join the world's most passionate and loyal Rugby League supporter groups for an unforgettable global footy invasion of Las Vegas.",
  hero_button_label: "Enter the site",
  background_video_urls: [
    "https://ohytlrgfpcpvnqgdpqap.supabase.co/storage/v1/object/public/media/migrated/7753542d9_b39f245c-2207-4f31-bd97-2cb52f47dc3a.mov",
    "https://ohytlrgfpcpvnqgdpqap.supabase.co/storage/v1/object/public/media/migrated/bf55ac1e7_allegiantstadiumparadisenevadaclaytonhaamallegiantallegiantstadiumparadis.mp4",
  ],
  social_facebook_url: "https://www.facebook.com/groups/663237792349090",
  social_instagram_url: "https://www.instagram.com/rugbyleaguetakeover?igsh=MTY1d3lkaWs1NDhnaw==",
  social_tiktok_url: "https://www.tiktok.com/@nrl_las_vegas?_r=1&_t=ZS-96zem8W4clw",
  news_eyebrow: "Latest News",
  news_title: "From the strip",
  news_description: "Fresh updates, announcements and supporter news for Rugby League Las Vegas.",
  about_eyebrow: "About Us",
  about_title: "Built by fans, for fans",
  about_description:
    "Rugby League Takeover Las Vegas brings together loyal supporter groups for a full-throttle celebration of Australian rugby league culture on the biggest stage in sport entertainment.",
  about_body:
    "Expect flags, chants, mateship, packed events, Vegas energy and a supporter community that travels hard and backs their team harder.",
  about_highlight: "Join the world's most passionate Rugby League supporter groups.",
  about_image_url: "https://images.unsplash.com/photo-1569959220744-ff553533f492?auto=format&fit=crop&w=1400&q=80",
  about_image_caption: "Las Vegas will hear us.",
  travel_eyebrow: "Travel Packages",
  travel_title: "Your Vegas base camp",
  travel_description: "Air, accommodation, events and more are coming soon. Register your interest to be first in line.",
  registration_eyebrow: "Register interest",
  registration_title: "Don't miss the drop.",
  registration_description: "Leave your details and the team will contact you when packages go live.",
  merch_eyebrow: "Merch",
  merch_title: "Wear the takeover",
  merch_description: "Browse official Rugby League Takeover merch and checkout securely in AUD.",
  shipping_sender_name: "",
  shipping_sender_business_name: "",
  shipping_sender_address_line1: "",
  shipping_sender_address_line2: "",
  shipping_sender_suburb: "",
  shipping_sender_state: "",
  shipping_sender_postcode: "",
  footer_text: "Rugby League Takeover Las Vegas © 2026",
  footer_powered_by: "DENEO.AI",
  contact_email: "",
  countdown_enabled: true,
  countdown_title: "The takeover begins in",
  countdown_subtitle: "Las Vegas • NRL Takeover",
  countdown_date: "",
  countdown_cta_label: "",
  countdown_cta_url: "",
};

/**
 * Same seed the web builds: `{ ...defaults, ...(settings || {}) }`. The saved
 * record (including its `id` and any server fields like created_date) rides
 * on top so the save keeps update semantics and never drops a stored field.
 */
export function mergeSettings(settings) {
  return { ...SETTINGS_DEFAULTS, ...(settings || {}) };
}

/**
 * Dirty check identical to the web (JSON.stringify(draft) !== savedRef).
 * Object-spread preserves key order, so the string comparison is stable.
 */
export function isSettingsDirty(baseline, draft) {
  return JSON.stringify(draft) !== JSON.stringify(baseline);
}

/**
 * Web parity (SiteSettingsManager.isCustom): a field counts as "custom" only
 * when the stored record set it AND it differs from the shipped default.
 */
export function isCustomField(settings, field) {
  if (!settings) return false;
  return settings[field] !== undefined && settings[field] !== SETTINGS_DEFAULTS[field];
}

/** The web indicator string ("custom" | "default") for a field. */
export function customIndicator(settings, field) {
  return isCustomField(settings, field) ? "custom" : "default";
}

/** Background videos textarea → array. Web: split "\n", trim, drop blanks. */
export function parseVideoUrls(text) {
  return String(text ?? "")
    .split("\n")
    .map((url) => url.trim())
    .filter(Boolean);
}

/** Array → textarea value (one URL per line), matching the web join. */
export function videoUrlsToText(urls) {
  return (urls || []).join("\n");
}

/** Web upload handler appends the new URL to the existing rotation. */
export function appendVideoUrl(urls, url) {
  return [...(urls || []), url];
}

/** Remove one video URL by index (native list affordance; draft-only edit). */
export function removeVideoUrl(urls, index) {
  const next = [...(urls || [])];
  next.splice(index, 1);
  return next;
}

/** Postcode input sanitiser: digits only, capped at 4 (web parity). */
export function sanitizePostcode(value) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 4);
}

/** Web toggle semantics: countdown is on unless explicitly false. */
export function countdownEnabled(draft) {
  return draft?.countdown_enabled !== false;
}

/** Web toggle semantics: hero eyebrow shows unless explicitly false. */
export function heroEyebrowVisible(draft) {
  return draft?.hero_eyebrow_visible !== false;
}

/** Update vs create: the web keys off the record id on the merged draft. */
export function isExistingRecord(draft) {
  return !!draft?.id;
}

/**
 * The exact rlt_admin_log text the web dispatches on save. Note the web reads
 * `draft.site_name` — a field the form never writes — so it only ever comes
 * from the stored record, else falls back to "Takeover". Kept verbatim.
 */
export function settingsLogText(draft) {
  return `[SETTING-UPDATE] Configuration saved successfully. Site Name: "${draft?.site_name || "Takeover"}"`;
}

/**
 * Section metadata mirroring the web `categories` array (id/title/desc +
 * summary). The native hub renders one row per section; icons are mapped in
 * the component (lucide components can't live in this pure module).
 */
export const SETTINGS_SECTIONS = [
  {
    id: "hero",
    title: "Brand & Hero",
    desc: "Upload logo, main headings, descriptions, and hero buttons on the landing view.",
    icon: "type",
    summary: (draft, settings) => (isCustomField(settings, "site_logo_url") ? "Logo: Custom" : "Logo: Default"),
  },
  {
    id: "countdown",
    title: "Countdown Timer",
    desc: "Live countdown timer settings, target start dates, heading text, and custom CTA links.",
    icon: "timer",
    summary: (draft) => (countdownEnabled(draft) ? "Live: Enabled" : "Live: Disabled"),
  },
  {
    id: "media",
    title: "Background Media",
    desc: "Manage homepage rotating video backgrounds, URLs, and direct file uploads.",
    icon: "film",
    summary: (draft) => `${(draft.background_video_urls || []).length} Video(s)`,
  },
  {
    id: "sections",
    title: "News, Travel & Merch Copy",
    desc: "Configure eyebrows, titles, and body texts for content feed modules.",
    icon: "newspaper",
    summary: (draft) => `Title: "${draft.news_title || ""}"`,
  },
  {
    id: "about",
    title: "About & Registration",
    desc: "Edit about statements, captions, imagery uploads, and registry descriptions.",
    icon: "users",
    summary: (draft) => `Headline: "${draft.about_title || ""}"`,
  },
  {
    id: "shipping",
    title: "Shipping (AusPost)",
    desc: "Sender/return address AusPost uses to calculate rates and generate labels.",
    icon: "truck",
    summary: (draft) => (draft.shipping_sender_postcode ? "Configured" : "Not set up"),
  },
  {
    id: "footer",
    title: "Footer, Socials & Attribution",
    desc: "Copyright lines, social profile links, attribution brand labels, and powered-by text.",
    icon: "panel-bottom",
    summary: (draft) => `Socials + powered by: ${draft.footer_powered_by || "None"}`,
  },
];
