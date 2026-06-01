import React, { useId, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";

// Compact media attach control for forum composers: paste an image/GIF/video URL
// or upload a file. Calls onChange(url).
export default function MediaAttach({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const inputId = useId();

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(file_url);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Image / GIF / video URL (optional)"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 rounded-none text-sm"
        />
        <input id={inputId} type="file" accept="image/*,video/*" className="hidden" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
        <label htmlFor={inputId} className={`inline-flex shrink-0 cursor-pointer items-center gap-1 border border-border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors hover:border-primary hover:text-foreground ${uploading ? "pointer-events-none opacity-60" : ""}`}>
          <Paperclip className="h-3.5 w-3.5" /> {uploading ? "…" : "Attach"}
        </label>
        {value && (
          <button type="button" onClick={() => onChange("")} className="shrink-0 border border-border p-2 text-muted-foreground hover:text-destructive" aria-label="Remove media">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
