import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Quote, Check, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImageField from "./ImageField";

const emptyTestimonial = { author_name: "", author_role: "", quote: "", avatar_url: "", rating: 5, sort_order: 1, is_published: true };
const ratingOptions = [0, 1, 2, 3, 4, 5];

export default function TestimonialsManager({ testimonials = [] }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyTestimonial);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["testimonials"] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Testimonial.create(data),
    onSuccess: () => { refresh(); setDraft(emptyTestimonial); toast({ title: "Testimonial added" }); },
  });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.Testimonial.update(id, data), onSuccess: refresh });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.Testimonial.delete(id), onSuccess: () => { refresh(); toast({ title: "Testimonial removed" }); } });

  // Pending (visitor submissions awaiting approval) float to the top; the rest by sort order.
  const sorted = [...testimonials].sort((a, b) => {
    const ap = a.is_published === false ? 0 : 1;
    const bp = b.is_published === false ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return Number(a.sort_order || 0) - Number(b.sort_order || 0);
  });
  const pendingCount = testimonials.filter((t) => t.is_published === false).length;

  return (
    <section id="testimonials-admin" className="scroll-mt-28 border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 font-display text-3xl uppercase">
        <Quote className="h-6 w-6 text-primary" /> Testimonials
        {pendingCount > 0 && <span className="ml-1 inline-flex items-center gap-1 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-400"><Clock className="h-3 w-3" /> {pendingCount} pending</span>}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">Fan quotes shown in the Testimonials section at the bottom of the homepage. Visitor submissions arrive <span className="font-semibold text-amber-400">pending</span> — approve to publish them. Rating is optional (set to 0 to hide stars).</p>

      <div className="mt-5 grid gap-3 border border-border bg-background/40 p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Plus className="h-4 w-4" /> Add a testimonial</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Name (e.g. Jacko)" value={draft.author_name} onChange={(e) => setDraft({ ...draft, author_name: e.target.value })} className="rounded-none" />
          <Input placeholder="Role / location (optional, e.g. Eels fan · Sydney)" value={draft.author_role} onChange={(e) => setDraft({ ...draft, author_role: e.target.value })} className="rounded-none" />
        </div>
        <Textarea placeholder="What they said…" value={draft.quote} onChange={(e) => setDraft({ ...draft, quote: e.target.value })} className="min-h-20 rounded-none" />
        <div className="grid items-center gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 text-sm text-muted-foreground">Rating
            <Select value={String(draft.rating ?? 0)} onValueChange={(v) => setDraft({ ...draft, rating: Number(v) })}>
              <SelectTrigger className="h-9 w-28 rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent>{ratingOptions.map((r) => <SelectItem key={r} value={String(r)}>{r === 0 ? "No stars" : `${r} ★`}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <Input type="number" placeholder="Sort order" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="rounded-none" />
        </div>
        <ImageField label="Photo / avatar (optional)" value={draft.avatar_url} onChange={(url) => setDraft({ ...draft, avatar_url: url })} />
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">Published <Switch checked={draft.is_published !== false} onCheckedChange={(v) => setDraft({ ...draft, is_published: v })} /></label>
          <Button onClick={() => createMutation.mutate(draft)} disabled={!draft.author_name || !draft.quote || createMutation.isPending} className="ml-auto rounded-none bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Add testimonial
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {sorted.length === 0 && <p className="text-sm text-muted-foreground">No testimonials yet. Add your first one above.</p>}
        {sorted.map((t) => (
          <div key={t.id} className={`grid gap-3 border p-4 ${t.is_published === false ? "border-amber-500/40 bg-amber-500/[0.04]" : "border-border"}`}>
            {t.is_published === false && (
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400"><Clock className="h-3.5 w-3.5" /> Pending review{t.user_email ? ` · ${t.user_email}` : ""}</p>
            )}
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_110px]">
              <Input defaultValue={t.author_name || ""} placeholder="Name" onBlur={(e) => updateMutation.mutate({ id: t.id, data: { author_name: e.target.value } })} className="rounded-none" />
              <Input defaultValue={t.author_role || ""} placeholder="Role / location" onBlur={(e) => updateMutation.mutate({ id: t.id, data: { author_role: e.target.value } })} className="rounded-none" />
              <Input type="number" defaultValue={t.sort_order ?? 1} onBlur={(e) => updateMutation.mutate({ id: t.id, data: { sort_order: Number(e.target.value) } })} className="rounded-none" />
            </div>
            <Textarea defaultValue={t.quote || ""} placeholder="Quote" onBlur={(e) => updateMutation.mutate({ id: t.id, data: { quote: e.target.value } })} className="min-h-20 rounded-none" />
            <div className="grid items-center gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 text-sm text-muted-foreground">Rating
                <Select value={String(t.rating ?? 0)} onValueChange={(v) => updateMutation.mutate({ id: t.id, data: { rating: Number(v) } })}>
                  <SelectTrigger className="h-9 w-28 rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>{ratingOptions.map((r) => <SelectItem key={r} value={String(r)}>{r === 0 ? "No stars" : `${r} ★`}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            </div>
            <ImageField label="Photo / avatar" value={t.avatar_url} onChange={(url) => updateMutation.mutate({ id: t.id, data: { avatar_url: url } })} />
            <div className="flex items-center gap-4 border-t border-border pt-3">
              <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">Published <Switch checked={t.is_published !== false} onCheckedChange={(v) => updateMutation.mutate({ id: t.id, data: { is_published: v } })} /></label>
              {t.is_published === false && (
                <Button variant="outline" size="sm" className="rounded-none border-emerald-500/50 text-emerald-400 hover:bg-emerald-500 hover:text-white" onClick={() => updateMutation.mutate({ id: t.id, data: { is_published: true } })}><Check className="mr-2 h-4 w-4" /> Approve</Button>
              )}
              <Button variant="destructive" size="sm" className="ml-auto rounded-none" onClick={() => deleteMutation.mutate(t.id)}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
