import React, { useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, ImageIcon, ZoomIn } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { useNativeCamera } from "@/hooks/useNativeCamera";

// Unified image control used everywhere a picture is set: paste a URL OR upload
// a file, with a live thumbnail and clear button. Commits the value via onChange
// on blur, upload or clear (so it works for both create drafts and inline edits).
export default function ImageField({ value, onChange, label = "Image", className = "" }) {
  const [url, setUrl] = useState(value || "");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inputId = useId();
  const progressRef = useRef(null);
  const { pickMedia, isNative } = useNativeCamera();

  useEffect(() => { setUrl(value || ""); }, [value]);

  const commit = (next) => { setUrl(next); onChange(next); };

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    // Simulate progress since base44 doesn't expose real progress
    progressRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) { clearInterval(progressRef.current); return prev; }
        return prev + Math.random() * 15;
      });
    }, 200);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      clearInterval(progressRef.current);
      setProgress(100);
      setTimeout(() => {
        commit(file_url);
        setProgress(0);
      }, 400);
    } finally {
      clearInterval(progressRef.current);
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith("image/")) upload(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const handleNativeClick = async (e) => {
    if (isNative) {
      e.preventDefault();
      if (uploading) return;
      const file = await pickMedia();
      if (file) upload(file);
    }
  };

  return (
    <div className={`grid gap-2 ${className}`}>
      {label && (
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
      )}

      <div className="flex items-start gap-4">
        {/* Thumbnail / Drop Zone */}
        <AnimatePresence mode="wait">
          {url ? (
            <motion.div
              key="thumb"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
              className="relative h-24 w-24 shrink-0 overflow-hidden border border-border bg-secondary group/thumb"
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
            >
              <img src={url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover/thumb:scale-110" />

              {/* Hover overlay */}
              <AnimatePresence>
                {hovered && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2"
                  >
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-11 w-11 items-center justify-center bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Open image"
                    >
                      <ZoomIn className="h-4 w-4 text-white" />
                    </a>
                    <button
                      type="button"
                      onClick={() => commit("")}
                      className="flex h-11 w-11 items-center justify-center bg-destructive/30 border border-destructive/40 hover:bg-destructive/50 transition-colors"
                      aria-label="Remove image"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={(e) => {
                if (isNative) {
                  handleNativeClick(e);
                } else {
                  document.getElementById(inputId)?.click();
                }
              }}
              className={`relative flex h-24 w-24 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed transition-all duration-300 ${
                dragOver
                  ? "border-primary bg-primary/10 scale-105"
                  : "border-border/60 bg-muted/10 hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              <motion.div
                animate={dragOver ? { scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] } : {}}
                transition={{ duration: 0.4 }}
              >
                <ImageIcon className={`h-6 w-6 transition-colors duration-200 ${dragOver ? "text-primary" : "text-muted-foreground/40"}`} />
              </motion.div>
              <span className="text-[7px] font-bold uppercase tracking-wider text-muted-foreground/50">
                Drop image
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* URL input + upload button */}
        <div className="grid flex-1 gap-2.5">
          <Input
            placeholder="Paste image URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => onChange(url)}
            className="h-11 rounded-none"
          />

          {/* Upload progress bar */}
          <AnimatePresence>
            {uploading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="h-1.5 w-full bg-muted/30 border border-border/40 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary via-accent to-primary"
                    style={{ backgroundSize: "200% 100%" }}
                    initial={{ width: "0%" }}
                    animate={{ width: `${Math.min(progress, 100)}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>
                <p className="text-[8px] font-mono text-primary/70 mt-1 tracking-wider">
                  UPLOADING — {Math.round(Math.min(progress, 100))}%
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {!isNative && (
            <input
              id={inputId}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => upload(e.target.files?.[0])}
            />
          )}
          <label
            htmlFor={!isNative ? inputId : undefined}
            onClick={(e) => { if (isNative) handleNativeClick(e); }}
            className={`inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 border cmd-glass sm:w-fit ${
              uploading
                ? "pointer-events-none opacity-60 border-border/40"
                : "border-border/60 hover:border-primary/40 hover:text-primary hover:bg-primary/5"
            }`}
          >
            <Upload className="h-4 w-4" />
            {uploading ? (
              <span className="flex items-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="inline-block h-3 w-3 border-2 border-primary/30 border-t-primary rounded-full"
                />
                Uploading…
              </span>
            ) : (
              "Upload image"
            )}
          </label>
        </div>
      </div>
    </div>
  );
}
