import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Trash2, Save } from "lucide-react";

const emptyArticle = { title: "", body: "", image_url: "", published_date: new Date().toISOString().slice(0, 10), author: "RLT Vegas", is_published: true };

export default function NewsManager({ articles }) {
  const [draft, setDraft] = useState(emptyArticle);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const createMutation = useMutation({ mutationFn: (data) => base44.entities.NewsArticle.create(data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["news"] }); setDraft(emptyArticle); } });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.NewsArticle.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["news"] }) });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.NewsArticle.update(id, data), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["news"] }) });

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setDraft((current) => ({ ...current, image_url: file_url }));
    setUploading(false);
  };

  return (
    <section id="news-admin" className="scroll-mt-28 border border-border bg-card p-6">
      <h2 className="font-display text-4xl uppercase">News Articles</h2>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <Input placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="rounded-none" />
        <Input type="date" value={draft.published_date} onChange={(e) => setDraft({ ...draft, published_date: e.target.value })} className="rounded-none" />
        <Input placeholder="Image URL" value={draft.image_url} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} className="rounded-none md:col-span-2" />
        <Input type="file" accept="image/*" disabled={uploading} onChange={(e) => uploadImage(e.target.files?.[0])} className="rounded-none md:col-span-2" />
        <Textarea placeholder="Article body" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="min-h-28 rounded-none md:col-span-2" />
        <Button onClick={() => createMutation.mutate(draft)} disabled={!draft.title || createMutation.isPending} className="rounded-none bg-primary hover:bg-primary/90 md:col-span-2">
          <Save className="mr-2 h-4 w-4" /> Add News Article
        </Button>
      </div>

      <div className="mt-8 grid gap-4">
        {articles.map((article) => (
          <div key={article.id} className="grid gap-4 border border-border p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="grid gap-2 md:grid-cols-2">
              <Input defaultValue={article.title || ""} onBlur={(e) => updateMutation.mutate({ id: article.id, data: { title: e.target.value } })} className="rounded-none" />
              <Input type="date" defaultValue={article.published_date || ""} onBlur={(e) => updateMutation.mutate({ id: article.id, data: { published_date: e.target.value } })} className="rounded-none" />
              <Input defaultValue={article.author || ""} onBlur={(e) => updateMutation.mutate({ id: article.id, data: { author: e.target.value } })} className="rounded-none" />
              <Input defaultValue={article.image_url || ""} onBlur={(e) => updateMutation.mutate({ id: article.id, data: { image_url: e.target.value } })} className="rounded-none" />
              <Textarea defaultValue={article.body || ""} onBlur={(e) => updateMutation.mutate({ id: article.id, data: { body: e.target.value } })} className="min-h-24 rounded-none md:col-span-2" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={article.is_published !== false} onCheckedChange={(value) => updateMutation.mutate({ id: article.id, data: { is_published: value } })} />
              <Button variant="destructive" size="icon" className="rounded-none" onClick={() => deleteMutation.mutate(article.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}