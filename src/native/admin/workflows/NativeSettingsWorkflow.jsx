import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Type, Timer, Film, Newspaper, Users, PanelBottom, Truck,
  Save, Upload, X, Image as ImageIcon, ChevronRight, Settings, Undo2, Plane, ShoppingBag,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import DateTimePicker from "@/components/admin/DateTimePicker";
import AdminConfirmSheet from "@/components/admin/shared/AdminConfirmSheet";
import MobileActionDrawer from "@/components/admin/MobileActionDrawer";
import PullToRefresh from "@/components/PullToRefresh";
import { emitHaptic } from "@/lib/native/haptic-events";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import {
  SETTINGS_DEFAULTS,
  SETTINGS_SECTIONS,
  mergeSettings,
  isSettingsDirty,
  customIndicator,
  parseVideoUrls,
  videoUrlsToText,
  appendVideoUrl,
  removeVideoUrl,
  sanitizePostcode,
  countdownEnabled,
  heroEyebrowVisible,
  isExistingRecord,
  settingsLogText,
  emitAdminLog,
} from "./settings-helpers.js";

/**
 * Native Site Settings workflow — /admin/settings/settings. The web
 * SiteSettingsManager is one big single-record form split into a section
 * dashboard; the native version keeps that exactly: a section hub with one
 * bottom-sheet editor per group, editing a single shared draft. Save writes
 * the WHOLE merged record through the same entity the web uses
 * (SiteSettings.update(id, record) when it has an id, else .create(record)),
 * invalidates the SAME ["siteSettings"] key so the cache stays shared, and
 * dispatches the SAME rlt_admin_log success event. Uploads reuse the exact
 * client call the web MediaUploader/ImageField use
 * (base44.integrations.Core.UploadFile). RLS stays the write authority.
 */

const SECTION_ICONS = {
  type: Type,
  timer: Timer,
  film: Film,
  newspaper: Newspaper,
  users: Users,
  truck: Truck,
  "panel-bottom": PanelBottom,
};

const useSiteSettings = () =>
  useQuery({
    queryKey: ["siteSettings"],
    queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1),
    enabled: appParams.hasBase44Config,
    staleTime: 60000,
  });

/* ── Field primitives (touch-first, boxy idiom) ─────────────────────────── */

function FieldLabel({ htmlFor, children, indicator }) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={htmlFor} className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {children}
      </label>
      {indicator && (
        <span
          className={`border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${
            indicator === "custom"
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground/70"
          }`}
        >
          {indicator}
        </span>
      )}
    </div>
  );
}

function LabeledInput({ id, label, value, onChange, indicator, help, ...rest }) {
  return (
    <div className="grid gap-2">
      <FieldLabel htmlFor={id} indicator={indicator}>{label}</FieldLabel>
      <Input id={id} value={value || ""} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-none border-border bg-background" {...rest} />
      {help && <p className="text-[10px] text-muted-foreground">{help}</p>}
    </div>
  );
}

function LabeledTextarea({ id, label, value, onChange, help, className = "", ...rest }) {
  return (
    <div className="grid gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea id={id} value={value || ""} onChange={(e) => onChange(e.target.value)} className={`min-h-20 resize-none rounded-none border-border bg-background text-sm ${className}`} {...rest} />
      {help && <p className="text-[10px] text-muted-foreground">{help}</p>}
    </div>
  );
}

/**
 * Touch-first image control — URL paste, native file picker, always-visible
 * clear button. Uploads through the EXACT client call the web ImageField uses:
 * base44.integrations.Core.UploadFile.
 */
