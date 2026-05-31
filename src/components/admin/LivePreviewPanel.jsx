import React from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminSection from "./AdminSection";

export default function LivePreviewPanel() {
  return (
    <AdminSection id="preview" eyebrow="Final check" title="Live preview" description="Open the public pages after editing to confirm what visitors will see.">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Homepage", "/"],
          ["Store", "/store"],
          ["Forum", "/forum"],
        ].map(([label, href]) => (
          <Button key={href} asChild variant="outline" className="h-12 rounded-none justify-between">
            <a href={href} target="_blank" rel="noreferrer">{label}<ExternalLink className="h-4 w-4" /></a>
          </Button>
        ))}
      </div>
    </AdminSection>
  );
}