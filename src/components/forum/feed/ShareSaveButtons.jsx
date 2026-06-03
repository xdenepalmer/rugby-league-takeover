/* ━━━ Share / Save thread buttons ━━━━━━━━━━━━━━━━━━━━━━━
 * Extracted verbatim from src/pages/Forum.jsx (behaviour-preserving).
 */
import React, { useState } from "react";
import { Share2, Bookmark } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { threadUrl } from "./forumHelpers";

export async function shareThread(post) {
  const url = threadUrl(post);
  const title = post?.title || "Rugby League Takeover forum";
  try {
    if (navigator.share) {
      await navigator.share({ title, text: title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: "Thread link copied to your clipboard." });
  } catch {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Thread link copied to your clipboard." });
    } catch {
      toast({ title: "Couldn't share", description: url });
    }
  }
}

const SAVED_KEY = "rlt_saved_posts";
const getSavedPosts = () => {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); } catch { return []; }
};
const isPostSaved = (id) => getSavedPosts().includes(id);
const toggleSavedPost = (id) => {
  const saved = getSavedPosts();
  const next = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next.includes(id);
};

export function ShareButton({ post }) {
  return (
    <button type="button" onClick={() => shareThread(post)} title="Share / copy link" className="forum-action-button flex min-h-11 items-center justify-center gap-1.5 border border-transparent px-3 py-2 text-xs text-slate-300 transition-colors hover:text-foreground">
      <Share2 className="h-3.5 w-3.5" />
    </button>
  );
}

export function SaveButton({ post }) {
  const [saved, setSaved] = useState(() => isPostSaved(post?.id));
  const onToggle = () => {
    const now = toggleSavedPost(post?.id);
    setSaved(now);
    window.dispatchEvent(new CustomEvent("rlt_saved_posts_changed"));
    toast({ title: now ? "Saved" : "Removed", description: now ? "Added to your saved threads." : "Removed from saved threads." });
  };
  return (
    <button type="button" onClick={onToggle} title={saved ? "Saved" : "Save thread"} className={`forum-action-button flex min-h-11 items-center justify-center gap-1.5 border border-transparent px-3 py-2 text-xs transition-colors ${saved ? "text-primary" : "text-slate-300 hover:text-foreground"}`}>
      <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-primary" : ""}`} />
    </button>
  );
}
