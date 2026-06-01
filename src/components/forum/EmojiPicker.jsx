import React, { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

// Comprehensive, categorised emoji set for the forum composer. Curated (not the
// full Unicode table) so the picker stays fast and tidy, but broad enough to
// cover everyday use plus rugby / Vegas flavour.
const EMOJI_GROUPS = [
  { label: "Smileys", emojis: ["😀","😃","😄","😁","😆","😅","😂","🤣","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😋","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","😐","😑","😶","🙄","😏","😴","😪","😌","😎","🤓","🥳","😏","😬","😮‍💨","😤","😢","😭","😱","😳","🥺","😡","🤬","🤯","😈"] },
  { label: "Gestures", emojis: ["👍","👎","👌","🤌","✌️","🤞","🤟","🤙","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🙌","👏","🙏","🤝","💪","👊","✊","🤛","🤜","🫶","👋","🤘"] },
  { label: "Sport", emojis: ["🏉","🏈","⚽","🏀","🎾","🏆","🥇","🥈","🥉","🎽","🏟️","📣","🔥","💯","⏱️","🎯","🤾","🏃","🥅"] },
  { label: "Party", emojis: ["🎉","🎊","🥂","🍻","🍺","🍾","🎆","🎇","✨","🌟","⭐","💫","🎈","🎁","🪩","🕺","💃","🎶","🎵"] },
  { label: "Travel", emojis: ["✈️","🛫","🛬","🧳","🗺️","🏨","🎰","🎲","🌴","🌃","🌆","🏝️","🚕","🗽","🎡","🇺🇸","🇦🇺","🇬🇧"] },
  { label: "Hearts", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","❣️","💕","💞","💓","💗","💖","💘","💝"] },
];

export default function EmojiPicker({ onPick, className = "" }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Add emoji"
        aria-label="Add emoji"
        className="flex h-7 w-7 items-center justify-center border border-border/60 bg-background/80 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <Smile className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-50 mb-1 max-h-64 w-64 overflow-y-auto border border-border bg-card p-2 shadow-xl">
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <p className="px-1 pb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">{group.label}</p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map((emoji, i) => (
                  <button
                    key={`${group.label}-${i}`}
                    type="button"
                    onClick={() => { onPick(emoji); }}
                    className="flex h-7 w-7 items-center justify-center rounded text-lg leading-none transition-colors hover:bg-secondary"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
