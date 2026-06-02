import React, { useRef } from "react";
import { useInView } from "framer-motion";
import SectionHeader from "./SectionHeader";

export default function AboutSection({ settings = {} }) {
  const imageRef = useRef(null);
  const imageInView = useInView(imageRef, { amount: 0.35, once: false });

  return (
    <section id="about" className="border-t border-border bg-secondary/80 px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <SectionHeader eyebrow={settings.about_eyebrow || "About Us"} title={settings.about_title || "Built by fans, for fans"}>
            {settings.about_description || "Rugby League Takeover Las Vegas brings together loyal supporter groups for a full-throttle celebration of Australian rugby league culture on the biggest stage in sport entertainment."}
          </SectionHeader>
          <div className="grid gap-4 border-l border-primary pl-6 text-muted-foreground">
            <p>{settings.about_body || "Expect flags, chants, mateship, packed events, Vegas energy and a supporter community that travels hard and backs their team harder."}</p>
            <p className="font-semibold text-foreground">{settings.about_highlight || "Join the world’s most passionate Rugby League supporter groups."}</p>
          </div>
        </div>
        <div ref={imageRef} className="relative min-h-[520px] overflow-hidden border border-border">
          <img src={settings.about_image_url || "https://images.unsplash.com/photo-1569959220744-ff553533f492?auto=format&fit=crop&w=1400&q=80"} alt="Supporters celebrating" loading="lazy" className={`absolute inset-0 h-full w-full object-cover transition-[filter] duration-700 ${imageInView ? "grayscale-0" : "grayscale"}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#030512]/80 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <p className="font-display text-4xl uppercase leading-none text-foreground">{settings.about_image_caption || "Las Vegas will hear us."}</p>
          </div>
        </div>
      </div>
    </section>
  );
}