import React, { useEffect, useId, useState } from "react";
import { Upload, X, ImageIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";

// Unified image control used everywhere a picture is set: paste a URL OR upload
// a file, with a live thumbnail and clear button. Commits the value via onChange
// on blur, upload or clear (so it works for both create drafts and inline edits).
export default function ImageField({ value, onChange, label = "Image", className = "" }) {
  const [url, setUrl] = useState(value || "");
  const [uploading, setUploading] = useState(false);
  const inputId = useId();

  useEffect(() => { setUrl(value || ""); }, [value]);

  const commit = (next) => { setUrl(next); onChange(next); };

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      commit(file_url);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`grid gap-2 ${className}`}>
      {label && <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>}
      <div className="flex items-start gap-3">
        {url ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden border border-border bg-secondary">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => commit("")} className="absolute right-0 top-0 bg-background/80 p-0.5" aria-label="Remove image"><X className="h-3 w-3" /></button>
          </div>
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-dashed border-border text-muted-foreground"><ImageIcon className="h-4 w-4" /></div>
        )}
        <div className="grid flex-1 gap-2">
          <Input
            placeholder="Paste image URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => onChange(url)}
            className="rounded-none"
          />
          <input id={inputId} type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
          <label
            htmlFor={inputId}
            className={`inline-flex w-fit cursor-pointer items-center border border-border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:border-primary hover:text-foreground ${uploading ? "pointer-events-none opacity-60" : ""}`}
          >
            <Upload className="mr-2 h-4 w-4" /> {uploading ? "Uploading…" : "Upload image"}
          </label>
        </div>
      </div>
    </div>
  );
}
