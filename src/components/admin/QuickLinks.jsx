import React from "react";

const links = [
  ["Handover", "#handover-admin"],
  ["Setup", "#site-settings"],
  ["Products", "#products-admin"],
  ["Orders", "#orders-admin"],
  ["Travel", "#travel-admin"],
  ["News", "#news-admin"],
  ["Events", "#events-admin"],
  ["Registrations", "#registrations-admin"],
  ["Forum", "#forum-admin"],
  ["Preview", "#preview"],
];

export default function QuickLinks() {
  return (
    <nav className="sticky top-0 z-40 -mx-5 border-b border-border bg-background/95 px-5 py-3 backdrop-blur md:-mx-8 md:px-8">
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto">
        {links.map(([label, href]) => (
          <a key={href} href={href} className="whitespace-nowrap border border-border px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground transition hover:border-primary hover:text-foreground">
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}