import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { useAuth } from "@/lib/AuthContext";
import { isNativeApp } from "@/lib/native/native-env";
import PushNotificationToggle from "@/components/account/PushNotificationToggle";
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
  forum_mentions_opt_in: user?.forum_mentions_opt_in !== false,
  push_opt_in: user?.push_opt_in === true,
});

export default function ProfileTab() {
  const { user, updateProfile } = useAuth();
  const [draft, setDraft] = useState(() => profileFields(user));

  const originalSnapshot = useMemo(() => JSON.stringify(profileFields(user)), [user]);
  const isDirty = JSON.stringify(draft) !== originalSnapshot;

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

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
    onError: (error) => toast({ title: "Save failed", description: error.message, variant: "destructive" }),
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
      {isDirty && (
        <div className="sticky top-0 z-20 flex items-center gap-2 border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-400">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          You have unsaved changes
        </div>
      )}
      <div className="grid gap-5 border border-border bg-card p-6 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="profile-full-name" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Full name</Label>
          <Input id="profile-full-name" value={draft.full_name} onChange={(e) => update("full_name", e.target.value)} className="h-12 rounded-none border-border bg-background" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-email" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Email</Label>
          <Input id="profile-email" value={user?.email || ""} disabled className="h-12 rounded-none opacity-70" />
          <p className="text-[10px] text-muted-foreground mt-1">Contact support to change your email</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-phone" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Phone</Label>
          <Input id="profile-phone" value={draft.phone} onChange={(e) => update("phone", e.target.value)} className="h-12 rounded-none border-border bg-background" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-postcode" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Postcode</Label>
          <Input id="profile-postcode" value={draft.postcode} onChange={(e) => update("postcode", e.target.value)} className="h-12 rounded-none border-border bg-background" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-city" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">City / town</Label>
          <Input id="profile-city" value={draft.city} onChange={(e) => update("city", e.target.value)} placeholder="e.g. Sydney" className="h-12 rounded-none border-border bg-background" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-country" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Country</Label>
          <Input id="profile-country" value={draft.country} onChange={(e) => update("country", e.target.value)} placeholder="e.g. Australia" className="h-12 rounded-none border-border bg-background" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-team" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Team you support</Label>
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
          <Label htmlFor="profile-avatar" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Avatar</Label>
          <div className="flex items-center gap-3">
            {draft.avatar_url && <img src={draft.avatar_url} alt="Avatar" className="h-12 w-12 rounded-none border border-border object-cover" />}
            <div className="flex-1"><MediaUploader label="Upload avatar" accept="image/*" onUploaded={(url) => update("avatar_url", url)} /></div>
          </div>
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor="profile-bio" className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Bio</Label>
          <Textarea id="profile-bio" value={draft.bio} onChange={(e) => update("bio", e.target.value)} placeholder="A line or two about you (optional)" className="min-h-20 rounded-none" />
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

      {/* Notification Preferences */}
      <div className="grid gap-4 border border-border bg-card p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Notification Preferences</p>
        <div className="space-y-4">
          <label className="flex items-center justify-between text-sm cursor-pointer select-none">
            <div className="space-y-0.5 pr-4">
              <span className="font-semibold">Email Alerts</span>
              <p className="text-xs text-muted-foreground">Get notified about package updates, event tickets, and exclusive merchandise releases.</p>
            </div>
            <Switch checked={draft.marketing_opt_in} onCheckedChange={(value) => update("marketing_opt_in", value)} />
          </label>
          <label className="flex items-center justify-between text-sm cursor-pointer select-none border-t border-border/10 pt-4">
            <div className="space-y-0.5 pr-4">
              <span className="font-semibold">Forum Mentions &amp; Replies</span>
              <p className="text-xs text-muted-foreground">Receive instant alerts when someone mentions you or replies to your threads.</p>
            </div>
            <Switch checked={draft.forum_mentions_opt_in} onCheckedChange={(value) => update("forum_mentions_opt_in", value)} />
          </label>
          {isNativeApp() ? (
            <PushNotificationToggle />
          ) : (
            <label className="flex items-center justify-between text-sm cursor-pointer select-none border-t border-border/10 pt-4">
              <div className="space-y-0.5 pr-4">
                <span className="font-semibold">Browser Push Notifications</span>
                <p className="text-xs text-muted-foreground">Stay updated on match countdowns and ticket alerts even when you're offline.</p>
              </div>
              <Switch checked={draft.push_opt_in} onCheckedChange={(value) => update("push_opt_in", value)} />
            </label>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="rounded-none bg-primary hover:bg-primary/90 shadow-[0_0_15px_hsl(var(--primary)/0.2)] hover:shadow-[0_0_25px_hsl(var(--primary)/0.4)] transition-all duration-300">
          <Save className="mr-2 h-4 w-4" /> {saveMutation.isPending ? "Saving..." : "Save profile"}
        </Button>
      </div>
    </div>
  );
}
