/* ━━━ useMediaUpload ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Upload-a-file plumbing shared by the forum composer and admin photo pickers:
 * tracks the in-flight state, pushes the file through the backend uploader and
 * hands the resulting URL back. On native builds the click is intercepted so the
 * Capacitor camera/library picker runs instead of the hidden <input type=file>.
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNativeCamera } from "@/hooks/useNativeCamera";

export function useMediaUpload(onUploaded) {
  const [uploading, setUploading] = useState(false);
  const { pickMedia, isNative } = useNativeCamera();

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

  const handleNativeClick = async (e) => {
    if (!isNative) return;
    e.preventDefault();
    if (uploading) return;
    const file = await pickMedia();
    if (file) upload(file);
  };

  return { uploading, upload, handleNativeClick, isNative };
}

export default useMediaUpload;
