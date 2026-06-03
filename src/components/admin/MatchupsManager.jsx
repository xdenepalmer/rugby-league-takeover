import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Swords, Pencil, Check, X, Trophy } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_TEAMS } from "@/lib/nrl-teams";
import DateTimePicker from "./DateTimePicker";

const emptyMatchup = { home_team: "", home_logo: "", away_team: "", away_logo: "", kickoff: "", label: "", venue: "", ticket_url: "", sort_order: 1, is_published: true, status: "scheduled", home_score: "", away_score: "", result_note: "" };
const norm = (s) => String(s || "").trim().toLowerCase();

function TeamSelect({ valueName, onPick, placeholder }) {
  const nrl = ALL_TEAMS.filter((t) => t.league === "NRL");
  const sl = ALL_TEAMS.filter((t) => t.league === "Super League");
  return (
    <Select value={valueName || ""} onValueChange={(name) => { const t = ALL_TEAMS.find((x) => x.name === name); if (t) onPick(t); }}>
      <SelectTrigger className="h-11 rounded-none"><SelectValue placeholder={placeholder}>{valueName || placeholder}</SelectValue></SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectGroup>
          <SelectLabel>NRL</SelectLabel>
          {nrl.map((t) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>British Super League</SelectLabel>
          {sl.map((t) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

// Shared editable fields for both the add form and inline edit. `logoFor`
// resolves a club's uploaded crest by name so the snapshot stays current.
function MatchupFields({ value, onChange, logoFor }) {
  const setHome = (t) => onChange({ ...value, home_team: t.name, home_logo: logoFor(t.name) });
  const setAway = (t) => onChange({ ...value, away_team: t.name, away_logo: logoFor(t.name) });
  const isFinal = value.status === "final";
  return (
    <div className="grid gap-3">
      <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
        <TeamSelect valueName={value.home_team} onPick={setHome} placeholder="Home team" />
        <span className="text-center font-display text-xl text-primary">VS</span>
        <TeamSelect valueName={value.away_team} onPick={setAway} placeholder="Away team" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <DateTimePicker value={value.kickoff} onChange={(val) => onChange({ ...value, kickoff: val })} placeholder="Kickoff date & time" />
        <Input placeholder="Label (e.g. Double Header Game 1)" value={value.label || ""} onChange={(e) => onChange({ ...value, label: e.target.value })} className="h-11 rounded-none" />
        <Input placeholder="Venue (optional)" value={value.venue || ""} onChange={(e) => onChange({ ...value, venue: e.target.value })} className="h-11 rounded-none" />
        <Input placeholder="Tickets link (optional)" value={value.ticket_url || ""} onChange={(e) => onChange({ ...value, ticket_url: e.target.value })} className="h-11 rounded-none" />
        <Input type="number" placeholder="Sort order" value={value.sort_order ?? 1} onChange={(e) => onChange({ ...value, sort_order: Number(e.target.value) })} className="h-11 rounded-none" />
      </div>

      <div className="grid gap-3 border-t border-border/60 pt-3">
        <label className="flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Trophy className="h-4 w-4" /> Game finished?
          <Switch checked={isFinal} onCheckedChange={(v) => onChange({ ...value, status: v ? "final" : "scheduled" })} />
          <span className="font-normal normal-case tracking-normal text-muted-foreground/70">{isFinal ? "Result shows instead of kickoff" : "Toggle on to enter the final score"}</span>
        </label>
        {isFinal && (
          <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr_1fr]">
            <Input type="number" placeholder={`${value.home_team || "Home"} score`} value={value.home_score ?? ""} onChange={(e) => onChange({ ...value, home_score: e.target.value === "" ? "" : Number(e.target.value) })} className="h-11 rounded-none" />
            <span className="text-center font-display text-primary">-</span>
            <Input type="number" placeholder={`${value.away_team || "Away"} score`} value={value.away_score ?? ""} onChange={(e) => onChange({ ...value, away_score: e.target.value === "" ? "" : Number(e.target.value) })} className="h-11 rounded-none" />
            <Input placeholder="Note (e.g. Full Time)" value={value.result_note || ""} onChange={(e) => onChange({ ...value, result_note: e.target.value })} className="h-11 rounded-none" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function MatchupsManager({ matchups = [], teams = [] }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyMatchup);
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const logoByName = new Map((teams || []).map((t) => [norm(t.name), t.logo_url || ""]));
  const logoFor = (name) => logoByName.get(norm(name)) || "";
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["matchups"] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Matchup.create(data),
    onSuccess: () => { refresh(); setDraft(emptyMatchup); toast({ title: "Matchup added" }); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Matchup.update(id, data),
    onSuccess: () => { refresh(); setEditId(null); setEditDraft(null); },
  });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.Matchup.delete(id), onSuccess: () => { refresh(); toast({ title: "Matchup removed" }); } });

  const startEdit = (m) => { setEditId(m.id); setEditDraft({ ...emptyMatchup, ...m }); };
  const cancelEdit = () => { setEditId(null); setEditDraft(null); };
  const saveEdit = () => {
    const { id: _id, ...data } = editDraft;
    updateMutation.mutate({ id: editId, data }, { onSuccess: () => toast({ title: "Matchup updated" }) });
  };

  const sorted = [...matchups].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  return (
    <section id="matchups-admin" className="scroll-mt-28 border border-border/60 bg-card/30 cmd-glass overflow-hidden">
      <div className="h-[2px] w-full bg-gradient-to-r from-sky-500 via-sky-400 to-sky-500" />
      <div className="p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center border border-sky-500/20 bg-sky-500/10">
          <Swords className="h-4 w-4 text-sky-400" />
        </div>
        <h2 className="font-display text-2xl uppercase tracking-wide">Match-ups</h2>
        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-sky-500/30 bg-sky-500/10 text-sky-400">{matchups.length}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Pick which teams are playing - every NRL &amp; Super League club is built in. These show on the homepage near the countdown. After a game, edit it and switch on &ldquo;Game finished?&rdquo; to publish the result.</p>

      <div className="mt-5 grid gap-3 border border-border bg-background/40 p-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Plus className="h-4 w-4" /> Add a match-up</p>
        <MatchupFields value={draft} onChange={setDraft} logoFor={logoFor} />
        <div className="flex items-center gap-4">
          <label className="flex min-h-11 items-center gap-2 text-sm">Published <Switch checked={draft.is_published !== false} onCheckedChange={(v) => setDraft({ ...draft, is_published: v })} /></label>
          <Button size="mobile" onClick={() => createMutation.mutate(draft)} disabled={!draft.home_team || !draft.away_team || createMutation.isPending} className="ml-auto w-full rounded-none bg-primary hover:bg-primary/90 sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Add match-up
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center border border-border/30 bg-muted/5 p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center border border-border/40 bg-muted/10 mb-3">
              <Trophy className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground/60">No matchups yet</p>
            <p className="mt-1 text-xs text-muted-foreground/40">Add your first match result above</p>
          </div>
        )}
        <AnimatePresence mode="popLayout">
        {sorted.map((m, index) => (
          editId === m.id ? (
            <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.3 }} className="grid gap-3 border border-primary/50 bg-background/40 p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary"><Pencil className="h-4 w-4" /> Editing match-up</p>
              <MatchupFields value={editDraft} onChange={setEditDraft} logoFor={logoFor} />
              <div className="flex items-center gap-4">
                <label className="flex min-h-11 items-center gap-2 text-sm">Published <Switch checked={editDraft.is_published !== false} onCheckedChange={(v) => setEditDraft({ ...editDraft, is_published: v })} /></label>
                <div className="ml-auto flex gap-2">
                  <Button variant="ghost" size="mobile" className="rounded-none" onClick={cancelEdit}><X className="mr-2 h-4 w-4" /> Cancel</Button>
                  <Button size="mobile" onClick={saveEdit} disabled={!editDraft.home_team || !editDraft.away_team || updateMutation.isPending} className="rounded-none bg-primary hover:bg-primary/90"><Check className="mr-2 h-4 w-4" /> Save changes</Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.3 }} className="relative flex flex-wrap items-center gap-4 border border-border p-4 hover:border-primary/20 transition-all duration-300 group">
              <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
              <div className="flex items-center gap-2">
                {m.home_logo && <img src={m.home_logo} alt={m.home_team} className="h-8 w-8 object-contain" />}
                <span className="font-bold">{m.home_team}</span>
              </div>
              {m.status === "final" ? (
                <span className="font-display text-lg tabular-nums text-foreground">{m.home_score ?? "-"} <span className="text-primary">-</span> {m.away_score ?? "-"}</span>
              ) : (
                <span className="font-display text-primary">VS</span>
              )}
              <div className="flex items-center gap-2">
                {m.away_logo && <img src={m.away_logo} alt={m.away_team} className="h-8 w-8 object-contain" />}
                <span className="font-bold">{m.away_team}</span>
              </div>
              {m.status === "final" && <span className="border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">{m.result_note || "Full Time"}</span>}
              <span className="text-xs text-muted-foreground">{m.label}{m.venue ? ` - ${m.venue}` : ""}</span>
              <div className="ml-auto flex items-center gap-3">
                <label className="flex min-h-11 items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">Published <Switch checked={m.is_published !== false} onCheckedChange={(v) => updateMutation.mutate({ id: m.id, data: { is_published: v } })} /></label>
                <Button variant="outline" size="mobileIcon" className="rounded-none" onClick={() => startEdit(m)} title="Edit / enter result"><Pencil className="h-4 w-4" /></Button>
                <Button variant="destructive" size="mobileIcon" className="rounded-none" onClick={() => deleteMutation.mutate(m.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </motion.div>
          )
        ))}
        </AnimatePresence>
      </div>
      </div>
    </section>
  );
}
