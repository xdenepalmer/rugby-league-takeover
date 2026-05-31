import React from "react";

export default function FieldGroup({ title, help, children }) {
  return (
    <div className="border border-border bg-background/50 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-foreground">{title}</h3>
        {help && <p className="mt-1 text-xs leading-5 text-muted-foreground">{help}</p>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </div>
  );
}