import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save, Sparkles, Timer, Film, Newspaper, Users, PanelBottom,
  Image as ImageIcon, CheckCircle2, AlertCircle, Type, FileText,
  Plane, ShoppingBag, Quote, Captions,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import AdminSection from "./AdminSection";
import FieldGroup from "./FieldGroup";
import MediaUploader from "./MediaUploader";
import DateTimePicker from "./DateTimePicker";
import ImageField from "./ImageField";

const defaults = {
  site_logo_url: "https://media.base44.com/images/public/6a18d49a2b8f40f0f81cc26e/24c67d277_LASVEGAS.png",
  hero_eyebrow: "Las Vegas • Rugby League • Supporter Takeover",
  hero_title: "The annual\nVegas takeover",
  hero_description: "Join the world's most passionate and loyal Rugby League supporter groups for an unforgettable global footy invasion of Las Vegas.",
  hero_button_label: "Enter the site",
  background_video_urls: [
    "https://media.base44.com/videos/public/6a18d49a2b8f40f0f81cc26e/7753542d9_b39f245c-2207-4f31-bd97-2cb52f47dc3a.mov",
    "https://media.base44.com/videos/public/6a18d49a2b8f40f0f81cc26e/bf55ac1e7_AllegiantStadiumParadiseNevadaclaytonhaamallegiantallegiantstadiumparadis.mp4"
  ],
  news_eyebrow: "Latest News",
  news_title: "From the strip",
  news_description: "Fresh updates, announcements and supporter news for Rugby League Las Vegas.",
  about_eyebrow: "About Us",
  about_title: "Built by fans, for fans",
  about_description: "Rugby League Takeover Las Vegas brings together loyal supporter groups for a full-throttle celebration of Australian rugby league culture on the biggest stage in sport entertainment.",
  about_body: "Expect flags, chants, mateship, packed events, Vegas energy and a supporter community that travels hard and backs their team harder.",
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
  footer_text: "Rugby League Takeover Las Vegas © 2026",
  footer_powered_by: "DENEO.AI",
  countdown_enabled: true,
  countdown_title: "The takeover begins in",
  countdown_subtitle: "Las Vegas • NRL Takeover",
  countdown_date: "",
  countdown_cta_label: "",
  countdown_cta_url: ""
};

