import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Handshake } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import SectionHeader from "./SectionHeader";

export default function PartnersSection({ settings = {} }) {
  const { data: partners = [] } = useQuery({
    queryKey: ["partners"],
    queryFn: () => base44.entities.Partner.list("sort_order", 200),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });

  const visible = partners.filter((p) => p.is_published !== false);
  if (visible.length === 0) return null;

  const Card = ({ partner }) => {
    const inner = (
      <div className="group flex h-full flex-col items-center justify-center gap-3 border border-border bg-card p-6 text-center transition-colors hover:border-primary">
        {partner.logo_url ? (
          <img src={partner.logo_url} alt={partner.name} className="h-16 w-full max-w-[160px] object-contain grayscale transition-all duration-300 group-hover:grayscale-0" />
        ) : (
          <Handshake className="h-10 w-10 text-muted-foreground" />
        )}
        <p className="font-display text-lg uppercase leading-none text-foreground">{partner.name}</p>
        {partner.description && <p className="text-xs leading-5 text-muted-foreground">{partner.description}</p>}
      </div>
    );
    return partner.url
      ? <a href={partner.url} target="_blank" rel="noreferrer" className="block h-full">{inner}</a>
      : <div className="h-full">{inner}</div>;
  };

  return (
    <section id="partners" className="border-t border-border bg-background/80 px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeader eyebrow={settings.partners_eyebrow || "Partners & Venues"} title={settings.partners_title || "Who we work with"}>
          {settings.partners_description || "The venues, brands and partners powering the Rugby League Takeover."}
        </SectionHeader>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((partner, index) => <Card key={partner.id || index} partner={partner} />)}
        </div>
      </div>
    </section>
  );
}
