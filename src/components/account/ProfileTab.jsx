import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { SUPPORTED_TEAMS } from "@/lib/public-forms";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MediaUploader from "@/components/admin/MediaUploader";

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

  const saveMutation = useMutation({
    mutationFn: () => updateProfile(draft),
    onSuccess: () => toast({ title: "Profile saved", description: "Your details have been updated." }),
  });

  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  return (
    <div className="grid gap-6">
      <div className="grid gap-5 border border-border bg-card p-6 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Full name</Label>
          <Input value={draft.full_name} onChange={(e) => update("full_name", e.target.value)} className="rounded-none" />
        </div>
        <div className="grid gap-2">
          <Label>Email</Label>
          <Input value={user?.email || ""} disabled className="rounded-none opacity-70" />
        </div>
        <div className="grid gap-2">
          <Label>Phone</Label>
          <Input value={draft.phone} onChange={(e) => update("phone", e.target.value)} className="rounded-none" />
        </div>
        <div className="grid gap-2">
          <Label>Postcode</Label>
          <Input value={draft.postcode} onChange={(e) => update("postcode", e.target.value)} className="rounded-none" />
        </div>
        <div className="grid gap-2">
          <Label>City / town</Label>
          <Input value={draft.city} onChange={(e) => update("city", e.target.value)} placeholder="e.g. Sydney" className="rounded-none" />
        </div>
        <div className="grid gap-2">
          <Label>Country</Label>
          <Input value={draft.country} onChange={(e) => update("country", e.target.value)} placeholder="e.g. Australia" className="rounded-none" />
        </div>
        <div className="grid gap-2">
          <Label>Team you support</Label>
          <Select value={draft.favourite_team} onValueChange={(value) => update("favourite_team", value)}>
            <SelectTrigger className="rounded-none"><SelectValue placeholder="Select a team" /></SelectTrigger>
            <SelectContent>{SUPPORTED_TEAMS.map((team) => <SelectItem key={team} value={team}>{team}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Avatar</Label>
          <div className="flex items-center gap-3">
            {draft.avatar_url && <img src={draft.avatar_url} alt="Avatar" className="h-12 w-12 rounded-full border border-border object-cover" />}
            <div className="flex-1"><MediaUploader label="Upload avatar" accept="image/*" onUploaded={(url) => update("avatar_url", url)} /></div>
          </div>
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>Bio</Label>
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
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="rounded-none bg-primary hover:bg-primary/90">
          <Save className="mr-2 h-4 w-4" /> {saveMutation.isPending ? "Saving..." : "Save profile"}
        </Button>
      </div>
    </div>
  );
}
