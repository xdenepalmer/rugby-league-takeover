/**
 * Shared forum write-path hooks. Same edge-function contracts the web Forum
 * page uses (submitForumPost / forumAction) and the same cache keys, so a
 * post created natively appears on the web instantly and vice versa. No
 * business rules here — sanitising, bans, rewards and notification fan-out
 * all stay server-side.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { buildPendingForumPost } from "@/lib/public-forms";
import { toast } from "@/components/ui/use-toast";
import { emitHaptic } from "@/lib/native/haptic-events";

export function useSubmitForumPost({ onSuccess } = {}) {
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();

  return useMutation({
    mutationFn: async (data) => {
      const authorName = isAuthenticated ? user?.full_name || "Member" : data.author_name;
      const post = buildPendingForumPost({ ...data, author_name: authorName });
      const response = await base44.functions.invoke("submitForumPost", {
        author_name: post.author_name,
        title: post.title,
        body: post.body,
        category: post.category,
        parent_id: post.parent_id,
        media_url: data.media_url || "",
      });
      return { ...response.data, parent_id: post.parent_id };
    },
    onSuccess: (data) => {
      emitHaptic("post.success");
      queryClient.invalidateQueries({ queryKey: ["forumPosts"] });
      queryClient.invalidateQueries({ queryKey: ["forumAvatars"] });
      toast({
        title: data?.id ? "Post published" : "Post submitted",
        description: data?.parent_id ? "Your reply is live." : "Your discussion is now visible in the forum.",
      });
      onSuccess?.(data);
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({
        title: "Couldn't post",
        description: error?.response?.data?.error || error?.data?.error || error.message,
        variant: "destructive",
      });
    },
  });
}

export function useForumReaction(postId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (emoji) => base44.functions.invoke("forumAction", { action: "react", postId, emoji }),
    onMutate: () => emitHaptic("forum.react"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forumPosts"] });
      queryClient.invalidateQueries({ queryKey: ["forumAvatars"] });
    },
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Reaction failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useReportPost() {
  return useMutation({
    mutationFn: ({ postId, reason }) => base44.functions.invoke("forumAction", { action: "report", postId, reason }),
    onMutate: () => emitHaptic("mutation.warning"),
    onSuccess: () => toast({ title: "Reported", description: "Thanks — the crew will take a look." }),
    onError: (error) => {
      emitHaptic("mutation.error");
      toast({ title: "Report failed", description: error.message, variant: "destructive" });
    },
  });
}

/** Fire-and-forget view count, once per session per thread (shared key with web). */
export function recordThreadView(postId) {
  try {
    const key = `rlt_viewed_${postId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    base44.functions.invoke("forumAction", { action: "view", postId }).catch(() => {});
  } catch {
    // Non-critical.
  }
}
