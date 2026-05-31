import React, { useState, useRef, useCallback } from "react";
import { FileImage, FileVideo, File, CheckCircle, AlertCircle, CloudUpload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";

function getFileIcon(accept) {
  if (accept?.includes("video")) return FileVideo;
  if (accept?.includes("image")) return FileImage;
  return File;
}

export default function MediaUploader({ label, accept = "image/*,video/*", onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState(null); // null | "success" | "error"
  const [fileName, setFileName] = useState("");
  const inputRef = useRef(null);
  const FileIcon = getFileIcon(accept);

  const upload = useCallback(async (file) => {
    if (!file) return;
    setUploading(true);
    setFileName(file.name);
    setStatus(null);
    setProgress(0);

    // Simulate progress since the API doesn't expose it
    const progressInterval = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) { clearInterval(progressInterval); return 90; }
        return p + Math.random() * 15;
      });
    }, 200);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      clearInterval(progressInterval);
      setProgress(100);
      setStatus("success");
      onUploaded(file_url);
      setTimeout(() => { setStatus(null); setProgress(0); setFileName(""); }, 2500);
    } catch {
      clearInterval(progressInterval);
      setStatus("error");
      setProgress(0);
    } finally {
      setUploading(false);
    }
  }, [onUploaded]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) upload(file);
  }, [upload]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  return (
    <div className="grid gap-2">
      {label && (
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`
          relative overflow-hidden cursor-pointer border-2 border-dashed transition-all duration-300
          cmd-glass
          ${dragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border/60 hover:border-primary/30 hover:bg-muted/10"
          }
          ${uploading ? "pointer-events-none" : ""}
        `}
      >
        {/* Progress bar overlay */}
        <AnimatePresence>
          {(uploading || progress > 0) && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: progress / 100 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute bottom-0 left-0 h-[3px] w-full origin-left bg-gradient-to-r from-primary via-accent to-primary"
              style={{ transformOrigin: "left" }}
            />
          )}
        </AnimatePresence>

        <div className="flex flex-col items-center justify-center py-6 px-4 gap-3">
          <AnimatePresence mode="wait">
            {status === "success" ? (
              <motion.div
                key="success"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="p-3 border border-emerald-500/20 bg-emerald-500/10"
              >
                <CheckCircle className="h-6 w-6 text-emerald-400" />
              </motion.div>
            ) : status === "error" ? (
              <motion.div
                key="error"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="p-3 border border-destructive/20 bg-destructive/10"
              >
                <AlertCircle className="h-6 w-6 text-destructive" />
              </motion.div>
            ) : uploading ? (
              <motion.div
                key="uploading"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="p-3 border border-primary/20 bg-primary/5"
              >
                <CloudUpload className="h-6 w-6 text-primary animate-pulse" />
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="p-3 border border-border/40 bg-muted/10 group-hover:border-primary/20 transition-colors"
              >
                <FileIcon className="h-6 w-6 text-muted-foreground/50" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Text */}
          <div className="text-center">
            {status === "success" ? (
              <p className="text-xs font-bold text-emerald-400">Upload complete</p>
            ) : status === "error" ? (
              <p className="text-xs font-bold text-destructive">Upload failed — try again</p>
            ) : uploading ? (
              <>
                <p className="text-xs font-bold text-foreground">Uploading…</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                  {Math.round(progress)}%{fileName && ` · ${fileName}`}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-bold text-foreground">
                  Drop file here or <span className="text-primary">browse</span>
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {accept === "image/*" ? "PNG, JPG, WebP" : accept === "video/*" ? "MP4, MOV, WebM" : "Images & videos supported"}
                </p>
              </>
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={uploading}
          onChange={(e) => upload(e.target.files?.[0])}
          className="hidden"
        />
      </div>
    </div>
  );
}
