import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, HelpCircle, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const emptyFaq = { question: "", answer: "", category: "store", sort_order: 1, is_published: true };

export default function FaqManager({ faqs = [] }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyFaq);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["faqs"] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Faq.create(data),
    onSuccess: () => { refresh(); setDraft(emptyFaq); toast({ title: "FAQ added" }); },
  });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.Faq.update(id, data), onSuccess: refresh });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.Faq.delete(id), onSuccess: () => { refresh(); toast({ title: "FAQ removed" }); } });

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const sorted = [...faqs].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  return (
    <section id="faq-admin" className="scroll-mt-28 border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 font-display text-3xl uppercase"><HelpCircle className="h-6 w-6 text-primary" /> Store FAQs</h2>
      <p className="mt-2 text-sm text-muted-foreground">Free-format questions &amp; answers shown on the merch store — returns, shipping, sizing, anything. Add as many as you like.</p>

      <div className="mt-5 grid gap-3 border border-border bg-background/40 p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Plus className="h-4 w-4" /> Add a question</p>
        <Input placeholder="Question (e.g. What's your returns policy?)" value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} className="h-11 rounded-none" />
        <Textarea placeholder="Answer" value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} className="min-h-24 rounded-none" />
        <div className="flex flex-wrap items-center gap-4">
          <Input type="number" placeholder="Sort order" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="h-11 w-32 rounded-none" />
          <label className="flex min-h-11 items-center gap-2 text-sm">Published <Switch checked={draft.is_published !== false} onCheckedChange={(v) => setDraft({ ...draft, is_published: v })} /></label>
          <Button size="mobile" onClick={() => createMutation.mutate(draft)} disabled={!draft.question || createMutation.isPending} className="ml-auto w-full rounded-none bg-primary hover:bg-primary/90 sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Add FAQ
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {sorted.length === 0 && <p className="text-sm text-muted-foreground">No FAQs yet. Add your first one above.</p>}
        {sorted.map((faq) => (
          <div key={faq.id} className="grid gap-3 border border-border p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_120px]">
              <Input defaultValue={faq.question || ""} onBlur={(e) => updateMutation.mutate({ id: faq.id, data: { question: e.target.value } })} className="h-11 rounded-none" />
              <Input type="number" defaultValue={faq.sort_order ?? 1} onBlur={(e) => updateMutation.mutate({ id: faq.id, data: { sort_order: Number(e.target.value) } })} className="h-11 rounded-none" />
            </div>
            <Textarea defaultValue={faq.answer || ""} onBlur={(e) => updateMutation.mutate({ id: faq.id, data: { answer: e.target.value } })} className="min-h-20 rounded-none" />
            <div className="flex items-center gap-4 border-t border-border pt-3">
              <label className="flex min-h-11 items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">Published <Switch checked={faq.is_published !== false} onCheckedChange={(v) => updateMutation.mutate({ id: faq.id, data: { is_published: v } })} /></label>
              {confirmDeleteId === faq.id ? (
                <div className="ml-auto flex items-center gap-2 border border-destructive/60 bg-destructive/10 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-xs font-bold text-destructive">Delete this FAQ?</span>
                  <Button variant="destructive" size="sm" className="rounded-none h-8" onClick={() => { deleteMutation.mutate(faq.id); setConfirmDeleteId(null); }}>Yes, delete</Button>
                  <Button variant="outline" size="sm" className="rounded-none h-8" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="destructive" size="mobile" className="ml-auto rounded-none" onClick={() => setConfirmDeleteId(faq.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}