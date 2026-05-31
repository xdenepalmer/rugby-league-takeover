import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import AdminSection from "./AdminSection";

const emptyPackage = { name: "", description: "", is_coming_soon: true, sort_order: 1 };

export default function TravelPackagesManager({ packages }) {
  const [draft, setDraft] = useState(emptyPackage);
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["packages"] });
  const createMutation = useMutation({ mutationFn: (data) => base44.entities.TravelPackage.create(data), onSuccess: () => { refresh(); setDraft(emptyPackage); } });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.TravelPackage.update(id, data), onSuccess: refresh });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.TravelPackage.delete(id), onSuccess: refresh });

  return (
    <AdminSection id="travel-admin" eyebrow="Step 4" title="Travel packages" description="Create, reorder and edit the package cards shown on the homepage.">
      <div className="grid gap-6">
        <div className="grid gap-3 border border-border bg-background/50 p-4 md:grid-cols-2">
          <Input placeholder="Package name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="rounded-none" />
          <Input type="number" placeholder="Sort order" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="rounded-none" />
          <Textarea placeholder="Package description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="min-h-24 rounded-none md:col-span-2" />
          <label className="flex items-center justify-between border border-border p-4 text-sm md:col-span-2">
            Show as coming soon
            <Switch checked={draft.is_coming_soon !== false} onCheckedChange={(value) => setDraft({ ...draft, is_coming_soon: value })} />
          </label>
          <Button onClick={() => createMutation.mutate(draft)} disabled={!draft.name || createMutation.isPending} className="rounded-none bg-primary hover:bg-primary/90 md:col-span-2">
            <Save className="mr-2 h-4 w-4" /> Add Package
          </Button>
        </div>

        <div className="grid gap-4">
          {packages.map((pkg) => (
            <div key={pkg.id} className="grid gap-3 border border-border p-4 lg:grid-cols-[1fr_1fr_120px_auto] lg:items-center">
              <Input defaultValue={pkg.name || ""} onBlur={(e) => updateMutation.mutate({ id: pkg.id, data: { name: e.target.value } })} className="rounded-none" />
              <Textarea defaultValue={pkg.description || ""} onBlur={(e) => updateMutation.mutate({ id: pkg.id, data: { description: e.target.value } })} className="min-h-20 rounded-none" />
              <Input type="number" defaultValue={pkg.sort_order || 1} onBlur={(e) => updateMutation.mutate({ id: pkg.id, data: { sort_order: Number(e.target.value) } })} className="rounded-none" />
              <div className="flex items-center gap-3">
                <Switch checked={pkg.is_coming_soon !== false} onCheckedChange={(value) => updateMutation.mutate({ id: pkg.id, data: { is_coming_soon: value } })} />
                <Button variant="destructive" size="icon" className="rounded-none" onClick={() => deleteMutation.mutate(pkg.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminSection>
  );
}