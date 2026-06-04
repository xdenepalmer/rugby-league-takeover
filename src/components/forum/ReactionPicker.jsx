import React, { useEffect, useMemo, useState } from "react";
import { Smile, Users, X } from "lucide-react";

const REACTIONS = [
  { emoji: "❤️", label: "Love" },
  { emoji: "🏉", label: "Rugby" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "🎉", label: "Celebrate" },
  { emoji: "👏", label: "Clap" },
];

function normalizeReactions(reactions) {
  const claimed = new Set();
  const next = {};
  REACTIONS.forEach(({ emoji }) => {
    const ids = Array.isArray(reactions?.[emoji]) ? reactions[emoji].map(String).filter(Boolean) : [];
    const unique = [];
    ids.forEach((id) => {
      if (!claimed.has(id)) {
        claimed.add(id);
        unique.push(id);
      }
    });
    if (unique.length) next[emoji] = unique;
  });
  return next;
}

function initials(name) {
  const parts = String(name || "Member").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "M") + (parts[1]?.[0] || "")).toUpperCase();
}

export default function ReactionPicker({ reactions = {}, legacyLikes = 0, currentUserId, isAuthenticated, onReact, isPending, reactionProfiles }) {
  const [open, setOpen] = useState(false);
  const [showReactors, setShowReactors] = useState(false);
  const [local, setLocal] = useState(() => normalizeReactions(reactions));

  useEffect(() => { setLocal(normalizeReactions(reactions)); }, [reactions]);

  const currentId = String(currentUserId || "");
  const chips = useMemo(() => {
    const reactionChips = REACTIONS.map((r) => {
      const ids = local[r.emoji] || [];
      return { ...r, ids, count: ids.length, mine: currentId ? ids.includes(currentId) : false };
    }).filter((c) => c.count > 0);
    if (reactionChips.length === 0 && legacyLikes > 0) return [{ emoji: "❤️", label: "Love", ids: [], count: legacyLikes, mine: false }];
    return reactionChips;
  }, [local, legacyLikes, currentId]);

  const selectedEmoji = useMemo(() => REACTIONS.find((r) => (local[r.emoji] || []).includes(currentId))?.emoji || "", [local, currentId]);
  const total = chips.reduce((sum, c) => sum + c.count, 0);
  const requireLogin = () => { window.location.href = "/login?next=/forum"; };

  const reactorName = (id) => {
    if (currentId && String(id) === currentId) return "You";
    const profile = reactionProfiles?.get?.(String(id));
    return profile?.display_name || profile?.name || "Member";
  };

  const reactorAvatar = (id) => reactionProfiles?.get?.(String(id))?.avatar_url || "";

  const toggle = (emoji) => {
    if (!isAuthenticated) return requireLogin();
    if (!currentId || isPending) return;
    setLocal((prev) => {
      const next = {};
      Object.entries(prev || {}).forEach(([key, ids]) => {
        const filtered = (Array.isArray(ids) ? ids : []).map(String).filter((id) => id !== currentId);
        if (filtered.length) next[key] = filtered;
      });
      if (selectedEmoji !== emoji) next[emoji] = [...(next[emoji] || []), currentId];
      return next;
    });
    onReact(emoji);
    setOpen(false);
  };

  return (
    <div className="relative min-w-0 flex-1 sm:flex-none">
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((c) => (
          <button
            key={c.emoji}
            type="button"
            disabled={isPending}
            onClick={() => toggle(c.emoji)}
            title={c.ids.length ? c.ids.map(reactorName).join(", ") : "Reaction"}
            className={`flex min-h-11 items-center gap-1.5 border px-3 py-1.5 text-xs font-bold transition-all ${
              c.mine ? "border-primary bg-primary/15 text-primary shadow-[0_0_14px_hsl(var(--primary)/0.16)]" : "border-border/40 bg-background/30 text-slate-200 hover:border-primary/35 hover:bg-primary/5"
            }`}
          >
            <span className="text-base leading-none">{c.emoji}</span>
            <span className="tabular-nums">{c.count}</span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => (isAuthenticated ? (selectedEmoji ? setOpen((o) => !o) : toggle("❤️")) : requireLogin())}
          title={selectedEmoji ? "Change your reaction" : "Like this post"}
          aria-label={selectedEmoji ? "Change your reaction" : "Like this post"}
          className={`flex min-h-11 items-center gap-1.5 border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${open ? "border-primary bg-primary/10 text-primary" : "border-border/30 bg-background/20 text-slate-200 hover:border-primary/35 hover:text-primary"}`}
        >
          <Smile className="h-4 w-4" />
          <span className="hidden sm:inline">{selectedEmoji ? "Change" : "Like"}</span>
        </button>

        {total > 0 && (
          <button
            type="button"
            onClick={() => setShowReactors(true)}
            className="flex min-h-11 items-center gap-1.5 border border-border/30 bg-background/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-200 transition-all hover:border-accent/40 hover:text-accent"
            title="See who reacted"
          >
            <Users className="h-3.5 w-3.5" />
            <span>{total}</span>
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 w-full border border-border/60 bg-card/95 p-2 shadow-xl shadow-black/25 backdrop-blur sm:absolute sm:left-0 sm:z-30 sm:w-max">
          <p className="mb-1.5 px-1 text-[8px] font-bold uppercase tracking-[0.25em] text-slate-300">Pick one reaction</p>
          <div className="grid grid-cols-5 gap-1">
            {REACTIONS.map((r) => {
              const mine = selectedEmoji === r.emoji;
              return (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => toggle(r.emoji)}
                  title={mine ? `Remove ${r.label}` : r.label}
                  className={`flex min-h-11 min-w-11 items-center justify-center border text-lg transition-all hover:scale-105 ${mine ? "border-primary bg-primary/15 text-primary" : "border-border/30 bg-background/30 hover:border-primary/35"}`}
                >
                  {r.emoji}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showReactors && (
        <div className="fixed inset-0 z-[120] flex items-end bg-black/60 p-3 sm:items-center sm:justify-center" onClick={() => setShowReactors(false)}>
          <div className="w-full max-w-sm border border-border/70 bg-card shadow-2xl shadow-black/40" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border/40 p-4">
              <div>
                <p className="font-display text-lg uppercase tracking-wide text-foreground">Reactions</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">{total} {total === 1 ? "fan" : "fans"}</p>
              </div>
              <button type="button" onClick={() => setShowReactors(false)} className="flex h-10 w-10 items-center justify-center border border-border/40 text-slate-300 hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[55vh] space-y-4 overflow-y-auto p-4">
              {chips.map((c) => (
                <div key={c.emoji} className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{c.emoji} {c.label} · {c.count}</p>
                  {(c.ids.length ? c.ids : Array.from({ length: c.count }, (_, i) => `legacy-${i}`)).map((id) => {
                    const name = String(id).startsWith("legacy-") ? "Member" : reactorName(id);
                    const avatar = reactorAvatar(id);
                    return (
                      <div key={id} className="flex items-center gap-2 border border-border/25 bg-background/30 px-3 py-2">
                        {avatar ? <img src={avatar} alt={name} className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{initials(name)}</span>}
                        <span className="text-sm font-semibold text-slate-100">{name}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}