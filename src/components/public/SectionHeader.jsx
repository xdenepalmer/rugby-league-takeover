import React from "react";

export default function SectionHeader({ eyebrow, title, children }) {
  return (
    <div className="mb-12 max-w-3xl">
      <div className="mb-4 flex items-center gap-4">
        <span className="h-px w-14 bg-primary" />
        <p className="text-xs font-bold uppercase tracking-[0.34em] text-primary">{eyebrow}</p>
      </div>
      <h2 className="font-display text-5xl uppercase leading-[0.88] tracking-tight text-foreground md:text-7xl">{title}</h2>
      {children && <p className="mt-6 text-lg leading-8 text-muted-foreground">{children}</p>}
    </div>
  );
}