function NativeImageField({ label, value, onChange, indicator, idPrefix }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(file_url);
      emitHaptic("save.success");
    } catch (error) {
      emitHaptic("mutation.error");
      toast({ title: "Image upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="grid gap-2">
      <FieldLabel htmlFor={`${idPrefix}-url`} indicator={indicator}>{label}</FieldLabel>
      <div className="flex items-start gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-border bg-card/50">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground/40" aria-hidden="true" />
          )}
        </div>
        <div className="grid min-w-0 flex-1 gap-2">
          <Input
            id={`${idPrefix}-url`}
            placeholder="Paste image URL"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 rounded-none border-border bg-background"
          />
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="ios-pressable flex min-h-11 flex-1 items-center justify-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" /> {uploading ? "Uploading…" : "Upload"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                aria-label={`Remove ${label.toLowerCase()}`}
                className="ios-pressable flex min-h-11 min-w-11 items-center justify-center border border-red-500/40 text-red-400"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Video-only upload button that appends the returned URL to the rotation. */
function VideoUploadButton({ onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onUploaded(file_url);
      emitHaptic("save.success");
    } catch (error) {
      emitHaptic("mutation.error");
      toast({ title: "Video upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="video/*" className="hidden" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="ios-pressable flex min-h-11 w-full items-center justify-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
      >
        <Upload className="h-3.5 w-3.5" aria-hidden="true" /> {uploading ? "Uploading…" : "Upload background video"}
      </button>
    </>
  );
}

function ToggleRow({ label, help, checked, onCheckedChange }) {
  return (
    <label className="flex items-center justify-between gap-3 border border-border bg-card/50 p-3.5">
      <span className="min-w-0">
        <span className="block text-sm font-bold text-foreground">{label}</span>
        {help && <span className="mt-0.5 block text-xs text-muted-foreground">{help}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function SubHeader({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 border-l-2 border-primary/40 bg-primary/5 px-3 py-2">
      {Icon && <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
      <span className="text-[9px] font-black uppercase tracking-[0.25em] text-primary">{children}</span>
    </div>
  );
}

/* ── Per-section editor bodies (every field the web writes) ──────────────── */

function SectionBody({ section, draft, settings, update }) {
  switch (section) {
    case "hero":
      return (
        <div className="grid gap-4">
          <ToggleRow
            label="Show eyebrow text"
            help='The small line above the hero title — e.g. "Built by fans, for fans"'
            checked={heroEyebrowVisible(draft)}
            onCheckedChange={(v) => update("hero_eyebrow_visible", v)}
          />
          <NativeImageField label="Logo" idPrefix="native-settings-logo" indicator={customIndicator(settings, "site_logo_url")} value={draft.site_logo_url} onChange={(url) => update("site_logo_url", url)} />
          <LabeledInput id="native-settings-hero-eyebrow" label="Hero Eyebrow" help="Small text above the main heading." value={draft.hero_eyebrow} onChange={(v) => update("hero_eyebrow", v)} placeholder="Las Vegas • Rugby League" />
          <LabeledInput id="native-settings-hero-button" label="Hero Button Label" help="Call-to-action button text." value={draft.hero_button_label} onChange={(v) => update("hero_button_label", v)} placeholder="Enter the site" />
          <LabeledTextarea id="native-settings-hero-title" label="Hero Title" help="Use line breaks to split across multiple lines." className="min-h-24" value={draft.hero_title} onChange={(v) => update("hero_title", v)} placeholder="The annual&#10;Vegas takeover" />
          <LabeledTextarea id="native-settings-hero-desc" label="Hero Description" help="Supporting paragraph below the title." className="min-h-24" value={draft.hero_description} onChange={(v) => update("hero_description", v)} placeholder="Join the world's most passionate supporter groups…" />
        </div>
      );

    case "countdown":
      return (
        <div className="grid gap-4">
          <ToggleRow label="Show countdown on homepage" checked={countdownEnabled(draft)} onCheckedChange={(v) => update("countdown_enabled", v)} />
          {countdownEnabled(draft) && (
            <>
              <div className="grid gap-2">
                <FieldLabel>Takeover start date &amp; time</FieldLabel>
                <DateTimePicker value={draft.countdown_date || ""} onChange={(val) => update("countdown_date", val)} placeholder="Pick the takeover date & time" />
                <p className="text-[10px] text-muted-foreground">The moment the countdown reaches zero.</p>
              </div>
              <LabeledInput id="native-settings-cd-title" label="Heading" help="Text shown above the countdown digits." value={draft.countdown_title} onChange={(v) => update("countdown_title", v)} placeholder="The takeover begins in" />
              <LabeledInput id="native-settings-cd-subtitle" label="Subtitle" help="Secondary text beneath the heading." value={draft.countdown_subtitle} onChange={(v) => update("countdown_subtitle", v)} placeholder="Las Vegas • Allegiant Stadium" />
              <LabeledInput id="native-settings-cd-cta-label" label="Button Label" help="Optional CTA button." value={draft.countdown_cta_label} onChange={(v) => update("countdown_cta_label", v)} placeholder="Register now" />
              <LabeledInput id="native-settings-cd-cta-url" label="Button Link" help="URL for the CTA button." value={draft.countdown_cta_url} onChange={(v) => update("countdown_cta_url", v)} placeholder="https://…" />
            </>
          )}
        </div>
      );

    case "media": {
      const urls = draft.background_video_urls || [];
      return (
        <div className="grid gap-4">
          <LabeledTextarea
            id="native-settings-video-urls"
            label="Video URLs"
            help="One URL per line. Videos rotate automatically on the homepage."
            className="min-h-28 font-mono text-xs"
            value={videoUrlsToText(urls)}
            onChange={(text) => update("background_video_urls", parseVideoUrls(text))}
          />
          <div className="flex items-center gap-2 border border-border bg-card/50 px-3 py-2">
            <Film className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span className="text-[10px] font-mono text-muted-foreground">
              {urls.length} video{urls.length !== 1 ? "s" : ""} in rotation
            </span>
          </div>
          {urls.length > 0 && (
            <div className="grid gap-1.5">
              {urls.map((url, i) => (
                <div key={i} className="flex items-center gap-2 border border-border/60 bg-card/40 px-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">{url}</span>
                  <button
                    type="button"
                    onClick={() => update("background_video_urls", removeVideoUrl(urls, i))}
                    aria-label={`Remove video ${i + 1}`}
                    className="ios-pressable flex min-h-11 min-w-11 items-center justify-center border border-red-500/40 text-red-400"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <VideoUploadButton onUploaded={(url) => update("background_video_urls", appendVideoUrl(draft.background_video_urls, url))} />
        </div>
      );
    }

    case "sections":
      return (
        <div className="grid gap-4">
          <SubHeader icon={Newspaper}>News</SubHeader>
          <LabeledInput id="native-settings-news-eyebrow" label="News Eyebrow" value={draft.news_eyebrow} onChange={(v) => update("news_eyebrow", v)} placeholder="Latest News" />
          <LabeledInput id="native-settings-news-title" label="News Title" value={draft.news_title} onChange={(v) => update("news_title", v)} placeholder="From the strip" />
          <LabeledTextarea id="native-settings-news-desc" label="News Description" value={draft.news_description} onChange={(v) => update("news_description", v)} placeholder="Fresh updates and announcements…" />

          <SubHeader icon={Plane}>Travel</SubHeader>
          <LabeledInput id="native-settings-travel-eyebrow" label="Travel Eyebrow" value={draft.travel_eyebrow} onChange={(v) => update("travel_eyebrow", v)} placeholder="Travel Packages" />
          <LabeledInput id="native-settings-travel-title" label="Travel Title" value={draft.travel_title} onChange={(v) => update("travel_title", v)} placeholder="Your Vegas base camp" />
          <LabeledTextarea id="native-settings-travel-desc" label="Travel Description" value={draft.travel_description} onChange={(v) => update("travel_description", v)} placeholder="Air, accommodation, events and more…" />

          <SubHeader icon={ShoppingBag}>Merch</SubHeader>
          <LabeledInput id="native-settings-merch-eyebrow" label="Merch Eyebrow" value={draft.merch_eyebrow} onChange={(v) => update("merch_eyebrow", v)} placeholder="Merch" />
          <LabeledInput id="native-settings-merch-title" label="Merch Title" value={draft.merch_title} onChange={(v) => update("merch_title", v)} placeholder="Wear the takeover" />
          <LabeledTextarea id="native-settings-merch-desc" label="Merch Description" value={draft.merch_description} onChange={(v) => update("merch_description", v)} placeholder="Browse official merch and checkout securely…" />
        </div>
      );

    case "about":
      return (
        <div className="grid gap-4">
          <SubHeader icon={Users}>About Us</SubHeader>
          <LabeledInput id="native-settings-about-eyebrow" label="About Eyebrow" value={draft.about_eyebrow} onChange={(v) => update("about_eyebrow", v)} placeholder="About Us" />
          <LabeledInput id="native-settings-about-title" label="About Title" value={draft.about_title} onChange={(v) => update("about_title", v)} placeholder="Built by fans, for fans" />
          <LabeledTextarea id="native-settings-about-desc" label="About Description" value={draft.about_description} onChange={(v) => update("about_description", v)} placeholder="Rugby League Takeover Las Vegas brings together…" />
          <LabeledTextarea id="native-settings-about-body" label="About Body" help="Extended paragraph content for the about section." className="min-h-24" value={draft.about_body} onChange={(v) => update("about_body", v)} placeholder="Expect flags, chants, mateship…" />
          <LabeledInput id="native-settings-about-highlight" label="About Highlight" help="Pullout quote or key message." value={draft.about_highlight} onChange={(v) => update("about_highlight", v)} placeholder="Join the world's most passionate…" />
          <LabeledInput id="native-settings-about-caption" label="Image Caption" value={draft.about_image_caption} onChange={(v) => update("about_image_caption", v)} placeholder="Las Vegas will hear us." />
          <NativeImageField label="About Image" idPrefix="native-settings-about-image" indicator={customIndicator(settings, "about_image_url")} value={draft.about_image_url} onChange={(url) => update("about_image_url", url)} />

          <SubHeader icon={Users}>Registration</SubHeader>
          <LabeledInput id="native-settings-reg-eyebrow" label="Registration Eyebrow" value={draft.registration_eyebrow} onChange={(v) => update("registration_eyebrow", v)} placeholder="Register interest" />
          <LabeledInput id="native-settings-reg-title" label="Registration Title" value={draft.registration_title} onChange={(v) => update("registration_title", v)} placeholder="Don't miss the drop." />
          <LabeledTextarea id="native-settings-reg-desc" label="Registration Description" value={draft.registration_description} onChange={(v) => update("registration_description", v)} placeholder="Leave your details and the team will contact you…" />
        </div>
      );

    case "shipping":
      return (
        <div className="grid gap-4">
          <LabeledInput id="native-settings-ship-name" label="Sender name" help="Shown on the label as the return-to contact." value={draft.shipping_sender_name} onChange={(v) => update("shipping_sender_name", v)} placeholder="e.g. Dene Palmer" />
          <LabeledInput id="native-settings-ship-business" label="Business name (optional)" value={draft.shipping_sender_business_name} onChange={(v) => update("shipping_sender_business_name", v)} placeholder="Rugby League Takeover" />
          <LabeledInput id="native-settings-ship-addr1" label="Address line 1" value={draft.shipping_sender_address_line1} onChange={(v) => update("shipping_sender_address_line1", v)} placeholder="Street address" />
          <LabeledInput id="native-settings-ship-addr2" label="Address line 2 (optional)" value={draft.shipping_sender_address_line2} onChange={(v) => update("shipping_sender_address_line2", v)} placeholder="Unit, suite, etc." />
          <div className="grid grid-cols-3 gap-2">
            <LabeledInput id="native-settings-ship-suburb" label="Suburb" value={draft.shipping_sender_suburb} onChange={(v) => update("shipping_sender_suburb", v)} placeholder="Brisbane" />
            <LabeledInput id="native-settings-ship-state" label="State" value={draft.shipping_sender_state} onChange={(v) => update("shipping_sender_state", v)} placeholder="QLD" />
            <LabeledInput
              id="native-settings-ship-postcode"
              label="Postcode"
              value={draft.shipping_sender_postcode}
              onChange={(v) => update("shipping_sender_postcode", sanitizePostcode(v))}
              inputMode="numeric"
              maxLength={4}
              placeholder="4000"
            />
          </div>
          <div className="flex items-start gap-2 border border-amber-500/25 bg-amber-500/5 p-3">
            <Truck className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Live rates and label creation both fail until a sender postcode is set here. The AusPost account credentials
              themselves (API key, account number) are Supabase Edge Function secrets, not set here.
            </p>
          </div>
        </div>
      );

    case "footer":
      return (
        <div className="grid gap-4">
          <LabeledInput id="native-settings-footer-text" label="Footer Text" help="Displayed in the site footer." indicator={customIndicator(settings, "footer_text")} value={draft.footer_text} onChange={(v) => update("footer_text", v)} placeholder="Rugby League Takeover Las Vegas © 2026" />
          <LabeledInput id="native-settings-footer-powered" label="Powered By" help="Attribution line." value={draft.footer_powered_by} onChange={(v) => update("footer_powered_by", v)} placeholder="DENEO.AI" />
          <LabeledInput id="native-settings-contact-email" label="Contact Email" help="Shown in the footer for visitor inquiries." value={draft.contact_email} onChange={(v) => update("contact_email", v)} placeholder="admin@rugbyleaguetakeover.com" />

          <SubHeader icon={Users}>Social Links</SubHeader>
          <LabeledInput id="native-settings-social-fb" label="Facebook URL" help="Shown in the homepage social blocks." value={draft.social_facebook_url} onChange={(v) => update("social_facebook_url", v)} placeholder="https://facebook.com/…" />
          <LabeledInput id="native-settings-social-ig" label="Instagram URL" value={draft.social_instagram_url} onChange={(v) => update("social_instagram_url", v)} placeholder="https://instagram.com/…" />
          <LabeledInput id="native-settings-social-tt" label="TikTok URL" value={draft.social_tiktok_url} onChange={(v) => update("social_tiktok_url", v)} placeholder="https://tiktok.com/@…" />
          <LabeledInput id="native-settings-fb-fans" label="Facebook fan count" help="The figure on the 'Meet the travelling crowd' card. Keep it current (e.g. 16.8k)." value={draft.facebook_fans} onChange={(v) => update("facebook_fans", v)} placeholder="16.8k" />

          <div className="border-t border-border/30 pt-4">
            <p className="pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Legal pages (footer)</p>
            <div className="grid gap-4">
              <LabeledTextarea id="native-settings-legal-terms" label="Terms & Conditions" help="Shown at /terms. Leave blank to use the built-in starter text. Blank lines = new paragraph; wrap a line in [brackets] for a heading." className="min-h-40" value={draft.legal_terms} onChange={(v) => update("legal_terms", v)} placeholder="Your Terms & Conditions…" />
              <LabeledTextarea id="native-settings-legal-privacy" label="Privacy Policy" help="Shown at /privacy. Same formatting rules as above." className="min-h-40" value={draft.legal_privacy} onChange={(v) => update("legal_privacy", v)} placeholder="Your Privacy Policy…" />
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

/** Native Site Settings hub + section-sheet editors — self-chromed. */
export default function NativeSettingsWorkflow() {
  const queryClient = useQueryClient();
  const { data: records = [], isLoading, isError } = useSiteSettings();
  const settings = records[0];

  // Web parity: seed a single draft from { ...defaults, ...record } and track
  // dirtiness against a snapshot string (SiteSettingsManager.savedRef).
  const [draft, setDraft] = useState(() => mergeSettings(settings));
  const savedRef = useRef(JSON.stringify(mergeSettings(settings)));
  const [openSection, setOpenSection] = useState(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  useEffect(() => {
    const merged = mergeSettings(settings);
    setDraft(merged);
    savedRef.current = JSON.stringify(merged);
  }, [settings]);

  const dirty = useMemo(() => isSettingsDirty(JSON.parse(savedRef.current), draft), [draft]);
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const saveMutation = useMutation({
    // Web parity: data.id ? SiteSettings.update(id, data) : SiteSettings.create(data).
    mutationFn: (data) => (isExistingRecord(data) ? base44.entities.SiteSettings.update(data.id, data) : base44.entities.SiteSettings.create(data)),
    onSuccess: (_result, variables) => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["siteSettings"] });
      savedRef.current = JSON.stringify(variables);
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 2000);
      // Same audit event the web SiteSettingsManager dispatches on save.
      emitAdminLog("success", settingsLogText(variables));
      toast({ title: "Settings saved" });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Failed to save settings", description: error?.message || "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  const save = () => {
    emitHaptic("action.primary");
    saveMutation.mutate(draft);
  };

  const discard = () => {
    const merged = JSON.parse(savedRef.current);
    setDraft(merged);
    setConfirmDiscard(false);
    emitHaptic("tab.select");
  };

  const activeSection = SETTINGS_SECTIONS.find((s) => s.id === openSection) || null;

  if (isLoading && !settings) {
    return (
      <div>
        <NativeTopBar title="Site Settings" fallback="/admin/settings" />
        <div className="space-y-2 px-4 pt-4">
          <NativeSkeleton className="h-20 w-full" />
          <NativeSkeleton className="h-16 w-full" />
          <NativeSkeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <NativeTopBar title="Site Settings" fallback="/admin/settings" />
      <PullToRefresh queryKeys={[["siteSettings"]]}>
        {isError && !settings ? (
          <div className="px-4 pt-6">
            <NativeEmptyState
              icon={Settings}
              title="Couldn't load settings"
              description="Pull to refresh once you're back online — editing before the current values load could overwrite them."
            />
          </div>
        ) : (
          <>
            <div className="px-4 pt-4">
              <div className="flex items-center gap-2 border border-border/60 bg-card/50 p-4">
                <Settings className="h-4 w-4 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary">Control Centre</p>
                  <p className="text-xs text-muted-foreground">Tap a module to edit the public site. One save writes them all.</p>
                </div>
              </div>
            </div>

            <div className="border-t border-border/40">
              {SETTINGS_SECTIONS.map((section) => {
                const Icon = SECTION_ICONS[section.icon] || Settings;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => {
                      emitHaptic("tab.select");
                      setOpenSection(section.id);
                    }}
                    className="ios-pressable flex w-full items-center gap-3 border-b border-border/40 bg-card/40 px-4 py-3.5 text-left"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold uppercase tracking-wide">{section.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{section.desc}</span>
                      <span className="mt-1 inline-block max-w-full truncate border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary/70">
                        {section.summary(draft, settings)}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </PullToRefresh>

      {/* Sticky save bar — the web's single Save for the whole record. */}
      {!(isError && !settings) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-2">
            {dirty ? (
              <button
                type="button"
                onClick={() => {
                  emitHaptic("mutation.warning");
                  setConfirmDiscard(true);
                }}
                className="ios-pressable flex min-h-12 items-center justify-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Discard
              </button>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {saveFlash ? "Saved" : "All changes saved"}
              </span>
            )}
            <button
              type="button"
              disabled={!dirty || saveMutation.isPending}
              onClick={save}
              className="ios-pressable flex min-h-12 flex-1 items-center justify-center gap-2 bg-primary text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
            >
              <Save className="h-4 w-4" aria-hidden="true" /> {saveMutation.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      <MobileActionDrawer
        open={!!activeSection}
        onOpenChange={(open) => { if (!open) setOpenSection(null); }}
        title={activeSection?.title || ""}
        description={activeSection?.desc}
      >
        {activeSection && (
          <div className="grid gap-4">
            <SectionBody section={activeSection.id} draft={draft} settings={settings} update={update} />
            <button
              type="button"
              onClick={() => setOpenSection(null)}
              className="ios-pressable flex min-h-12 items-center justify-center border border-border text-xs font-bold uppercase tracking-widest"
            >
              Done
            </button>
            <p className="text-center text-[10px] text-muted-foreground">
              Changes are held until you tap Save on the settings screen.
            </p>
          </div>
        )}
      </MobileActionDrawer>

      <AdminConfirmSheet
        open={confirmDiscard}
        variant="destructive"
        title="Discard changes?"
        description="This reverts every unsaved edit back to the last saved settings."
        confirmLabel="Discard"
        onConfirm={discard}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}

// Re-exported for source-contract tests / integrators; the full default seed.
export { SETTINGS_DEFAULTS };
