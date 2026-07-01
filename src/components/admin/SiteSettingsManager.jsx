import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save, Timer, Film, Newspaper, Users, PanelBottom,
  Image as ImageIcon, Type, FileText,
  Plane, ShoppingBag, Quote, Captions, ChevronLeft, LayoutGrid, Settings,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import MediaUploader from "./MediaUploader";
import DateTimePicker from "./DateTimePicker";
import ImageField from "./ImageField";
import AdminStickyActionBar from "./AdminStickyActionBar";
import LabeledField from "./shared/LabeledField";

const defaults = {
  site_logo_url: "/icons/icon-192.png",
  hero_eyebrow: "Las Vegas • Rugby League • Supporter Takeover",
  hero_title: "The annual\nVegas takeover",
  hero_description: "Join the world's most passionate and loyal Rugby League supporter groups for an unforgettable global footy invasion of Las Vegas.",
  hero_button_label: "Enter the site",
  background_video_urls: [
    "https://media.base44.com/videos/public/6a18d49a2b8f40f0f81cc26e/7753542d9_b39f245c-2207-4f31-bd97-2cb52f47dc3a.mov",
    "https://media.base44.com/videos/public/6a18d49a2b8f40f0f81cc26e/bf55ac1e7_AllegiantStadiumParadiseNevadaclaytonhaamallegiantallegiantstadiumparadis.mp4"
  ],
  social_facebook_url: "https://www.facebook.com/groups/663237792349090",
  social_instagram_url: "https://www.instagram.com/rugbyleaguetakeover?igsh=MTY1d3lkaWs1NDhnaw==",
  social_tiktok_url: "https://www.tiktok.com/@nrl_las_vegas?_r=1&_t=ZS-96zem8W4clw",
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
  contact_email: "",
  countdown_enabled: true,
  countdown_title: "The takeover begins in",
  countdown_subtitle: "Las Vegas • NRL Takeover",
  countdown_date: "",
  countdown_cta_label: "",
  countdown_cta_url: ""
};



