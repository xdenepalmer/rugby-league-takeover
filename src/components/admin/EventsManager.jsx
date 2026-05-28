import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export default function EventsManager({ event }) {
  const [draft, setDraft] = useState(event || { title: "Events Coming Soon", blurb: "", photo_urls: [], is_coming_soon: true });
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (event) setDraft(event);
  }, [event?.id]);

  const saveMutation = useMutation({
    mutationFn: (data) => data.id ? base44.entities.EventContent.update(data.id, data) : base44.entities.EventContent.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  const uploadPhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setDraft((current) => ({ ...current, photo_urls: [file_url] }));
    setUploading(false);
  };

  return (
    <section className="border border-border bg-card p-6">
      <h2 className="font-display text-4xl uppercase">Events Content</h2>
      <div className="mt-6 grid gap-3">
        <Input placeholder="Event title" value={draft.title || ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="rounded-none" />
        <Textarea placeholder="Event blurb" value={draft.blurb || ""} onChange={(e) => setDraft({ ...draft, blurb: e.target.value })} className="min-h-28 rounded-none" />
        <Input placeholder="Photo URL" value={draft.photo_urls?.[0] || ""} onChange={(e) => setDraft({ ...draft, photo_urls: [e.target.value] })} className="rounded-none" />
        <Input type="file" accept="image/*" disabled={uploading} onChange={(e) => uploadPhoto(e.target.files?.[0])} className="rounded-none" />
        <label className="flex items-center justify-between border border-border p-4 text-sm">
          Coming soon status
          <Switch checked={draft.is_coming_soon !== false} onCheckedChange={(value) => setDraft({ ...draft, is_coming_soon: value })} />
        </label>
        <Button onClick={() => saveMutation.mutate(draft)} className="rounded-none bg-primary hover:bg-primary/90">Save Event Content</Button>
      </div>
    </section>
  );
}