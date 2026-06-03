import React from "react";

export default function LabeledField({ label, htmlFor, help, children, className = "", span2, fullWidth, indicator }) {
  return (
    <div className={`space-y-1.5 ${span2 || fullWidth ? "md:col-span-2" : ""} ${className}`}>
      {label && (
        <div className="flex items-center gap-2">
          <label htmlFor={htmlFor} className="block text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </label>
          {indicator && (
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.25 text-[7px] font-bold uppercase tracking-wider border ${
              indicator === "custom"
                ? "text-primary border-primary/20 bg-primary/5"
                : "text-slate-300 border-border/40 bg-muted/10"
            }`}>
              {indicator === "custom" ? "Custom" : "Default"}
            </span>
          )}
        </div>
      )}
      {children}
      {help && <p className="text-[8px] text-muted-foreground/30">{help}</p>}
    </div>
  );
}
