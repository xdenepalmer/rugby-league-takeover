import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Handshake } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import ImageField from "./ImageField";

const emptyPartner = { name: "", logo_url: "", url: "", description: "", sort_order: 1, is_published: true };

export default function PartnersManager({ partners = [] }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyPartner);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["partners"] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Partner.create(data),
    onSuccess: () => { refresh(); setDraft(emptyPartner); toast({ title: "Partner added" }); },
  });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.Partner.update(id, data), onSuccess: refresh });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.Partner.delete(id), onSuccess: () => { refresh(); toast({ title: "Partner removed" }); } });

  const sorted = [...partners].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  return (
    <section id="partners-admin" className="scroll-mt-28 border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 font-display text-3xl uppercase"><Handshake className="h-6 w-6 text-primary" /> Partners &amp; Venues</h2>
      <p className="mt-2 text-sm text-muted-foreground">Add partner / venue logos and links shown in the Partners section on the homepage.</p>

      <div className="mt-5 grid gap-3 border border-border bg-background/40 p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Plus className="h-4 w-4" /> Add a partner</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Partner / venue name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="rounded-none" />
          <Input placeholder="Website link (optional)" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} className="rounded-none" />
          <Input type="number" placeholder="Sort order" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="rounded-none" />
        </div>
        <Textarea placeholder="Short description (optional)" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="min-h-16 rounded-none" />
        <ImageField label="Logo" value={draft.logo_url} onChange={(url) => setDraft({ ...draft, logo_url: url })} />
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">Published <Switch checked={draft.is_published !== false} onCheckedChange={(v) => setDraft({ ...draft, is_published: v })} /></label>
          <Button onClick={() => createMutation.mutate(draft)} disabled={!draft.name || createMutation.isPending} className="ml-auto rounded-none bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Add partner
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {sorted.length === 0 && <p className="text-sm text-muted-foreground">No partners yet. Add your first one above.</p>}
        {sorted.map((partner) => (
          <div key={partner.id} className="grid gap-3 border border-border p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_110px]">
              <Input defaultValue={partner.name || ""} onBlur={(e) => updateMutation.mutate({ id: partner.id, data: { name: e.target.value } })} className="rounded-none" />
              <Input defaultValue={partner.url || ""} placeholder="Website link" onBlur={(e) => updateMutation.mutate({ id: partner.id, data: { url: e.target.value } })} className="rounded-none" />
              <Input type="number" defaultValue={partner.sort_order ?? 1} onBlur={(e) => updateMutation.mutate({ id: partner.id, data: { sort_order: Number(e.target.value) } })} className="rounded-none" />
            </div>
            <Textarea defaultValue={partner.description || ""} placeholder="Description" onBlur={(e) => updateMutation.mutate({ id: partner.id, data: { description: e.target.value } })} className="min-h-16 rounded-none" />
            <ImageField label="Logo" value={partner.logo_url} onChange={(url) => updateMutation.mutate({ id: partner.id, data: { logo_url: url } })} />
            <div className="flex items-center gap-4 border-t border-border pt-3">
              <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">Published <Switch checked={partner.is_published !== false} onCheckedChange={(v) => updateMutation.mutate({ id: partner.id, data: { is_published: v } })} /></label>
              <Button variant="destructive" size="sm" className="ml-auto rounded-none" onClick={() => deleteMutation.mutate(partner.id)}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
