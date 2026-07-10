/**
 * Shared fan-surface data hooks. These reuse the EXACT query keys and fetch
 * shapes the web pages already use (["news"], ["products"], ["gallery"],
 * ["siteSettings"], …) so web pages and native screens hit one cache and
 * neither platform forks data behavior. Business writes stay in the edge
 * functions — nothing here duplicates authority.
 */
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";

const enabled = () => appParams.hasBase44Config;

export function useSiteSettings() {
  const query = useQuery({
    queryKey: ["siteSettings"],
    queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1),
    enabled: enabled(),
  });
  return { ...query, settings: query.data?.[0] || {} };
}

export function useNewsArticles() {
  return useQuery({
    queryKey: ["news"],
    queryFn: () => base44.entities.NewsArticle.list("-published_date", 50),
    enabled: enabled(),
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Product.list("sort_order", 50),
    enabled: enabled(),
    staleTime: 60000,
  });
}

export function useGalleryItems() {
  return useQuery({
    queryKey: ["gallery"],
    queryFn: () => base44.entities.GalleryItem.filter({ is_published: true }, "sort_order", 500),
    enabled: enabled(),
  });
}

export function useMatchups() {
  return useQuery({
    queryKey: ["matchups"],
    queryFn: () => base44.entities.Matchup.list("sort_order", 50),
    enabled: enabled(),
  });
}

export function useEventContents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.EventContent.list("-updated_date", 5),
    enabled: enabled(),
  });
}

export function useForumPosts() {
  return useQuery({
    queryKey: ["forumPosts"],
    queryFn: () => base44.entities.ForumPost.list("-created_date", 100),
    enabled: enabled(),
    refetchInterval: 30000,
  });
}

export function useForumAvatars() {
  // Stores the raw invoke envelope — Forum.jsx shares this key and reads
  // `data?.data?.avatars`, so the cached shape must stay identical.
  const query = useQuery({
    queryKey: ["forumAvatars"],
    queryFn: () => base44.functions.invoke("forumAvatars", {}),
    enabled: enabled(),
    retry: false,
    staleTime: 60000,
    meta: { silent: true },
  });
  return { ...query, avatars: query.data?.data?.avatars || [] };
}

export function useNotifications(userId) {
  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => base44.entities.Notification.filter({ recipient_id: userId }, "-created_date", 30),
    enabled: enabled() && !!userId,
    refetchInterval: 60000,
    meta: { silent: true },
  });
}
