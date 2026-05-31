import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AdminSection from "./AdminSection";
import FieldGroup from "./FieldGroup";
import MediaUploader from "./MediaUploader";

const defaults = {
  site_logo_url: "https://media.base44.com/images/public/6a18d49a2b8f40f0f81cc26e/390eddc5d_Untitled-31May2026at093306.png",
  hero_eyebrow: "Las Vegas • Rugby League • Supporter Takeover",
  hero_title: "The annual\nVegas takeover",
  hero_description: "Join the world’s most passionate and loyal Rugby League supporter groups for an unforgettable global footy invasion of Las Vegas.",
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
  about_highlight: "Join the world’s most passionate Rugby League supporter groups.",
  about_image_url: "https://images.unsplash.com/photo-1569959220744-ff553533f492?auto=format&fit=crop&w=1400&q=80",
  about_image_caption: "Las Vegas will hear us.",
  travel_eyebrow: "Travel Packages",
  travel_title: "Your Vegas base camp",
  travel_description: "Air, accommodation, events and more are coming soon. Register your interest to be first in line.",
  registration_eyebrow: "Register interest",
  registration_title: "Don’t miss the drop.",
  registration_description: "Leave your details and the team will contact you when packages go live.",
  merch_eyebrow: "Merch",
  merch_title: "Wear the takeover",
  merch_description: "Browse official Rugby League Takeover merch and checkout securely in AUD.",
  footer_text: "Rugby League Takeover Las Vegas © 2026",
  footer_powered_by: "DENEO.AI"
};

