import React, { useId, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useNativeCamera } from "@/hooks/useNativeCamera";

// Compact media attach control for forum composers: paste an image/GIF/video URL
// or upload a file. Calls onChange(url).
export default function MediaAttach({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const inputId = useId();
  const { pickMedia, isNative } = useNativeCamera();

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(file_url);
    } catch (error) {
      // A swallowed failure here meant the post quietly shipped WITHOUT the
      // photo the fan thought they attached.
      toast({
        title: "Upload failed",
        description: error?.message || "Couldn't upload that file — please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleNativeClick = async (e) => {
    if (isNative) {
      e.preventDefault();
      if (uploading) return;
      try {
        const file = await pickMedia();
        if (file) await upload(file);
      } catch {
        toast({ title: "Couldn't open the photo picker", variant: "destructive" });
      }
    }
  };

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
          <input
            id={inputId}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Reset so choosing the SAME file again re-fires change —
              // without this, remove-then-reattach did nothing.
              e.target.value = "";
              upload(file);
            }}
          />
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
