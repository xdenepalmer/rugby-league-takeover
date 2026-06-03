import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Handshake } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import SectionHeader from "./SectionHeader";

const defaultPartners = [
  {
    id: "default-rw",
    name: "Resorts World Las Vegas",
    logo_url: "",
    url: "https://www.rwlasvegas.com/",
    description: "Official resort partner & fan headquarters.",
    sort_order: 1,
    is_published: true
  },
  {
    id: "default-stadium",
    name: "Allegiant Stadium",
    logo_url: "",
    url: "https://www.allegiantstadium.com/",
    description: "Match day venue for the NRL Takeover.",
    sort_order: 2,
    is_published: true
  },
  {
    id: "default-swim",
    name: "Stadium Swim at Circa",
    logo_url: "",
    url: "https://www.circalasvegas.com/stadium-swim/",
    description: "Official pre-match pool party venue.",
    sort_order: 3,
    is_published: true
  },
  {
    id: "default-vegas",
    name: "Vegas.com",
    logo_url: "",
    url: "https://www.vegas.com/",
    description: "Official travel booking partner.",
    sort_order: 4,
    is_published: true
  }
];

function PartnerLogoPlaceholder({ name, id }) {
  const normName = String(name || "").toLowerCase();
  const normId = String(id || "").toLowerCase();

  // Resorts World Las Vegas
  if (normId.includes("rw") || normName.includes("resort") || normName.includes("world")) {
    return (
      <svg className="h-16 w-full max-w-[160px] drop-shadow-[0_0_8px_rgba(245,158,11,0.3)] transition-all duration-300 group-hover:scale-105" viewBox="0 0 120 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="rw-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>
        <path d="M60 5 L68 21 L84 21 L71 31 L75 45 L60 36 L45 45 L49 31 L36 21 L52 21 Z" fill="url(#rw-gold)" />
        <circle cx="60" cy="22" r="2.5" fill="#ef4444" className="animate-pulse" />
        <rect x="25" y="44" width="70" height="1.5" fill="#fbbf24" opacity="0.6" />
      </svg>
    );
  }

  // Allegiant Stadium
  if (normId.includes("stadium") || normName.includes("allegiant")) {
    return (
      <svg className="h-16 w-full max-w-[160px] drop-shadow-[0_0_8px_rgba(249,115,22,0.3)] transition-all duration-300 group-hover:scale-105" viewBox="0 0 120 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="stadium-neon" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
        </defs>
        <ellipse cx="60" cy="25" rx="38" ry="16" fill="#171717" stroke="#374151" strokeWidth="2" />
        <ellipse cx="60" cy="25" rx="34" ry="12" fill="none" stroke="url(#stadium-neon)" strokeWidth="1.5" strokeDasharray="14 3" />
        <ellipse cx="60" cy="25" rx="18" ry="5" fill="#065f46" opacity="0.5" />
        <path d="M26 25 C 26 14, 94 14, 94 25" stroke="#4b5563" strokeWidth="1.5" fill="none" />
      </svg>
    );
  }

  // Stadium Swim at Circa
  if (normId.includes("swim") || normName.includes("swim") || normName.includes("circa")) {
    return (
      <svg className="h-16 w-full max-w-[160px] drop-shadow-[0_0_8px_rgba(6,182,212,0.3)] transition-all duration-300 group-hover:scale-105" viewBox="0 0 120 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="swim-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <path d="M22 45 Q26 30 20 15 M20 15 Q28 12 32 18 M20 15 Q14 10 10 14" stroke="#047857" strokeWidth="1.5" fill="none" />
        <path d="M98 45 Q94 30 100 15 M100 15 Q92 12 88 18 M100 15 Q106 10 110 14" stroke="#047857" strokeWidth="1.5" fill="none" />
        <path d="M35 30 Q45 23 60 30 T85 30 L85 40 Q70 43 60 40 T35 40 Z" fill="url(#swim-cyan)" opacity="0.85" />
        <rect x="38" y="10" width="44" height="17" rx="1.5" fill="#111827" stroke="#06b6d4" strokeWidth="1" />
        <text x="60" y="21" textAnchor="middle" fill="#06b6d4" fontSize="6" fontWeight="bold" letterSpacing="1" className="font-mono">SWIM</text>
      </svg>
    );
  }

  // Vegas.com
  if (normId.includes("vegas") || normName.includes("vegas.com")) {
    return (
      <svg className="h-16 w-full max-w-[160px] drop-shadow-[0_0_8px_rgba(239,68,68,0.3)] transition-all duration-300 group-hover:scale-105" viewBox="0 0 120 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="vegas-red" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#b91c1c" />
          </linearGradient>
        </defs>
        <path d="M60 4 L96 25 L60 46 L24 25 Z" fill="#111827" stroke="#ef4444" strokeWidth="1.5" />
        <path d="M60 1 L62 7 L67 9 L62 11 L60 17 L58 11 L53 9 L58 7 Z" fill="#fbbf24" />
        <text x="60" y="27" textAnchor="middle" fill="#fbbf24" fontSize="7" fontWeight="bold" letterSpacing="1" className="font-sans">VEGAS</text>
        <line x1="36" y1="31" x2="84" y2="31" stroke="#fbbf24" strokeWidth="0.75" opacity="0.6" />
        <text x="60" y="39" textAnchor="middle" fill="#ffffff" fontSize="5" fontWeight="bold" letterSpacing="0.5" className="font-mono">.COM</text>
      </svg>
    );
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/5 p-2 text-primary transition-all duration-300 group-hover:bg-primary/10 group-hover:border-primary/40 group-hover:shadow-[0_0_12px_rgba(249,115,22,0.25)]">
      <Handshake className="h-6 w-6 text-primary animate-pulse" />
    </div>
  );
}

export default function PartnersSection({ settings = {} }) {
  const { data: partners = [] } = useQuery({
    queryKey: ["partners"],
    queryFn: () => base44.entities.Partner.list("sort_order", 200),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });

  const visible = partners.filter((p) => p.is_published !== false);
  const displayPartners = visible.length > 0 ? visible : defaultPartners;

  const Card = ({ partner }) => {
    const [imgError, setImgError] = React.useState(false);

    const inner = (
      <div className="group flex h-full flex-col items-center justify-center gap-3 border border-border bg-card p-6 text-center transition-all duration-300 hover:border-primary/50 hover:bg-neutral-950/40 hover:shadow-[0_0_20px_rgba(249,115,22,0.05)]">
        <div className="flex h-16 w-full items-center justify-center">
          {partner.logo_url && !imgError ? (
            <img
              src={partner.logo_url}
              alt={partner.name}
              loading="lazy"
              onError={() => setImgError(true)}
              className="h-16 w-full max-w-[160px] object-contain grayscale transition-all duration-300 group-hover:grayscale-0 group-hover:scale-105"
            />
          ) : (
            <PartnerLogoPlaceholder name={partner.name} id={partner.id} />
          )}
        </div>
        <p className="font-display text-lg uppercase leading-none text-foreground group-hover:text-primary transition-colors">{partner.name}</p>
        {partner.description && <p className="text-xs leading-5 text-muted-foreground/75">{partner.description}</p>}
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
          {displayPartners.map((partner, index) => <Card key={partner.id || index} partner={partner} />)}
        </div>
      </div>
    </section>
  );
}
