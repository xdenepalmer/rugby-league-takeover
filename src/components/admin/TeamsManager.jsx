import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Shield } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import ImageField from "./ImageField";

const emptyTeam = { name: "", short_name: "", logo_url: "", sort_order: 1, is_active: true };

export default function TeamsManager({ teams = [] }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyTeam);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["teams"] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Team.create(data),
    onSuccess: () => { refresh(); setDraft(emptyTeam); toast({ title: "Team added" }); },
  });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.Team.update(id, data), onSuccess: refresh });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.Team.delete(id), onSuccess: () => { refresh(); toast({ title: "Team removed" }); } });

  const sorted = [...teams].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  return (
    <section id="teams-admin" className="scroll-mt-28 border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 font-display text-3xl uppercase"><Shield className="h-6 w-6 text-primary" /> Teams</h2>
      <p className="mt-2 text-sm text-muted-foreground">Add the teams (with logos) that can appear in match-ups. You'll pick from these when building the fixtures.</p>

      <div className="mt-5 grid gap-3 border border-border bg-background/40 p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Plus className="h-4 w-4" /> Add a team</p>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_110px]">
          <Input placeholder="Team name (e.g. Parramatta Eels)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="rounded-none" />
          <Input placeholder="Short name (e.g. Eels)" value={draft.short_name} onChange={(e) => setDraft({ ...draft, short_name: e.target.value })} className="rounded-none" />
          <Input type="number" placeholder="Order" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="rounded-none" />
        </div>
        <ImageField label="Team logo" value={draft.logo_url} onChange={(url) => setDraft({ ...draft, logo_url: url })} />
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">Active <Switch checked={draft.is_active !== false} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} /></label>
          <Button onClick={() => createMutation.mutate(draft)} disabled={!draft.name || createMutation.isPending} className="ml-auto rounded-none bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Add team
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {sorted.length === 0 && <p className="text-sm text-muted-foreground">No teams yet. Add your first one above.</p>}
        {sorted.map((team) => (
          <div key={team.id} className="grid items-center gap-3 border border-border p-3 md:grid-cols-[56px_1fr_1fr_90px_auto]">
            <div className="flex h-12 w-12 items-center justify-center border border-border bg-secondary">
              {team.logo_url ? <img src={team.logo_url} alt={team.name} className="h-full w-full object-contain" /> : <Shield className="h-5 w-5 text-muted-foreground" />}
            </div>
            <Input defaultValue={team.name || ""} onBlur={(e) => updateMutation.mutate({ id: team.id, data: { name: e.target.value } })} className="rounded-none" />
            <Input defaultValue={team.short_name || ""} placeholder="Short name" onBlur={(e) => updateMutation.mutate({ id: team.id, data: { short_name: e.target.value } })} className="rounded-none" />
            <Input type="number" defaultValue={team.sort_order ?? 1} onBlur={(e) => updateMutation.mutate({ id: team.id, data: { sort_order: Number(e.target.value) } })} className="rounded-none" />
            <div className="flex items-center gap-2">
              <Switch checked={team.is_active !== false} onCheckedChange={(v) => updateMutation.mutate({ id: team.id, data: { is_active: v } })} />
              <Button variant="destructive" size="icon" className="rounded-none" onClick={() => deleteMutation.mutate(team.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <ImageField label="" value={team.logo_url} onChange={(url) => updateMutation.mutate({ id: team.id, data: { logo_url: url } })} className="md:col-span-5" />
          </div>
        ))}
      </div>
    </section>
  );
}
