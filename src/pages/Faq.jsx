import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HelpCircle, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SectionHeader from "@/components/public/SectionHeader";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function Faq() {
  const [search, setSearch] = useState("");

  const { data: faqs = [], isLoading } = useQuery({
    queryKey: ["publicFaqs"],
    queryFn: () => base44.entities.Faq.list("sort_order", 200),
  });

  const publishedFaqs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return faqs
      .filter((faq) => faq.is_published !== false)
      .filter((faq) => {
        if (!query) return true;
        return `${faq.question || ""} ${faq.answer || ""}`.toLowerCase().includes(query);
      });
  }, [faqs, search]);

  return (
    <div className="min-h-screen bg-background pt-28 text-foreground">
      <section className="relative overflow-hidden border-b border-border px-5 py-16 md:px-8 md:py-24">
        <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-[110px]" />
        <div className="relative mx-auto max-w-5xl">
          <SectionHeader eyebrow="Support" title="Frequently asked questions">
            Official answers for Rugby League Takeover travel, events, merch, community and account questions.
          </SectionHeader>
          <div className="relative mt-8 max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search FAQs..."
              className="h-12 border-primary/20 bg-card/60 pl-11"
            />
          </div>
        </div>
      </section>

      <section className="px-5 py-12 md:px-8 md:py-16">
        <div className="mx-auto max-w-5xl">
          {isLoading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-16 animate-pulse border border-border bg-card/40" />
              ))}
            </div>
          ) : publishedFaqs.length > 0 ? (
            <Accordion type="single" collapsible className="grid gap-3">
              {publishedFaqs.map((faq, index) => (
                <AccordionItem key={faq.id || index} value={`faq-${faq.id || index}`} className="border border-border bg-card/55 px-5">
                  <AccordionTrigger className="text-left font-display text-xl uppercase tracking-wide text-foreground hover:text-primary">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="whitespace-pre-line text-sm leading-7 text-muted-foreground">
                    {faq.answer || "Answer coming soon."}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="border border-dashed border-border bg-card/40 px-6 py-16 text-center">
              <HelpCircle className="mx-auto mb-4 h-10 w-10 text-primary" />
              <p className="font-display text-2xl uppercase">No FAQs found</p>
              <p className="mt-2 text-sm text-muted-foreground">Try a different search or check back soon.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}