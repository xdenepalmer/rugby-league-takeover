import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Pencil, Check, Trash2, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { ALL_TEAMS } from "@/lib/nrl-teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ImageField from "./ImageField";
import TeamCrest from "@/components/public/TeamCrest";

const norm = (s) => String(s || "").trim().toLowerCase();

export default function TeamsManager({ teams = [] }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // team name currently editing
  const [custom, setCustom] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["teams"] });

  const byName = new Map((teams || []).map((t) => [norm(t.name), t]));
  const rosterNames = new Set(ALL_TEAMS.map((t) => norm(t.name)));
  const customTeams = (teams || []).filter((t) => !rosterNames.has(norm(t.name)));

  const setLogo = useMutation({
    mutationFn: async ({ team, logo_url }) => {
      const existing = byName.get(norm(team.name));
      if (existing) return base44.entities.Team.update(existing.id, { logo_url });
      return base44.entities.Team.create({ name: team.name, short_name: team.short_name || team.name, logo_url, is_active: true, sort_order: 1 });
    },
    onSuccess: () => { refresh(); toast({ title: "Logo saved" }); },
  });
  const addCustom = useMutation({
    mutationFn: (name) => base44.entities.Team.create({ name, short_name: name, logo_url: "", is_active: true, sort_order: 1 }),
    onSuccess: () => { refresh(); setCustom(""); toast({ title: "Team added" }); },
  });
  const removeTeam = useMutation({ mutationFn: (id) => base44.entities.Team.delete(id), onSuccess: () => { refresh(); toast({ title: "Removed" }); } });

  const Tile = ({ team }) => {
    const dbTeam = byName.get(norm(team.name));
    const logo = dbTeam?.logo_url || "";
    const open = editing === team.name;
    return (
      <div className="border border-border bg-background/40 p-3">
        <div className="flex items-center gap-3">
          <TeamCrest name={team.name} short={team.short_name} logo={logo} className="h-10 w-10 text-xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">{team.short_name || team.name}</p>
            <p className="truncate text-[10px] text-muted-foreground">{team.name}</p>
          </div>
          <button type="button" onClick={() => setEditing(open ? null : team.name)} className="shrink-0 border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-foreground" title="Set logo">
            {open ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          </button>
          {team.custom && dbTeam && (
            <button type="button" onClick={() => removeTeam.mutate(dbTeam.id)} className="shrink-0 border border-border p-1.5 text-muted-foreground hover:text-destructive" title="Remove team">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {open && (
          <div className="mt-3 border-t border-border pt-3">
            <ImageField label="Team logo (transparent PNG works best)" value={logo} onChange={(url) => setLogo.mutate({ team, logo_url: url })} />
          </div>
        )}
      </div>
    );
  };

  const Group = ({ title, list }) => (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">{title} · {list.length}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((team) => <Tile key={team.name} team={team} />)}
      </div>
    </div>
  );

  return (
    <section id="teams-admin" className="scroll-mt-28 border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 font-display text-3xl uppercase"><Shield className="h-6 w-6 text-primary" /> Teams &amp; Crests</h2>
      <p className="mt-2 text-sm text-muted-foreground">Every NRL &amp; Super League club is built in and always available in the match-up picker. Click the pencil to set a club's crest (until then a colour monogram is used). You don't need to add teams — just pick fixtures in Match-ups.</p>

      <div className="mt-6 grid gap-6">
        <Group title="NRL" list={ALL_TEAMS.filter((t) => t.league === "NRL")} />
        <Group title="British Super League" list={ALL_TEAMS.filter((t) => t.league === "Super League")} />
        {customTeams.length > 0 && <Group title="Custom" list={customTeams.map((t) => ({ ...t, custom: true }))} />}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Input placeholder="Add a custom team (e.g. an invitational side)" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-9 max-w-xs rounded-none" />
        <Button variant="outline" size="sm" className="rounded-none" disabled={!custom.trim() || addCustom.isPending} onClick={() => addCustom.mutate(custom.trim())}>
          <Plus className="mr-2 h-4 w-4" /> Add custom team
        </Button>
      </div>
    </section>
  );
}
