import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Textarea } from "@/components/ui/textarea";

// Textarea with @mention autocomplete. Detects an @token at the caret, queries
// the searchUsers function, and inserts "@handle " on select. Controlled via
// value/onChange; all other props pass through to the textarea.
export default function MentionTextarea({ value, onChange, ...props }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(null); // { start, text }

  const detect = (text, caret) => {
    const before = text.slice(0, caret);
    const m = before.match(/(^|\s)@([\w.-]{0,30})$/);
    if (!m) return null;
    return { start: caret - m[2].length - 1, text: m[2] };
  };

  const runSearch = (q) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke("searchUsers", { q });
        const users = res?.data?.users || [];
        setSuggestions(users);
        setOpen(users.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, 200);
  };

  const handleChange = (e) => {
    const text = e.target.value;
    onChange(text);
    const t = detect(text, e.target.selectionStart);
    setToken(t);
    if (t) runSearch(t.text);
    else setOpen(false);
  };

  const insert = (user) => {
    if (!token) return;
    const text = value || "";
    const before = text.slice(0, token.start);
    const after = text.slice(token.start + 1 + token.text.length);
    onChange(`${before}@${user.handle} ${after}`);
    setOpen(false);
    setToken(null);
    requestAnimationFrame(() => ref.current?.focus());
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        {...props}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-56 w-64 max-w-full overflow-y-auto border border-border bg-card shadow-xl">
          {suggestions.map((u) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insert(u); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">{(u.name || "?")[0].toUpperCase()}</span>
              <span className="truncate text-foreground">{u.name} <span className="text-muted-foreground">@{u.handle}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
