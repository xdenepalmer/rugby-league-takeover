import React from "react";

export default function StatBadge({ icon: Icon, label, value, color = "text-primary", bg = "bg-primary/5", border = "border-primary/10", pulse }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${bg} border ${border} text-[10px] font-bold uppercase tracking-wider ${color}`}>
      {pulse ? <span className={`h-1.5 w-1.5 rounded-full ${color === "text-destructive" ? "bg-destructive" : "bg-current"} cmd-blink`} /> : <Icon className="h-3 w-3" />}
      {value} {label}
    </span>
  );
}
