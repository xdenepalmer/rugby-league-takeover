import React from "react";
import { Eye, Newspaper, Package, ShoppingBag, Users } from "lucide-react";

const items = [
  { key: "settings", label: "Brand, homepage copy and media", icon: Eye },
  { key: "news", label: "News articles", icon: Newspaper },
  { key: "travel", label: "Travel packages and registrations", icon: Package },
  { key: "store", label: "Merch products and orders", icon: ShoppingBag },
  { key: "community", label: "Forum moderation", icon: Users },
];

export default function AdminOverview({ counts }) {
  return (
    <section className="border border-border bg-card p-6">
      <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">Handover control centre</p>
      <div className="mt-4 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
        <div>
          <h2 className="font-display text-5xl uppercase leading-none">Manage everything without code</h2>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">Use the sections below from top to bottom: update brand and homepage content, manage media, publish news, edit travel packages, review registrations, process orders, and moderate the forum.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="flex items-center gap-3 border border-border bg-background/60 p-4">
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold text-foreground">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-5">
        {[
          ["News", counts.news],
          ["Products", counts.products],
          ["Orders", counts.orders],
          ["Registrations", counts.registrations],
          ["Forum posts", counts.posts],
        ].map(([label, count]) => (
          <div key={label} className="border border-border p-4">
            <p className="font-display text-4xl leading-none text-foreground">{count}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}