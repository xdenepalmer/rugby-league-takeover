import React from "react";

export default function AdminSection({ id, eyebrow, title, description, children }) {
  return (
    <section id={id} className="scroll-mt-28 border border-border bg-card p-6">
      <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl uppercase leading-none md:text-5xl">{title}</h2>
      {description && <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}