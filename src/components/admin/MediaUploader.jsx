import React, { useState } from "react";
import { Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function MediaUploader({ label, accept = "image/*,video/*", onUploaded }) {
  const [uploading, setUploading] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onUploaded(file_url);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-2">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input type="file" accept={accept} disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} className="rounded-none" />
        <Button type="button" variant="outline" disabled={uploading} className="rounded-none">
          <Upload className="mr-2 h-4 w-4" /> {uploading ? "Uploading" : "Upload"}
        </Button>
      </div>
    </div>
  );
}
