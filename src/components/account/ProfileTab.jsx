import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import { ALL_TEAMS } from "@/lib/nrl-teams";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import TeamCrest from "@/components/public/TeamCrest";
import MediaUploader from "@/components/admin/MediaUploader";

const norm = (s) => String(s || "").trim().toLowerCase();

// Build the favourite-team options from the clubs managed in Events (the Team
// entity, with logos) merged with the built-in roster, grouped by league.
function buildTeamGroups(dbTeams) {
  const logoByName = new Map((dbTeams || []).map((t) => [norm(t.name), t.logo_url || ""]));
  const rosterNames = new Set(ALL_TEAMS.map((t) => norm(t.name)));
  const withLogo = (t) => ({ ...t, logo: logoByName.get(norm(t.name)) || "" });

  const nrl = ALL_TEAMS.filter((t) => t.league === "NRL").map(withLogo);
  const sl = ALL_TEAMS.filter((t) => t.league === "Super League").map(withLogo);
  // Any custom clubs added in Events that aren't part of the built-in roster.
  const other = (dbTeams || [])
    .filter((t) => t.name && !rosterNames.has(norm(t.name)))
    .map((t) => ({ name: t.name, short_name: t.short_name || t.name, logo: t.logo_url || "" }));

  return { nrl, sl, other };
}

const profileFields = (user) => ({
  full_name: user?.full_name || "",
  phone: user?.phone || "",
  postcode: user?.postcode || "",
  city: user?.city || "",
  country: user?.country || "",
  bio: user?.bio || "",
  favourite_team: user?.favourite_team || "",
  avatar_url: user?.avatar_url || "",
  show_location_on_forum: user?.show_location_on_forum === true,
  show_team_on_forum: user?.show_team_on_forum === true,
  marketing_opt_in: user?.marketing_opt_in === true,
});

export default function ProfileTab() {
  const { user, updateProfile } = useAuth();
  const [draft, setDraft] = useState(() => profileFields(user));

  const { data: dbTeams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list("name", 200),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });
  const { nrl, sl, other } = useMemo(() => buildTeamGroups(dbTeams), [dbTeams]);
  const selectedLogo = useMemo(() => {
    const all = [...nrl, ...sl, ...other];
    return all.find((t) => t.name === draft.favourite_team)?.logo || "";
  }, [nrl, sl, other, draft.favourite_team]);

  const saveMutation = useMutation({
    mutationFn: () => updateProfile(draft),
    onSuccess: () => toast({ title: "Profile saved", description: "Your details have been updated." }),
  });

  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const TeamOption = (team) => (
    <SelectItem key={team.name} value={team.name}>
      <span className="flex items-center gap-2">
        <TeamCrest name={team.name} short={team.short_name} logo={team.logo} className="h-5 w-5 text-[8px]" />
        {team.name}
      </span>
    </SelectItem>
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-5 border border-border bg-card p-6 md:grid-cols-2">
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Full name</Label>
          <Input value={draft.full_name} onChange={(e) => update("full_name", e.target.value)} className="h-12 rounded-none border-border bg-background" />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Email</Label>
          <Input value={user?.email || ""} disabled className="h-12 rounded-none opacity-70" />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Phone</Label>
          <Input value={draft.phone} onChange={(e) => update("phone", e.target.value)} className="h-12 rounded-none border-border bg-background" />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Postcode</Label>
          <Input value={draft.postcode} onChange={(e) => update("postcode", e.target.value)} className="h-12 rounded-none border-border bg-background" />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">City / town</Label>
          <Input value={draft.city} onChange={(e) => update("city", e.target.value)} placeholder="e.g. Sydney" className="h-12 rounded-none border-border bg-background" />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Country</Label>
          <Input value={draft.country} onChange={(e) => update("country", e.target.value)} placeholder="e.g. Australia" className="h-12 rounded-none border-border bg-background" />
        </div>
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Team you support</Label>
          <Select value={draft.favourite_team} onValueChange={(value) => update("favourite_team", value)}>
            <SelectTrigger className="rounded-none">
              <SelectValue placeholder="Select a team">
                {draft.favourite_team ? (
                  <span className="flex items-center gap-2">
                    <TeamCrest name={draft.favourite_team} logo={selectedLogo} className="h-5 w-5 text-[8px]" />
                    {draft.favourite_team}
                  </span>
                ) : "Select a team"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectGroup>
                <SelectLabel>NRL</SelectLabel>
                {nrl.map(TeamOption)}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Betfred Super League</SelectLabel>
                {sl.map(TeamOption)}
              </SelectGroup>
              {other.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Other clubs</SelectLabel>
                  {other.map(TeamOption)}
                </SelectGroup>
              )}
              <SelectGroup>
                <SelectLabel>&nbsp;</SelectLabel>
                <SelectItem value="Other">Other / not listed</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Avatar</Label>
          <div className="flex items-center gap-3">
            {draft.avatar_url && <img src={draft.avatar_url} alt="Avatar" className="h-12 w-12 rounded-none border border-border object-cover" />}
            <div className="flex-1"><MediaUploader label="Upload avatar" accept="image/*" onUploaded={(url) => update("avatar_url", url)} /></div>
          </div>
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Bio</Label>
          <Textarea value={draft.bio} onChange={(e) => update("bio", e.target.value)} placeholder="A line or two about you (optional)" className="min-h-20 rounded-none" />
        </div>
      </div>

      {/* Forum visibility — what shows next to your name on the forum */}
      <div className="grid gap-3 border border-border bg-card p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Forum profile</p>
        <label className="flex items-center justify-between text-sm">
          <span>Show my location (city / country) next to my name on the forum</span>
          <Switch checked={draft.show_location_on_forum} onCheckedChange={(value) => update("show_location_on_forum", value)} />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span>Show the team I support next to my name on the forum</span>
          <Switch checked={draft.show_team_on_forum} onCheckedChange={(value) => update("show_team_on_forum", value)} />
        </label>
      </div>

      <label className="flex items-center justify-between border border-border bg-card p-4 text-sm">
        <span>Email me about packages, events and merch drops</span>
        <Switch checked={draft.marketing_opt_in} onCheckedChange={(value) => update("marketing_opt_in", value)} />
      </label>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="rounded-none bg-primary hover:bg-primary/90 shadow-[0_0_15px_hsl(var(--primary)/0.2)] hover:shadow-[0_0_25px_hsl(var(--primary)/0.4)] transition-all duration-300">
          <Save className="mr-2 h-4 w-4" /> {saveMutation.isPending ? "Saving..." : "Save profile"}
        </Button>
      </div>
    </div>
  );
}
