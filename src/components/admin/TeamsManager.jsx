import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Pencil, Check, Trash2, Plus, Upload, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { ALL_TEAMS } from "@/lib/nrl-teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ImageField from "./ImageField";
import TeamCrest from "@/components/public/TeamCrest";

const norm = (s) => String(s || "").trim().toLowerCase();

function parseBulk(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)[\s]*(?:=|\||\t|,)[\s]*(\S+)\s*$/);
      if (!m) return null;
      return { name: m[1].trim(), url: m[2].trim() };
    })
    .filter((r) => r && r.name && /^https?:\/\//i.test(r.url));
}

export default function TeamsManager({ teams = [] }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [custom, setCustom] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["teams"] });

  const byName = new Map((teams || []).map((t) => [norm(t.name), t]));
  const rosterNames = new Set(ALL_TEAMS.map((t) => norm(t.name)));
  const customTeams = (teams || []).filter((t) => !rosterNames.has(norm(t.name)));
  const knownByName = new Map([...ALL_TEAMS, ...customTeams].map((t) => [norm(t.name), t]));

  const bulkRows = useMemo(() => parseBulk(bulkText).map((r) => ({
    ...r, team: knownByName.get(norm(r.name)),
  })), [bulkText]); // eslint-disable-line react-hooks/exhaustive-deps
  const bulkMatched = bulkRows.filter((r) => r.team);

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

  const applyBulk = useMutation({
    mutationFn: async (rows) => {
      for (const { team, url } of rows) {
        const existing = byName.get(norm(team.name));
        if (existing) await base44.entities.Team.update(existing.id, { logo_url: url });
        else await base44.entities.Team.create({ name: team.name, short_name: team.short_name || team.name, logo_url: url, is_active: true, sort_order: 1 });
      }
      return rows.length;
    },
    onSuccess: (count) => { refresh(); setBulkText(""); setBulkOpen(false); toast({ title: `${count} logo${count === 1 ? "" : "s"} applied` }); },
  });

  const Tile = ({ team, index = 0 }) => {
    const dbTeam = byName.get(norm(team.name));
    const logo = dbTeam?.logo_url || "";
    const open = editing === team.name;
    return (
      <motion.div
        key={team.name}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
      >
        <div className="border border-border bg-background/40 p-3 hover:border-primary/20 transition-all duration-300 group relative">
          <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
          <div className="flex items-center gap-3">
            <TeamCrest name={team.name} short={team.short_name} logo={logo} className="h-10 w-10 text-xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{team.short_name || team.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">{team.name}</p>
            </div>
            <button type="button" onClick={() => setEditing(open ? null : team.name)} className="touch-target shrink-0 border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-foreground" title="Set logo">
              {open ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            </button>
            {team.custom && dbTeam && (
              <button type="button" onClick={() => removeTeam.mutate(dbTeam.id)} className="touch-target shrink-0 border border-border p-1.5 text-muted-foreground hover:text-destructive" title="Remove team">
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
      </motion.div>
    );
  };

  const Group = ({ title, list }) => (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">{title} - {list.length}</p>
      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-border/30 bg-muted/5 p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center border border-border/40 bg-muted/10 mb-3">
            <Shield className="h-5 w-5 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground/60">No teams yet</p>
          <p className="mt-1 text-xs text-muted-foreground/40">Add your first team above</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((team, index) => <Tile key={team.name} team={team} index={index} />)}
        </div>
      )}
    </div>
  );

  return (
    <section id="teams-admin" className="scroll-mt-28 border border-border/60 bg-card/30 cmd-glass overflow-hidden p-6">
      <div className="h-[2px] w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />
      <h2 className="mt-4 flex items-center gap-3 font-display text-2xl uppercase tracking-wide">
        <div className="flex h-9 w-9 items-center justify-center border border-amber-500/20 bg-amber-500/10">
          <Shield className="h-4 w-4 text-amber-400" />
        </div>
        Teams &amp; Crests
        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-amber-500/30 bg-amber-500/10 text-amber-400">{teams.length}</span>
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">Every NRL &amp; Super League club is built in and always available in the match-up picker. Click the pencil to set a club's crest (until then a colour monogram is used). You don't need to add teams - just pick fixtures in Match-ups.</p>

      <div className="mt-4 border border-border bg-background/40">
        <button type="button" onClick={() => setBulkOpen((o) => !o)} className="flex min-h-11 w-full items-center gap-2 px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
          <Upload className="h-4 w-4" /> Bulk import logos
          <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${bulkOpen ? "rotate-180" : ""}`} />
        </button>
        {bulkOpen && (
          <div className="grid gap-3 border-t border-border p-4">
            <p className="text-xs text-muted-foreground">Paste one club per line as <span className="font-mono text-foreground">Club Name = https://logo-url.png</span> (you can also use a comma or <span className="font-mono text-foreground">|</span> instead of <span className="font-mono text-foreground">=</span>). Transparent PNGs look best. Use image links you own or are licensed to use - official club crests are copyrighted.</p>
            <Textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={6} placeholder={"Penrith Panthers = https://your-cdn.com/penrith.png\nMelbourne Storm = https://your-cdn.com/storm.png"} className="rounded-none font-mono text-xs" />
            {bulkText.trim() && (
              <p className="text-xs text-muted-foreground">{bulkMatched.length} of {bulkRows.length} line{bulkRows.length === 1 ? "" : "s"} match a known club.{bulkRows.length > bulkMatched.length && " Unmatched lines (bad URL or unknown club name) are skipped."}</p>
            )}
            <div className="flex justify-end">
              <Button size="mobile" className="rounded-none bg-primary hover:bg-primary/90" disabled={bulkMatched.length === 0 || applyBulk.isPending} onClick={() => applyBulk.mutate(bulkMatched)}>
                <Upload className="mr-2 h-4 w-4" /> {applyBulk.isPending ? "Applying..." : `Apply ${bulkMatched.length} logo${bulkMatched.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6">
        <Group title="NRL" list={ALL_TEAMS.filter((t) => t.league === "NRL")} />
        <Group title="British Super League" list={ALL_TEAMS.filter((t) => t.league === "Super League")} />
        {customTeams.length > 0 && <Group title="Custom" list={customTeams.map((t) => ({ ...t, custom: true }))} />}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Input placeholder="Add a custom team (e.g. an invitational side)" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-11 max-w-xs rounded-none" />
        <Button variant="outline" size="mobile" className="rounded-none" disabled={!custom.trim() || addCustom.isPending} onClick={() => addCustom.mutate(custom.trim())}>
          <Plus className="mr-2 h-4 w-4" /> Add custom team
        </Button>
      </div>
    </section>
  );
}
