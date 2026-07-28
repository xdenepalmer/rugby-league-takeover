import React, { useId } from "react";
import { Paperclip, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMediaUpload } from "@/hooks/useMediaUpload";

// Compact media attach control for forum composers: paste an image/GIF/video URL
// or upload a file. Calls onChange(url).
export default function MediaAttach({ value, onChange }) {
  const inputId = useId();
  const { uploading, upload, handleNativeClick, isNative } = useMediaUpload(onChange);

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Image / GIF / video URL (optional)"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 rounded-none text-sm"
        />
        {!isNative && (
          <input id={inputId} type="file" accept="image/*,video/*" className="hidden" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
        )}
        <label htmlFor={!isNative ? inputId : undefined} onClick={(e) => { if (isNative) handleNativeClick(e); }} className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1 border border-border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors hover:border-primary hover:text-foreground ${uploading ? "pointer-events-none opacity-60" : ""}`}>
          <Paperclip className="h-3.5 w-3.5" /> {uploading ? "…" : "Attach"}
        </label>
        {value && (
          <button type="button" onClick={() => onChange("")} className="flex h-11 w-11 shrink-0 items-center justify-center border border-border text-muted-foreground hover:text-destructive" aria-label="Remove media">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
