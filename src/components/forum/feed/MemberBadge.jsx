import React from "react";
import { ShieldCheck } from "lucide-react";

// The RLT MEMBER pill. One component shared by every surface that renders an
// author (post header, reply tree, thread modal, hover card) — the other flair
// pills are copy-pasted between those files and drift, and a paid-for badge
// showing in some places but not others is worse than not having it.
//
// `meta.is_member` is computed server-side against now() in the forumAvatars
// projection, so a lapsed member simply stops being flagged. Nothing here
// caches it.
export default function MemberBadge({ meta, size = "sm" }) {
  if (!meta?.is_member) return null;
  const text = size === "xs" ? "text-[9px]" : "text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-1 border border-primary/50 bg-gradient-to-r from-primary/25 to-accent/15 px-1.5 py-0.5 font-bold uppercase tracking-wider text-primary ${text}`}
      title="Paid-up Rugby League Takeover member"
    >
      <ShieldCheck className="h-2.5 w-2.5 shrink-0" /> RLT Member
    </span>
  );
}
