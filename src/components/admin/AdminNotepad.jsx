import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StickyNote, Pencil, Trash2, Check, AlertTriangle } from "lucide-react";

const STORAGE_KEY = "rlt_admin_notes";
const DEBOUNCE_MS = 500;

function loadNotes() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function loadTimestamp() {
  try {
    const ts = localStorage.getItem(STORAGE_KEY + "_ts");
    return ts ? Number(ts) : null;
  } catch {
    return null;
  }
}

function formatTimestamp(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return isToday ? `Today at ${time}` : `${d.toLocaleDateString()} ${time}`;
}

export default function AdminNotepad() {
  const [notes, setNotes] = useState(loadNotes);
  const [lastSaved, setLastSaved] = useState(loadTimestamp);
  const [showSaved, setShowSaved] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const debounceRef = useRef(null);
  const savedTimerRef = useRef(null);
  const confirmTimerRef = useRef(null);

  const persist = useCallback((text) => {
    try {
      const now = Date.now();
      localStorage.setItem(STORAGE_KEY, text);
      localStorage.setItem(STORAGE_KEY + "_ts", String(now));
      setLastSaved(now);

      // flash "Saved ✓"
      setShowSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setShowSaved(false), 1800);
    } catch {
      // storage full — silently ignore
    }
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    setNotes(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist(value), DEBOUNCE_MS);
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    setNotes("");
    persist("");
    setConfirmClear(false);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  };

  // cleanup timers
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="border border-border bg-card/60 cmd-glass overflow-hidden rounded-none"
    >
      {/* Accent bar */}
      <div className="h-[2px] bg-gradient-to-r from-violet-500 via-violet-400 to-violet-500" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <StickyNote className="w-5 h-5 text-violet-400" />
            <Pencil className="w-2.5 h-2.5 text-violet-300 absolute -bottom-0.5 -right-0.5" />
          </div>
          <h3 className="font-display text-sm font-semibold tracking-wide text-foreground uppercase">
            Owner's Notepad
          </h3>
        </div>

        <AnimatePresence>
          {showSaved && (
            <motion.span
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-1 text-xs text-emerald-400 font-medium"
            >
              <Check className="w-3.5 h-3.5" />
              Saved
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Textarea */}
      <div className="p-4">
        <textarea
          value={notes}
          onChange={handleChange}
          placeholder="Jot down notes, reminders, ideas..."
          className="w-full min-h-[200px] bg-black/40 border border-border/40 rounded-none px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 resize-y focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20 transition-colors"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/40 bg-black/20">
        {/* Character count */}
        <span className="text-xs text-muted-foreground tabular-nums">
          {notes.length.toLocaleString()} {notes.length === 1 ? "char" : "chars"}
        </span>

        <div className="flex items-center gap-3">
          {/* Last saved */}
          {lastSaved && (
            <span className="text-xs text-muted-foreground/70">
              Last saved {formatTimestamp(lastSaved)}
            </span>
          )}

          {/* Clear button */}
          <button
            onClick={handleClear}
            className={`flex items-center gap-1 px-2 py-1 rounded-none text-xs font-medium transition-colors ${
              confirmClear
                ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
                : "text-muted-foreground hover:text-red-400 hover:bg-red-500/10 border border-transparent"
            }`}
          >
            {confirmClear ? (
              <>
                <AlertTriangle className="w-3 h-3" />
                Confirm clear?
              </>
            ) : (
              <>
                <Trash2 className="w-3 h-3" />
                Clear
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