/* ─── Labeled Field Wrapper ────────────────────────────────── */
function LabeledField({ label, help, children, fullWidth, indicator }) {
  return (
    <div className={`grid gap-1.5 ${fullWidth ? "md:col-span-2" : ""}`}>
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </label>
        {indicator && (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0 text-[8px] font-bold uppercase tracking-wider border ${
            indicator === "custom"
              ? "text-primary border-primary/20 bg-primary/5"
              : "text-muted-foreground border-border/40 bg-muted/10"
          }`}>
            {indicator === "custom" ? (
              <><CheckCircle2 className="h-2 w-2" /> Custom</>
            ) : (
              <><AlertCircle className="h-2 w-2" /> Default</>
            )}
          </span>
        )}
      </div>
      {children}
      {help && <p className="text-[9px] text-muted-foreground/60 leading-4">{help}</p>}
    </div>
  );
}

/* ─── Image Preview Thumbnail ──────────────────────────────── */
function ImagePreview({ url, alt }) {
  const [error, setError] = useState(false);
  if (!url || error) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative md:col-span-2 overflow-hidden border border-border/40 bg-muted/10 p-2"
    >
      <div className="flex items-center gap-2 mb-2">
        <ImageIcon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">Live Preview</span>
      </div>
      <div className="relative h-20 w-full overflow-hidden bg-background/50 border border-border/20">
        <img
          src={url}
          alt={alt || "Preview"}
          onError={() => setError(true)}
          className="h-full w-full object-contain"
        />
      </div>
    </motion.div>
  );
}

/* ─── Video Count Badge ────────────────────────────────────── */
function VideoCountBadge({ count }) {
  return (
    <div className="md:col-span-2 flex items-center gap-2 px-3 py-2 border border-border/30 bg-muted/10">
      <Film className="h-3 w-3 text-accent" />
      <span className="text-[9px] font-mono text-muted-foreground">
        {count} video{count !== 1 ? "s" : ""} in rotation
      </span>
      {count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 cmd-blink ml-auto" />}
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────── */
export default function SiteSettingsManager({ settings }) {
  const [draft, setDraft] = useState({ ...defaults, ...(settings || {}) });
  const [saveFlash, setSaveFlash] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setDraft({ ...defaults, ...(settings || {}) });
  }, [settings?.id]);

  const saveMutation = useMutation({
    mutationFn: (data) => data.id ? base44.entities.SiteSettings.update(data.id, data) : base44.entities.SiteSettings.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["siteSettings"] });
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 2000);
    },
  });

  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const videoText = (draft.background_video_urls || []).join("\n");

  /* Helper: detect if a field has been customised vs defaults */
  const isCustom = (field) => {
    if (!settings) return false;
    return settings[field] !== undefined && settings[field] !== defaults[field];
  };

  return (
    <AdminSection
      id="site-settings"
      eyebrow="Step 1"
      title="Website settings"
      description="Edit homepage wording, logo, images, videos and footer content. Changes save to the live site after pressing Save."
      icon={Sparkles}
    >
      <div className="grid gap-4">

        {/* ── 1. Brand & Hero ─────────────────────────── */}
        <FieldGroup
          title="Brand and hero"
          help="Logo, headline, and hero section on the homepage."
          step={1}
          icon={Type}
        >
          <LabeledField label="Logo URL" help="Direct URL to your site logo image." indicator={isCustom("site_logo_url") ? "custom" : "default"}>
            <Input placeholder="https://example.com/logo.png" value={draft.site_logo_url || ""} onChange={(e) => update("site_logo_url", e.target.value)} className="rounded-none" />
          </LabeledField>
          <MediaUploader label="Upload logo" accept="image/*" onUploaded={(url) => update("site_logo_url", url)} />

          {/* Live logo preview */}
          <ImagePreview url={draft.site_logo_url} alt="Site logo" />

          <LabeledField label="Hero Eyebrow" help="Small text above the main heading.">
            <Input placeholder="Las Vegas • Rugby League" value={draft.hero_eyebrow || ""} onChange={(e) => update("hero_eyebrow", e.target.value)} className="rounded-none" />
          </LabeledField>
          <LabeledField label="Hero Button Label" help="Call-to-action button text.">
            <Input placeholder="Enter the site" value={draft.hero_button_label || ""} onChange={(e) => update("hero_button_label", e.target.value)} className="rounded-none" />
          </LabeledField>
          <LabeledField label="Hero Title" help="Use line breaks to split across multiple lines." fullWidth>
            <Textarea placeholder="The annual&#10;Vegas takeover" value={draft.hero_title || ""} onChange={(e) => update("hero_title", e.target.value)} className="min-h-24 rounded-none" />
          </LabeledField>
          <LabeledField label="Hero Description" help="Supporting paragraph below the title." fullWidth>
            <Textarea placeholder="Join the world's most passionate supporter groups..." value={draft.hero_description || ""} onChange={(e) => update("hero_description", e.target.value)} className="min-h-24 rounded-none" />
          </LabeledField>
        </FieldGroup>

        {/* ── 2. Countdown Timer ──────────────────────── */}
        <FieldGroup
          title="Countdown timer"
          help="Live countdown clock displayed on the homepage."
          step={2}
          icon={Timer}
        >
          <div className="md:col-span-2">
            <div className="flex items-center justify-between border border-border/60 bg-muted/10 p-3.5 transition-colors hover:border-border">
              <div className="flex items-center gap-2.5">
                <div className={`h-2 w-2 rounded-full ${draft.countdown_enabled !== false ? "bg-emerald-400 cmd-blink" : "bg-muted-foreground/40"}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">Show countdown on homepage</span>
              </div>
              <Switch checked={draft.countdown_enabled !== false} onCheckedChange={(value) => update("countdown_enabled", value)} />
            </div>
          </div>

          <AnimatePresence>
            {draft.countdown_enabled !== false && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="md:col-span-2 grid gap-4 md:grid-cols-2 overflow-hidden"
              >
                <LabeledField label="Takeover start date & time" help="The moment the countdown reaches zero.">
                  <DateTimePicker value={draft.countdown_date || ""} onChange={(val) => update("countdown_date", val)} placeholder="Pick the takeover date & time" />
                </LabeledField>
                <LabeledField label="Heading" help="Text shown above the countdown digits.">
                  <Input placeholder="The takeover begins in" value={draft.countdown_title || ""} onChange={(e) => update("countdown_title", e.target.value)} className="rounded-none" />
                </LabeledField>
                <LabeledField label="Subtitle" fullWidth help="Secondary text beneath the heading.">
                  <Input placeholder="Las Vegas • Allegiant Stadium" value={draft.countdown_subtitle || ""} onChange={(e) => update("countdown_subtitle", e.target.value)} className="rounded-none" />
                </LabeledField>
                <LabeledField label="Button Label" help="Optional CTA button.">
                  <Input placeholder="Register now" value={draft.countdown_cta_label || ""} onChange={(e) => update("countdown_cta_label", e.target.value)} className="rounded-none" />
                </LabeledField>
                <LabeledField label="Button Link" help="URL for the CTA button.">
                  <Input placeholder="https://..." value={draft.countdown_cta_url || ""} onChange={(e) => update("countdown_cta_url", e.target.value)} className="rounded-none" />
                </LabeledField>
              </motion.div>
            )}
          </AnimatePresence>
        </FieldGroup>

        {/* ── 3. Background Videos ────────────────────── */}
        <FieldGroup
          title="Homepage background videos"
          help="Paste one video URL per line, or upload below."
          step={3}
          icon={Film}
        >
          <LabeledField label="Video URLs" help="One URL per line. Videos rotate automatically on the homepage." fullWidth>
            <Textarea value={videoText} onChange={(e) => update("background_video_urls", e.target.value.split("\n").map((url) => url.trim()).filter(Boolean))} className="min-h-28 rounded-none font-mono text-xs" />
          </LabeledField>
          <VideoCountBadge count={(draft.background_video_urls || []).length} />
          <MediaUploader label="Upload background video" accept="video/*" onUploaded={(url) => update("background_video_urls", [...(draft.background_video_urls || []), url])} />
        </FieldGroup>

        {/* ── 4. News / Travel / Merch ────────────────── */}
        <FieldGroup
          title="News, travel and merch sections"
          help="Section headings and copy for the three content blocks."
          step={4}
          icon={Newspaper}
        >
          {/* News subsection */}
          <div className="md:col-span-2 flex items-center gap-2 px-3 py-2 border-l-2 border-primary/40 bg-primary/5">
            <Captions className="h-3 w-3 text-primary" />
            <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-primary">News</span>
          </div>
          <LabeledField label="News Eyebrow">
            <Input placeholder="Latest News" value={draft.news_eyebrow || ""} onChange={(e) => update("news_eyebrow", e.target.value)} className="rounded-none" />
          </LabeledField>
          <LabeledField label="News Title">
            <Input placeholder="From the strip" value={draft.news_title || ""} onChange={(e) => update("news_title", e.target.value)} className="rounded-none" />
          </LabeledField>
          <LabeledField label="News Description" fullWidth>
            <Textarea placeholder="Fresh updates and announcements..." value={draft.news_description || ""} onChange={(e) => update("news_description", e.target.value)} className="rounded-none" />
          </LabeledField>

          {/* Travel subsection */}
          <div className="md:col-span-2 flex items-center gap-2 px-3 py-2 border-l-2 border-accent/40 bg-accent/5 mt-2">
            <Plane className="h-3 w-3 text-accent" />
            <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-accent">Travel</span>
          </div>
          <LabeledField label="Travel Eyebrow">
            <Input placeholder="Travel Packages" value={draft.travel_eyebrow || ""} onChange={(e) => update("travel_eyebrow", e.target.value)} className="rounded-none" />
          </LabeledField>
          <LabeledField label="Travel Title">
            <Input placeholder="Your Vegas base camp" value={draft.travel_title || ""} onChange={(e) => update("travel_title", e.target.value)} className="rounded-none" />
          </LabeledField>
          <LabeledField label="Travel Description" fullWidth>
            <Textarea placeholder="Air, accommodation, events and more..." value={draft.travel_description || ""} onChange={(e) => update("travel_description", e.target.value)} className="rounded-none" />
          </LabeledField>

          {/* Merch subsection */}
          <div className="md:col-span-2 flex items-center gap-2 px-3 py-2 border-l-2 border-emerald-500/40 bg-emerald-500/5 mt-2">
            <ShoppingBag className="h-3 w-3 text-emerald-400" />
            <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-400">Merch</span>
          </div>
          <LabeledField label="Merch Eyebrow">
            <Input placeholder="Merch" value={draft.merch_eyebrow || ""} onChange={(e) => update("merch_eyebrow", e.target.value)} className="rounded-none" />
          </LabeledField>
          <LabeledField label="Merch Title">
            <Input placeholder="Wear the takeover" value={draft.merch_title || ""} onChange={(e) => update("merch_title", e.target.value)} className="rounded-none" />
          </LabeledField>
          <LabeledField label="Merch Description" fullWidth>
            <Textarea placeholder="Browse official merch and checkout securely..." value={draft.merch_description || ""} onChange={(e) => update("merch_description", e.target.value)} className="rounded-none" />
          </LabeledField>
        </FieldGroup>

        {/* ── 5. About & Registration ─────────────────── */}
        <FieldGroup
          title="About section and registration"
          help="About us content, imagery, and interest registration copy."
          step={5}
          icon={Users}
        >
          {/* About subsection */}
          <div className="md:col-span-2 flex items-center gap-2 px-3 py-2 border-l-2 border-primary/40 bg-primary/5">
            <FileText className="h-3 w-3 text-primary" />
            <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-primary">About Us</span>
          </div>
          <LabeledField label="About Eyebrow">
            <Input placeholder="About Us" value={draft.about_eyebrow || ""} onChange={(e) => update("about_eyebrow", e.target.value)} className="rounded-none" />
          </LabeledField>
          <LabeledField label="About Title">
            <Input placeholder="Built by fans, for fans" value={draft.about_title || ""} onChange={(e) => update("about_title", e.target.value)} className="rounded-none" />
          </LabeledField>
          <LabeledField label="About Description" fullWidth>
            <Textarea placeholder="Rugby League Takeover Las Vegas brings together..." value={draft.about_description || ""} onChange={(e) => update("about_description", e.target.value)} className="rounded-none" />
          </LabeledField>
          <LabeledField label="About Body" fullWidth help="Extended paragraph content for the about section.">
            <Textarea placeholder="Expect flags, chants, mateship..." value={draft.about_body || ""} onChange={(e) => update("about_body", e.target.value)} className="rounded-none" />
          </LabeledField>
          <LabeledField label="About Highlight" help="Pullout quote or key message.">
            <Input placeholder="Join the world's most passionate..." value={draft.about_highlight || ""} onChange={(e) => update("about_highlight", e.target.value)} className="rounded-none" />
          </LabeledField>
          <LabeledField label="Image Caption">
            <Input placeholder="Las Vegas will hear us." value={draft.about_image_caption || ""} onChange={(e) => update("about_image_caption", e.target.value)} className="rounded-none" />
          </LabeledField>
          <LabeledField label="About Image" help="Upload an image or paste a URL — preview updates instantly. Remember to Save." indicator={isCustom("about_image_url") ? "custom" : "default"} fullWidth>
            <ImageField value={draft.about_image_url || ""} onChange={(url) => update("about_image_url", url)} />
          </LabeledField>

          {/* Registration subsection */}
          <div className="md:col-span-2 flex items-center gap-2 px-3 py-2 border-l-2 border-accent/40 bg-accent/5 mt-2">
            <Quote className="h-3 w-3 text-accent" />
            <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-accent">Registration</span>
          </div>
          <LabeledField label="Registration Eyebrow">
            <Input placeholder="Register interest" value={draft.registration_eyebrow || ""} onChange={(e) => update("registration_eyebrow", e.target.value)} className="rounded-none" />
          </LabeledField>
          <LabeledField label="Registration Title">
            <Input placeholder="Don't miss the drop." value={draft.registration_title || ""} onChange={(e) => update("registration_title", e.target.value)} className="rounded-none" />
          </LabeledField>
          <LabeledField label="Registration Description" fullWidth>
            <Textarea placeholder="Leave your details and the team will contact you..." value={draft.registration_description || ""} onChange={(e) => update("registration_description", e.target.value)} className="rounded-none" />
          </LabeledField>
        </FieldGroup>

        {/* ── 6. Footer ───────────────────────────────── */}
        <FieldGroup
          title="Footer"
          help="Copyright text and attribution."
          step={6}
          icon={PanelBottom}
        >
          <LabeledField label="Footer Text" help="Displayed in the site footer." indicator={isCustom("footer_text") ? "custom" : "default"}>
            <Input placeholder="Rugby League Takeover Las Vegas © 2026" value={draft.footer_text || ""} onChange={(e) => update("footer_text", e.target.value)} className="rounded-none" />
          </LabeledField>
          <LabeledField label="Powered By" help="Attribution line.">
            <Input placeholder="DENEO.AI" value={draft.footer_powered_by || ""} onChange={(e) => update("footer_powered_by", e.target.value)} className="rounded-none" />
          </LabeledField>
        </FieldGroup>

        {/* ── Sticky Save Bar ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="sticky bottom-4 z-20"
        >
          <div className="relative overflow-hidden border border-primary/30 bg-card/90 cmd-glass">
            {/* Top accent */}
            <div className="h-[2px] w-full bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] animate-[cmd-data-stream_3s_linear_infinite]" />

            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${saveMutation.isPending ? "bg-accent cmd-pulse" : saveFlash ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />
                <div>
                  <p className="text-xs font-bold text-foreground">
                    {saveFlash ? "Settings saved successfully!" : "Preview the public site after saving to check your changes."}
                  </p>
                  <p className="text-[9px] text-muted-foreground font-mono mt-0.5">
                    Changes deploy instantly to the live site
                  </p>
                </div>
              </div>

              <Button
                onClick={() => saveMutation.mutate(draft)}
                disabled={saveMutation.isPending}
                className="rounded-none bg-primary hover:bg-primary/90 transition-all duration-200 hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
              >
                {saveMutation.isPending ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="mr-2">
                      <Save className="h-4 w-4" />
                    </motion.div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Website Settings
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>

      </div>
    </AdminSection>
  );
}