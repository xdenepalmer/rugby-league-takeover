import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Swords } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DateTimePicker from "./DateTimePicker";

const emptyMatchup = { home_team: "", home_logo: "", away_team: "", away_logo: "", kickoff: "", label: "", venue: "", ticket_url: "", sort_order: 1, is_published: true };

function TeamSelect({ teams, valueName, onPick, placeholder }) {
  return (
    <Select value={valueName || ""} onValueChange={(id) => { const t = teams.find((x) => x.id === id); if (t) onPick(t); }}>
      <SelectTrigger className="h-11 rounded-none"><SelectValue placeholder={placeholder}>{valueName || placeholder}</SelectValue></SelectTrigger>
      <SelectContent>
        {teams.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Add teams first</div>}
        {teams.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            <span className="flex items-center gap-2">
              {t.logo_url && <img src={t.logo_url} alt="" className="h-4 w-4 object-contain" />}
              {t.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function MatchupsManager({ matchups = [], teams = [] }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyMatchup);
  const activeTeams = teams.filter((t) => t.is_active !== false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["matchups"] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Matchup.create(data),
    onSuccess: () => { refresh(); setDraft(emptyMatchup); toast({ title: "Matchup added" }); },
  });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.Matchup.update(id, data), onSuccess: refresh });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.Matchup.delete(id), onSuccess: () => { refresh(); toast({ title: "Matchup removed" }); } });

  const setHome = (t) => setDraft((d) => ({ ...d, home_team: t.name, home_logo: t.logo_url || "" }));
  const setAway = (t) => setDraft((d) => ({ ...d, away_team: t.name, away_logo: t.logo_url || "" }));
  const sorted = [...matchups].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  return (
    <section id="matchups-admin" className="scroll-mt-28 border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 font-display text-3xl uppercase"><Swords className="h-6 w-6 text-primary" /> Match-ups</h2>
      <p className="mt-2 text-sm text-muted-foreground">Pick which teams are playing — these show on the homepage near the countdown. Add teams in the Teams panel first.</p>

      <div className="mt-5 grid gap-3 border border-border bg-background/40 p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Plus className="h-4 w-4" /> Add a match-up</p>
        <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
          <TeamSelect teams={activeTeams} valueName={draft.home_team} onPick={setHome} placeholder="Home team" />
          <span className="text-center font-display text-xl text-primary">VS</span>
          <TeamSelect teams={activeTeams} valueName={draft.away_team} onPick={setAway} placeholder="Away team" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <DateTimePicker value={draft.kickoff} onChange={(val) => setDraft({ ...draft, kickoff: val })} placeholder="Kickoff date & time" />
          <Input placeholder="Label (e.g. Double Header Game 1)" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className="h-11 rounded-none" />
          <Input placeholder="Venue (optional)" value={draft.venue} onChange={(e) => setDraft({ ...draft, venue: e.target.value })} className="h-11 rounded-none" />
          <Input placeholder="Tickets link (optional)" value={draft.ticket_url} onChange={(e) => setDraft({ ...draft, ticket_url: e.target.value })} className="h-11 rounded-none" />
          <Input type="number" placeholder="Sort order" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="h-11 rounded-none" />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex min-h-11 items-center gap-2 text-sm">Published <Switch checked={draft.is_published !== false} onCheckedChange={(v) => setDraft({ ...draft, is_published: v })} /></label>
          <Button size="mobile" onClick={() => createMutation.mutate(draft)} disabled={!draft.home_team || !draft.away_team || createMutation.isPending} className="ml-auto w-full rounded-none bg-primary hover:bg-primary/90 sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Add match-up
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {sorted.length === 0 && <p className="text-sm text-muted-foreground">No match-ups yet. Add one above.</p>}
        {sorted.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-4 border border-border p-4">
            <div className="flex items-center gap-2">
              {m.home_logo && <img src={m.home_logo} alt={m.home_team} className="h-8 w-8 object-contain" />}
              <span className="font-bold">{m.home_team}</span>
            </div>
            <span className="font-display text-primary">VS</span>
            <div className="flex items-center gap-2">
              {m.away_logo && <img src={m.away_logo} alt={m.away_team} className="h-8 w-8 object-contain" />}
              <span className="font-bold">{m.away_team}</span>
            </div>
            <span className="text-xs text-muted-foreground">{m.label}{m.venue ? ` · ${m.venue}` : ""}</span>
            <div className="ml-auto flex items-center gap-3">
              <label className="flex min-h-11 items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">Published <Switch checked={m.is_published !== false} onCheckedChange={(v) => updateMutation.mutate({ id: m.id, data: { is_published: v } })} /></label>
              <Button variant="destructive" size="mobileIcon" className="rounded-none" onClick={() => deleteMutation.mutate(m.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
