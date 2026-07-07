import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";

/**
 * Admin-editable legal page (Terms / Privacy). Content comes from SiteSettings
 * (`legal_terms` / `legal_privacy`) and falls back to the provided boilerplate
 * when an admin hasn't entered their own yet. Plain text — blank lines start a
 * new paragraph; lines wrapped in [Heading] render as a heading.
 */
export default function LegalPage({ settingsKey, title, fallback }) {
  const { data: settingsRecords = [] } = useQuery({
    queryKey: ["siteSettings"],
    queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });
  const settings = settingsRecords[0] || {};
  const content = (settings[settingsKey] || "").trim() || fallback;

  const blocks = content.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <main className="relative min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 pt-[calc(7.25rem+env(safe-area-inset-top,0px))] pb-20 md:px-8 md:pb-24">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-primary">Rugby League Takeover</p>
        <h1 className="mt-3 font-display text-3xl uppercase leading-none tracking-wide text-foreground md:text-5xl">{title}</h1>
        <div className="mt-8 space-y-4">
          {blocks.map((block, i) => {
            const heading = block.match(/^\[(.+)\]$/);
            if (heading) {
              return (
                <h2 key={i} className="pt-4 font-display text-lg uppercase tracking-wide text-foreground">{heading[1]}</h2>
              );
            }
            return (
              <p key={i} className="whitespace-pre-line text-sm leading-7 text-muted-foreground">{block}</p>
            );
          })}
        </div>
      </div>
    </main>
  );
}
