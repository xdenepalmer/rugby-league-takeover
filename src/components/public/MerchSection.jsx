import React from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import SectionHeader from "./SectionHeader";

export default function MerchSection() {
  return (
    <section id="merch" className="border-t border-border bg-background/90 px-5 py-24 backdrop-blur-sm md:px-8 md:py-32">
      <div className="mx-auto grid max-w-7xl gap-10 border border-border p-8 md:grid-cols-[1fr_auto] md:items-end md:p-12">
        <SectionHeader eyebrow="Merch" title="Wear the takeover">
          Official merch will connect to the Bucket shop once the store link is ready.
        </SectionHeader>
        <Button asChild className="h-14 rounded-none bg-primary px-8 font-bold uppercase tracking-[0.2em] hover:bg-primary/90">
          <a href="#" target="_blank" rel="noreferrer">Shop Coming Soon <ExternalLink className="ml-3 h-4 w-4" /></a>
        </Button>
      </div>
    </section>
  );
}