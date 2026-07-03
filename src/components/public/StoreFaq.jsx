import React from "react";
import { useQuery } from "@tanstack/react-query";
import { HelpCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function StoreFaq() {
  const { data: faqs = [] } = useQuery({
    queryKey: ["faqs"],
    queryFn: () => base44.entities.Faq.list("sort_order", 200),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });

  // Store page shows the "store" FAQs (legacy rows with no category count as
  // store, since that was the original default). Website FAQs live on /faq.
  const visible = faqs.filter((f) => f.is_published !== false && (f.category === "store" || !f.category));
  if (visible.length === 0) return null;

  return (
    <section className="mx-auto mt-16 max-w-3xl border-t border-border px-1 pt-12">
      <div className="flex items-center gap-3">
        <HelpCircle className="h-6 w-6 text-primary" />
        <h2 className="font-display text-3xl uppercase tracking-wide text-foreground md:text-4xl">FAQs</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Returns, shipping, sizing and everything else about the merch.</p>
      <Accordion type="single" collapsible className="mt-6">
        {visible.map((faq) => (
          <AccordionItem key={faq.id} value={faq.id} className="border-border">
            <AccordionTrigger className="text-left font-bold uppercase tracking-wide">{faq.question}</AccordionTrigger>
            <AccordionContent className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