/* ─── Image Preview Thumbnail ──────────────────────────────── */
function ImagePreview({ url, alt }) {
  const [error, setError] = useState(false);
  useEffect(() => {
    setError(false);
  }, [url]);
  if (!url || error) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative md:col-span-2 overflow-hidden border border-border/40 bg-muted/10 p-2"
    >
      <div className="flex items-center gap-2 mb-2">
        <ImageIcon className="h-3 w-3 text-slate-300" />
        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-200 font-mono">Live Preview</span>
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
      <Film className="h-3.5 w-3.5 text-primary" />
      <span className="text-[9px] font-mono text-slate-300">
        {count} video{count !== 1 ? "s" : ""} in rotation
      </span>
      {count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 cmd-blink ml-auto" />}
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────── */
export default function SiteSettingsManager({ settings }) {
  const [draft, setDraft] = useState({ ...defaults, ...(settings || {}) });
  const [activeCategory, setActiveCategory] = useState("overview");
  const [saveFlash, setSaveFlash] = useState(false);
  const queryClient = useQueryClient();

  /* ── Dirty-state tracking ──────────────────────────────── */
  const savedRef = useRef(JSON.stringify({ ...defaults, ...(settings || {}) }));
  const isDirty = useMemo(
    () => JSON.stringify(draft) !== savedRef.current,
    [draft]
  );

  useEffect(() => {
    const merged = { ...defaults, ...(settings || {}) };
    setDraft(merged);
    savedRef.current = JSON.stringify(merged);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data) => data.id ? base44.entities.SiteSettings.update(data.id, data) : base44.entities.SiteSettings.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["siteSettings"] });
      savedRef.current = JSON.stringify(draft);
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 2000);
      
      window.dispatchEvent(new CustomEvent("rlt_admin_log", {
        detail: {
          type: "success",
          text: `[SETTING-UPDATE] Configuration saved successfully. Site Name: "${draft.site_name || 'Takeover'}"`
        }
      }));
    },
  });

  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const videoText = (draft.background_video_urls || []).join("\n");

  /* ── Unsaved changes guard (browser close/reload) ────── */
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  /* Helper: detect if a field has been customised vs defaults */
  const isCustom = (field) => {
    if (!settings) return false;
    return settings[field] !== undefined && settings[field] !== defaults[field];
  };

  const categories = [
    {
      id: "hero",
      title: "Brand & Hero",
      desc: "Upload logo, main headings, descriptions, and hero buttons on the landing view.",
      icon: Type,
      summary: isCustom("site_logo_url") ? "Logo: Custom" : "Logo: Default",
    },
    {
      id: "countdown",
      title: "Countdown Timer",
      desc: "Live countdown timer settings, target start dates, heading text, and custom CTA links.",
      icon: Timer,
      summary: draft.countdown_enabled !== false ? "Live: Enabled" : "Live: Disabled",
    },
    {
      id: "media",
      title: "Background Media",
      desc: "Manage homepage rotating video backgrounds, URLs, and direct file uploads.",
      icon: Film,
      summary: `${(draft.background_video_urls || []).length} Video(s)`,
    },
    {
      id: "sections",
      title: "News, Travel & Merch Copy",
      desc: "Configure eyebrows, titles, and body texts for content feed modules.",
      icon: Newspaper,
      summary: `Title: "${draft.news_title || ""}"`,
    },
    {
      id: "about",
      title: "About & Registration",
      desc: "Edit about statements, captions, imagery uploads, and registry descriptions.",
      icon: Users,
      summary: `Headline: "${draft.about_title || ""}"`,
    },
    {
      id: "footer",
      title: "Footer, Socials & Attribution",
      desc: "Copyright lines, social profile links, attribution brand labels, and powered-by text.",
      icon: PanelBottom,
      summary: `Socials + powered by: ${draft.footer_powered_by || "None"}`,
    },
  ];

  const handleBackToOverview = () => {
    setActiveCategory("overview");
  };

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {activeCategory === "overview" ? (
          /* ─── Dashboard Overview Grid ─── */
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="grid gap-5"
          >
            {/* Header section card */}
            <div className="border border-border/60 bg-card/60 p-5 cmd-glass relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Settings className="h-28 w-28 text-primary" />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-4 w-4 text-primary" />
                <span className="text-[9px] font-bold uppercase tracking-[0.35em] text-primary font-mono">Control Centre</span>
              </div>
              <h2 className="font-display text-2xl md:text-3xl uppercase leading-none tracking-wide text-foreground">
                Website Configuration Room
              </h2>
              <p className="mt-2 max-w-2xl text-xs text-slate-300 leading-relaxed">
                Click on any of the configuration modules below to customize logos, backgrounds, countdown timers, and sections copy across the public site.
              </p>
            </div>

            {/* Grid modules list */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c, i) => {
                const Icon = c.icon;
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setActiveCategory(c.id)}
                    className="group border border-border bg-card/40 cmd-glass p-5 flex flex-col justify-between hover:border-primary/30 transition-all duration-300 cursor-pointer hover:shadow-[0_0_15px_rgba(249,115,22,0.05)] relative overflow-hidden"
                  >
                    {/* Tiny scan overlay on hover */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent cmd-scan-line" />
                    </div>

                    {/* Glass glare sweep overlay */}
                    <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent skew-x-[-25deg] -translate-x-[150%] transition-transform duration-1000 group-hover:translate-x-[250%] pointer-events-none" />

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2 border border-border/60 bg-muted/20 text-slate-300 group-hover:text-primary group-hover:border-primary/20 transition-all">
                          <Icon className="h-5 w-5 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6" />
                        </div>
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-primary/60 bg-primary/5 px-2 py-0.5 border border-primary/10">
                          {c.summary}
                        </span>
                      </div>
                      <h3 className="font-display text-base uppercase tracking-wide text-foreground group-hover:text-primary transition-colors">
                        {c.title}
                      </h3>
                      <p className="mt-1.5 text-xs text-slate-300 leading-normal line-clamp-3">
                        {c.desc}
                      </p>
                    </div>

                    <div className="mt-5 border-t border-border/30 pt-3 flex items-center justify-between">
                      <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-slate-400 group-hover:text-slate-200 transition-colors">Configure Module</span>
                      <ChevronLeft className="h-3.5 w-3.5 rotate-180 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          /* ─── Editor View Layout (Split Nav + Content Area) ─── */
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-4"
          >
            {/* Header path + Back link */}
            <div className="flex flex-wrap items-center justify-between gap-3 border border-border/50 bg-secondary/15 p-4 cmd-glass">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBackToOverview}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-foreground transition-colors border border-border/60 bg-muted/15 px-2.5 py-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Back to Dashboard
                </button>
                <span className="text-[10px] text-slate-500">/</span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300">Editor</span>
                <span className="text-[10px] text-slate-500">/</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary font-mono">
                  {categories.find((c) => c.id === activeCategory)?.title}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[8px] font-mono text-slate-400">
                <LayoutGrid className="h-3 w-3" /> Grid editor active
              </div>
            </div>

            {/* Split side navigation + Form container */}
            <div className="grid gap-5 md:grid-cols-[200px_1fr]">
              {/* Desktop Side Navigation */}
              <aside className="hidden md:flex flex-col gap-1 border-r border-border/60 pr-4">
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-300 mb-2 px-2.5">Modules</span>
                {categories.map((c) => {
                  const Icon = c.icon;
                  const isCurrent = c.id === activeCategory;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveCategory(c.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider transition-all duration-200 border-l-2 ${
                        isCurrent
                          ? "bg-primary/10 text-foreground border-primary"
                          : "text-slate-300 border-transparent hover:text-foreground hover:bg-muted/10"
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${isCurrent ? "text-primary" : "text-slate-400"}`} />
                      <span className="truncate">{c.title}</span>
                    </button>
                  );
                })}
              </aside>

              {/* Form editing pane */}
              <div className="border border-border/60 bg-card/35 p-5 md:p-6 cmd-glass min-h-[300px] flex flex-col justify-between">
                <div>
                  {activeCategory === "hero" && (
                    <div className="space-y-4">
                      <div className="border-b border-border/30 pb-2 mb-2">
                        <h3 className="font-display text-lg uppercase text-primary">Brand and Hero Settings</h3>
                        <p className="text-[10px] text-muted-foreground">Adjust branding assets and the initial landing section of the homepage.</p>
                      </div>

                      {/* ── Eyebrow visibility toggle ── */}
                      <div className="flex items-center justify-between border border-primary/30 bg-primary/5 p-4">
                        <div>
                          <p className="text-sm font-bold text-foreground">Show eyebrow text</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            The small line above the hero title — e.g. "Built by fans, for fans"
                          </p>
                        </div>
                        <Switch checked={draft.hero_eyebrow_visible !== false} onCheckedChange={(value) => update("hero_eyebrow_visible", value)} />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <LabeledField label="Logo URL" help="Direct URL to your site logo image." indicator={isCustom("site_logo_url") ? "custom" : "default"}>
                          <Input placeholder="https://example.com/logo.png" value={draft.site_logo_url || ""} onChange={(e) => update("site_logo_url", e.target.value)} />
                        </LabeledField>
                        <div className="flex flex-col justify-end">
                          <MediaUploader label="Upload logo" accept="image/*" onUploaded={(url) => update("site_logo_url", url)} />
                        </div>
                      </div>
                      <ImagePreview url={draft.site_logo_url} alt="Site logo" />
                      <div className="grid gap-4 md:grid-cols-2">
                        <LabeledField label="Hero Eyebrow" help="Small text above the main heading.">
                          <Input placeholder="Las Vegas • Rugby League" value={draft.hero_eyebrow || ""} onChange={(e) => update("hero_eyebrow", e.target.value)} />
                        </LabeledField>

                        <LabeledField label="Hero Button Label" help="Call-to-action button text.">
                          <Input placeholder="Enter the site" value={draft.hero_button_label || ""} onChange={(e) => update("hero_button_label", e.target.value)} />
                        </LabeledField>
                      </div>
                      <LabeledField label="Hero Title" help="Use line breaks to split across multiple lines." fullWidth>
                        <Textarea placeholder="The annual&#10;Vegas takeover" value={draft.hero_title || ""} onChange={(e) => update("hero_title", e.target.value)} className="min-h-24" />
                      </LabeledField>
                      <LabeledField label="Hero Description" help="Supporting paragraph below the title." fullWidth>
                        <Textarea placeholder="Join the world's most passionate supporter groups..." value={draft.hero_description || ""} onChange={(e) => update("hero_description", e.target.value)} className="min-h-24" />
                      </LabeledField>
                    </div>
                  )}

                  {activeCategory === "countdown" && (
                    <div className="space-y-4">
                      <div className="border-b border-border/30 pb-2 mb-2">
                        <h3 className="font-display text-lg uppercase text-primary">Countdown Timer Settings</h3>
                        <p className="text-[10px] text-muted-foreground">Configure the live countdown timer on the homepage.</p>
                      </div>
                      <div className="flex items-center justify-between border border-border/60 bg-muted/10 p-3.5 transition-colors hover:border-border">
                        <div className="flex items-center gap-2.5">
                          <div className={`h-2 w-2 rounded-full ${draft.countdown_enabled !== false ? "bg-emerald-400 cmd-blink" : "bg-muted-foreground/40"}`} />
                          <span className="text-xs font-bold uppercase tracking-wider text-foreground">Show countdown on homepage</span>
                        </div>
                        <Switch checked={draft.countdown_enabled !== false} onCheckedChange={(value) => update("countdown_enabled", value)} />
                      </div>
                      {draft.countdown_enabled !== false && (
                        <div className="grid gap-4 md:grid-cols-2">
                          <LabeledField label="Takeover start date & time" help="The moment the countdown reaches zero.">
                            <DateTimePicker value={draft.countdown_date || ""} onChange={(val) => update("countdown_date", val)} placeholder="Pick the takeover date & time" />
                          </LabeledField>
                          <LabeledField label="Heading" help="Text shown above the countdown digits.">
                            <Input placeholder="The takeover begins in" value={draft.countdown_title || ""} onChange={(e) => update("countdown_title", e.target.value)} />
                          </LabeledField>
                          <LabeledField label="Subtitle" fullWidth help="Secondary text beneath the heading.">
                            <Input placeholder="Las Vegas • Allegiant Stadium" value={draft.countdown_subtitle || ""} onChange={(e) => update("countdown_subtitle", e.target.value)} />
                          </LabeledField>
                          <LabeledField label="Button Label" help="Optional CTA button.">
                            <Input placeholder="Register now" value={draft.countdown_cta_label || ""} onChange={(e) => update("countdown_cta_label", e.target.value)} />
                          </LabeledField>
                          <LabeledField label="Button Link" help="URL for the CTA button." fullWidth>
                            <Input placeholder="https://..." value={draft.countdown_cta_url || ""} onChange={(e) => update("countdown_cta_url", e.target.value)} />
                          </LabeledField>
                        </div>
                      )}
                    </div>
                  )}

                  {activeCategory === "media" && (
                    <div className="space-y-4">
                      <div className="border-b border-border/30 pb-2 mb-2">
                        <h3 className="font-display text-lg uppercase text-primary">Homepage Background Videos</h3>
                        <p className="text-[10px] text-muted-foreground">Manage background video rotation URLs and direct file uploads.</p>
                      </div>
                      <LabeledField label="Video URLs" help="One URL per line. Videos rotate automatically on the homepage." fullWidth>
                        <Textarea value={videoText} onChange={(e) => update("background_video_urls", e.target.value.split("\n").map((url) => url.trim()).filter(Boolean))} className="min-h-28 font-mono text-xs" />
                      </LabeledField>
                      <VideoCountBadge count={(draft.background_video_urls || []).length} />
                      <div className="mt-3">
                        <MediaUploader label="Upload background video" accept="video/*" onUploaded={(url) => update("background_video_urls", [...(draft.background_video_urls || []), url])} />
                      </div>
                    </div>
                  )}

                  {activeCategory === "sections" && (
                    <div className="space-y-4">
                      <div className="border-b border-border/30 pb-2 mb-2">
                        <h3 className="font-display text-lg uppercase text-primary">Homepage Sections Copy</h3>
                        <p className="text-[10px] text-muted-foreground">Change the title texts and descriptions for public modules.</p>
                      </div>
                      {/* News */}
                      <div className="flex items-center gap-2 px-3 py-2 border-l-2 border-primary/40 bg-primary/5">
                        <Captions className="h-3 w-3 text-primary" />
                        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-primary">News</span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <LabeledField label="News Eyebrow">
                          <Input placeholder="Latest News" value={draft.news_eyebrow || ""} onChange={(e) => update("news_eyebrow", e.target.value)} />
                        </LabeledField>
                        <LabeledField label="News Title">
                          <Input placeholder="From the strip" value={draft.news_title || ""} onChange={(e) => update("news_title", e.target.value)} />
                        </LabeledField>
                      </div>
                      <LabeledField label="News Description" fullWidth>
                        <Textarea placeholder="Fresh updates and announcements..." value={draft.news_description || ""} onChange={(e) => update("news_description", e.target.value)} />
                      </LabeledField>

                      {/* Travel */}
                      <div className="flex items-center gap-2 px-3 py-2 border-l-2 border-accent/40 bg-accent/5 mt-4">
                        <Plane className="h-3 w-3 text-accent" />
                        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-accent">Travel</span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <LabeledField label="Travel Eyebrow">
                          <Input placeholder="Travel Packages" value={draft.travel_eyebrow || ""} onChange={(e) => update("travel_eyebrow", e.target.value)} />
                        </LabeledField>
                        <LabeledField label="Travel Title">
                          <Input placeholder="Your Vegas base camp" value={draft.travel_title || ""} onChange={(e) => update("travel_title", e.target.value)} />
                        </LabeledField>
                      </div>
                      <LabeledField label="Travel Description" fullWidth>
                        <Textarea placeholder="Air, accommodation, events and more..." value={draft.travel_description || ""} onChange={(e) => update("travel_description", e.target.value)} />
                      </LabeledField>

                      {/* Merch */}
                      <div className="flex items-center gap-2 px-3 py-2 border-l-2 border-emerald-500/40 bg-emerald-500/5 mt-4">
                        <ShoppingBag className="h-3 w-3 text-emerald-400" />
                        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-400">Merch</span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <LabeledField label="Merch Eyebrow">
                          <Input placeholder="Merch" value={draft.merch_eyebrow || ""} onChange={(e) => update("merch_eyebrow", e.target.value)} />
                        </LabeledField>
                        <LabeledField label="Merch Title">
                          <Input placeholder="Wear the takeover" value={draft.merch_title || ""} onChange={(e) => update("merch_title", e.target.value)} />
                        </LabeledField>
                      </div>
                      <LabeledField label="Merch Description" fullWidth>
                        <Textarea placeholder="Browse official merch and checkout securely..." value={draft.merch_description || ""} onChange={(e) => update("merch_description", e.target.value)} />
                      </LabeledField>
                    </div>
                  )}

                  {activeCategory === "about" && (
                    <div className="space-y-4">
                      <div className="border-b border-border/30 pb-2 mb-2">
                        <h3 className="font-display text-lg uppercase text-primary">About Us & Registrations</h3>
                        <p className="text-[10px] text-muted-foreground">Modify details about the organization and support forms.</p>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 border-l-2 border-primary/40 bg-primary/5">
                        <FileText className="h-3 w-3 text-primary" />
                        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-primary">About Us</span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <LabeledField label="About Eyebrow">
                          <Input placeholder="About Us" value={draft.about_eyebrow || ""} onChange={(e) => update("about_eyebrow", e.target.value)} />
                        </LabeledField>
                        <LabeledField label="About Title">
                          <Input placeholder="Built by fans, for fans" value={draft.about_title || ""} onChange={(e) => update("about_title", e.target.value)} />
                        </LabeledField>
                      </div>
                      <LabeledField label="About Description" fullWidth>
                        <Textarea placeholder="Rugby League Takeover Las Vegas brings together..." value={draft.about_description || ""} onChange={(e) => update("about_description", e.target.value)} />
                      </LabeledField>
                      <LabeledField label="About Body" fullWidth help="Extended paragraph content for the about section.">
                        <Textarea placeholder="Expect flags, chants, mateship..." value={draft.about_body || ""} onChange={(e) => update("about_body", e.target.value)} className="min-h-24" />
                      </LabeledField>
                      <div className="grid gap-3 md:grid-cols-2">
                        <LabeledField label="About Highlight" help="Pullout quote or key message.">
                          <Input placeholder="Join the world's most passionate..." value={draft.about_highlight || ""} onChange={(e) => update("about_highlight", e.target.value)} />
                        </LabeledField>
                        <LabeledField label="Image Caption">
                          <Input placeholder="Las Vegas will hear us." value={draft.about_image_caption || ""} onChange={(e) => update("about_image_caption", e.target.value)} />
                        </LabeledField>
                      </div>
                      <LabeledField label="About Image" help="Upload an image or paste a URL." indicator={isCustom("about_image_url") ? "custom" : "default"} fullWidth>
                        <ImageField value={draft.about_image_url || ""} onChange={(url) => update("about_image_url", url)} />
                      </LabeledField>

                      <div className="flex items-center gap-2 px-3 py-2 border-l-2 border-accent/40 bg-accent/5 mt-4">
                        <Quote className="h-3 w-3 text-accent" />
                        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-accent">Registration</span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <LabeledField label="Registration Eyebrow">
                          <Input placeholder="Register interest" value={draft.registration_eyebrow || ""} onChange={(e) => update("registration_eyebrow", e.target.value)} />
                        </LabeledField>
                        <LabeledField label="Registration Title">
                          <Input placeholder="Don't miss the drop." value={draft.registration_title || ""} onChange={(e) => update("registration_title", e.target.value)} />
                        </LabeledField>
                      </div>
                      <LabeledField label="Registration Description" fullWidth>
                        <Textarea placeholder="Leave your details and the team will contact you..." value={draft.registration_description || ""} onChange={(e) => update("registration_description", e.target.value)} />
                      </LabeledField>
                    </div>
                  )}

                  {activeCategory === "footer" && (
                    <div className="space-y-4">
                      <div className="border-b border-border/30 pb-2 mb-2">
                        <h3 className="font-display text-lg uppercase text-primary">Footer and Copyright</h3>
                        <p className="text-[10px] text-muted-foreground">Adjust labels displayed at the bottom of public pages.</p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <LabeledField label="Footer Text" help="Displayed in the site footer." indicator={isCustom("footer_text") ? "custom" : "default"}>
                          <Input placeholder="Rugby League Takeover Las Vegas © 2026" value={draft.footer_text || ""} onChange={(e) => update("footer_text", e.target.value)} />
                        </LabeledField>
                        <LabeledField label="Powered By" help="Attribution line.">
                          <Input placeholder="DENEO.AI" value={draft.footer_powered_by || ""} onChange={(e) => update("footer_powered_by", e.target.value)} />
                        </LabeledField>
                        <LabeledField label="Contact Email" help="Shown in the footer for visitor inquiries." fullWidth>
                          <Input placeholder="admin@rugbyleaguetakeover.com" value={draft.contact_email || ""} onChange={(e) => update("contact_email", e.target.value)} />
                        </LabeledField>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 border-l-2 border-primary/40 bg-primary/5 mt-4">
                        <Users className="h-3 w-3 text-primary" />
                        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-primary">Social Links</span>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <LabeledField label="Facebook URL" help="Shown in the homepage social blocks.">
                          <Input placeholder="https://facebook.com/..." value={draft.social_facebook_url || ""} onChange={(e) => update("social_facebook_url", e.target.value)} />
                        </LabeledField>
                        <LabeledField label="Instagram URL" help="Shown below the Facebook link.">
                          <Input placeholder="https://instagram.com/..." value={draft.social_instagram_url || ""} onChange={(e) => update("social_instagram_url", e.target.value)} />
                        </LabeledField>
                        <LabeledField label="TikTok URL" help="Shown below the Facebook link.">
                          <Input placeholder="https://tiktok.com/@..." value={draft.social_tiktok_url || ""} onChange={(e) => update("social_tiktok_url", e.target.value)} />
                        </LabeledField>
                        <LabeledField label="Facebook fan count" help="The figure on the 'Meet the travelling crowd' card. Keep it current (e.g. 16.8k).">
                          <Input placeholder="16.8k" value={draft.facebook_fans || ""} onChange={(e) => update("facebook_fans", e.target.value)} />
                        </LabeledField>
                      </div>

                      <div className="mt-6 border-t border-border/30 pt-5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">Legal pages (footer)</p>
                        <div className="grid gap-4">
                          <LabeledField label="Terms & Conditions" help="Shown at /terms. Leave blank to use the built-in starter text. Blank lines = new paragraph; wrap a line in [brackets] for a heading." fullWidth>
                            <Textarea placeholder="Your Terms & Conditions…" value={draft.legal_terms || ""} onChange={(e) => update("legal_terms", e.target.value)} className="min-h-40" />
                          </LabeledField>
                          <LabeledField label="Privacy Policy" help="Shown at /privacy. Same formatting rules as above." fullWidth>
                            <Textarea placeholder="Your Privacy Policy…" value={draft.legal_privacy || ""} onChange={(e) => update("legal_privacy", e.target.value)} className="min-h-40" />
                          </LabeledField>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Sticky Save Bar ─────────────────────────── */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="mt-8 border-t border-border/30 pt-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {isDirty && (
                      <div className="flex items-center gap-2 rounded-sm border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 sm:order-first">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Unsaved changes</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${saveMutation.isPending ? "bg-accent cmd-pulse" : saveFlash ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/40"}`} />
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          {saveFlash ? "Settings saved successfully!" : "Preview the public site after saving to check your changes."}
                        </p>
                        <p className="text-[9px] text-muted-foreground font-mono mt-0.5">
                          Changes deploy instantly to the live site
                        </p>
                      </div>
                    </div>

                    <AdminStickyActionBar className="sm:min-w-52">
                      <Button
                        onClick={() => saveMutation.mutate(draft)}
                        disabled={saveMutation.isPending}
                        size="mobile"
                        className="col-span-2 rounded-none bg-primary font-bold uppercase tracking-wider text-white transition-all duration-200 hover:bg-primary/90 hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
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
                            Save Changes
                          </>
                        )}
                      </Button>
                    </AdminStickyActionBar>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}