export default function SiteSettingsManager({ settings }) {
  const [draft, setDraft] = useState({ ...defaults, ...(settings || {}) });
  const queryClient = useQueryClient();

  useEffect(() => {
    setDraft({ ...defaults, ...(settings || {}) });
  }, [settings?.id]);

  const saveMutation = useMutation({
    mutationFn: (data) => data.id ? base44.entities.SiteSettings.update(data.id, data) : base44.entities.SiteSettings.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["siteSettings"] }),
  });

  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const videoText = (draft.background_video_urls || []).join("\n");

  return (
    <AdminSection id="site-settings" eyebrow="Step 1" title="Website settings" description="Edit homepage wording, logo, images, videos and footer content. Changes save to the live site after pressing Save.">
      <div className="grid gap-5">
        <FieldGroup title="Brand and hero" help="Use line breaks in the hero title if you want the heading split across lines.">
          <Input placeholder="Logo URL" value={draft.site_logo_url || ""} onChange={(e) => update("site_logo_url", e.target.value)} className="rounded-none" />
          <MediaUploader label="Upload logo" accept="image/*" onUploaded={(url) => update("site_logo_url", url)} />
          <Input placeholder="Hero eyebrow" value={draft.hero_eyebrow || ""} onChange={(e) => update("hero_eyebrow", e.target.value)} className="rounded-none" />
          <Input placeholder="Hero button label" value={draft.hero_button_label || ""} onChange={(e) => update("hero_button_label", e.target.value)} className="rounded-none" />
          <Textarea placeholder="Hero title" value={draft.hero_title || ""} onChange={(e) => update("hero_title", e.target.value)} className="min-h-24 rounded-none md:col-span-2" />
          <Textarea placeholder="Hero description" value={draft.hero_description || ""} onChange={(e) => update("hero_description", e.target.value)} className="min-h-24 rounded-none md:col-span-2" />
        </FieldGroup>

        <FieldGroup title="Homepage background videos" help="Paste one video URL per line, or upload videos below and they will be added to the rotation.">
          <Textarea value={videoText} onChange={(e) => update("background_video_urls", e.target.value.split("\n").map((url) => url.trim()).filter(Boolean))} className="min-h-28 rounded-none md:col-span-2" />
          <MediaUploader label="Upload background video" accept="video/*" onUploaded={(url) => update("background_video_urls", [...(draft.background_video_urls || []), url])} />
        </FieldGroup>

        <FieldGroup title="News, travel and merch section copy">
          <Input placeholder="News eyebrow" value={draft.news_eyebrow || ""} onChange={(e) => update("news_eyebrow", e.target.value)} className="rounded-none" />
          <Input placeholder="News title" value={draft.news_title || ""} onChange={(e) => update("news_title", e.target.value)} className="rounded-none" />
          <Textarea placeholder="News description" value={draft.news_description || ""} onChange={(e) => update("news_description", e.target.value)} className="rounded-none md:col-span-2" />
          <Input placeholder="Travel eyebrow" value={draft.travel_eyebrow || ""} onChange={(e) => update("travel_eyebrow", e.target.value)} className="rounded-none" />
          <Input placeholder="Travel title" value={draft.travel_title || ""} onChange={(e) => update("travel_title", e.target.value)} className="rounded-none" />
          <Textarea placeholder="Travel description" value={draft.travel_description || ""} onChange={(e) => update("travel_description", e.target.value)} className="rounded-none md:col-span-2" />
          <Input placeholder="Merch eyebrow" value={draft.merch_eyebrow || ""} onChange={(e) => update("merch_eyebrow", e.target.value)} className="rounded-none" />
          <Input placeholder="Merch title" value={draft.merch_title || ""} onChange={(e) => update("merch_title", e.target.value)} className="rounded-none" />
          <Textarea placeholder="Merch description" value={draft.merch_description || ""} onChange={(e) => update("merch_description", e.target.value)} className="rounded-none md:col-span-2" />
        </FieldGroup>

        <FieldGroup title="About section and registration form">
          <Input placeholder="About eyebrow" value={draft.about_eyebrow || ""} onChange={(e) => update("about_eyebrow", e.target.value)} className="rounded-none" />
          <Input placeholder="About title" value={draft.about_title || ""} onChange={(e) => update("about_title", e.target.value)} className="rounded-none" />
          <Textarea placeholder="About description" value={draft.about_description || ""} onChange={(e) => update("about_description", e.target.value)} className="rounded-none md:col-span-2" />
          <Textarea placeholder="About body" value={draft.about_body || ""} onChange={(e) => update("about_body", e.target.value)} className="rounded-none md:col-span-2" />
          <Input placeholder="About highlight" value={draft.about_highlight || ""} onChange={(e) => update("about_highlight", e.target.value)} className="rounded-none" />
          <Input placeholder="About image caption" value={draft.about_image_caption || ""} onChange={(e) => update("about_image_caption", e.target.value)} className="rounded-none" />
          <Input placeholder="About image URL" value={draft.about_image_url || ""} onChange={(e) => update("about_image_url", e.target.value)} className="rounded-none" />
          <MediaUploader label="Upload about image" accept="image/*" onUploaded={(url) => update("about_image_url", url)} />
          <Input placeholder="Registration eyebrow" value={draft.registration_eyebrow || ""} onChange={(e) => update("registration_eyebrow", e.target.value)} className="rounded-none" />
          <Input placeholder="Registration title" value={draft.registration_title || ""} onChange={(e) => update("registration_title", e.target.value)} className="rounded-none" />
          <Textarea placeholder="Registration description" value={draft.registration_description || ""} onChange={(e) => update("registration_description", e.target.value)} className="rounded-none md:col-span-2" />
        </FieldGroup>

        <FieldGroup title="Footer">
          <Input placeholder="Footer text" value={draft.footer_text || ""} onChange={(e) => update("footer_text", e.target.value)} className="rounded-none" />
          <Input placeholder="Powered by" value={draft.footer_powered_by || ""} onChange={(e) => update("footer_powered_by", e.target.value)} className="rounded-none" />
        </FieldGroup>

        <div className="flex flex-col gap-3 border border-primary/40 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">Preview the public site after saving to check your changes.</p>
          <Button onClick={() => saveMutation.mutate(draft)} disabled={saveMutation.isPending} className="rounded-none bg-primary hover:bg-primary/90">
            <Save className="mr-2 h-4 w-4" /> {saveMutation.isPending ? "Saving..." : "Save Website Settings"}
          </Button>
        </div>
      </div>
    </AdminSection>
  );
}