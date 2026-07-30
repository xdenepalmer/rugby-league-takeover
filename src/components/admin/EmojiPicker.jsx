import React, { useState } from "react";
import { Smile } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

// A tiny dependency-free emoji picker for admin text fields (used by the
// Scrolling Banner editor). Curated toward the Vegas / rugby-league / event
// vibe rather than a full Unicode set — a short, on-brand list is faster to
// scan than thousands of glyphs. onSelect receives the chosen emoji so the
// caller can insert it at the textarea's cursor.
const EMOJI_GROUPS = [
  {
    label: "Rugby & Sport",
    emojis: ["🏉", "🏆", "🥇", "🎯", "🔥", "💪", "⚡", "🚀", "📣", "🙌", "👊", "🤝"],
  },
  {
    label: "Vegas & Party",
    emojis: ["🎰", "🎲", "🃏", "💰", "💎", "🎉", "🎊", "🥳", "🍾", "🥂", "🌴", "🌃"],
  },
  {
    label: "Travel & Events",
    emojis: ["✈️", "🌎", "🎟️", "📅", "📍", "🏟️", "🏝️", "🏊", "🎤", "🎵", "⭐", "✨"],
  },
  {
    label: "Emphasis",
    emojis: ["❗", "‼️", "⚠️", "👉", "👀", "❤️", "🧡", "💛", "🔴", "🟠", "🟡", "✅"],
  },
];

export default function EmojiPicker({ onSelect, ariaLabel = "Insert emoji" }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="inline-flex h-8 items-center gap-1.5 border border-border/60 bg-muted/20 px-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <Smile className="h-3.5 w-3.5" />
          Emoji
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="max-h-64 space-y-3 overflow-y-auto">
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
              <div className="grid grid-cols-6 gap-1">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onSelect(emoji);
                      setOpen(false);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded text-lg transition-colors hover:bg-primary/15"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
