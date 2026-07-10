import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BellOff, CheckCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNotifications } from "@/hooks/data/use-fan-data";
import { timeAgo } from "@/components/forum/feed/forumHelpers";
import { emitHaptic } from "@/lib/native/haptic-events";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";

/**
 * Native notification centre — same Notification entity + cache key as the
 * web bell. Tapping marks read and follows the notification's link (thread
 * links resolve onto the native thread route via the forum alias).
 */
export default function NativeNotificationsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: notifications = [], isLoading } = useNotifications(user?.id);
  const unread = notifications.filter((n) => n.is_read !== true);

  const markRead = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => Promise.all(unread.map((n) => base44.entities.Notification.update(n.id, { is_read: true }))),
    onSuccess: () => {
      emitHaptic("save.success");
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  const open = (notification) => {
    emitHaptic("tab.select");
    if (notification.is_read !== true) markRead.mutate(notification.id);
    if (notification.link) {
      try {
        const url = new URL(notification.link, window.location.origin);
        navigate(`${url.pathname}${url.search}`);
      } catch {
        // Malformed link — stay put.
      }
    }
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <NativeTopBar
        title="Notifications"
        fallback="/account"
        right={
          unread.length > 0 ? (
            <button
              type="button"
              aria-label="Mark all read"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
              className="ios-pressable flex h-11 w-11 items-center justify-center text-primary"
            >
              <CheckCheck className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null
        }
      />
      <div className="mx-auto w-full max-w-2xl">
        {isLoading && notifications.length === 0 ? (
          <div className="space-y-2 px-4 pt-4">
            <NativeSkeleton className="h-16 w-full" />
            <NativeSkeleton className="h-16 w-full" />
            <NativeSkeleton className="h-16 w-full" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 pt-8">
            <NativeEmptyState icon={BellOff} title="Nothing yet" description="Replies, mentions and takeover alerts land here." />
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => open(notification)}
              className="ios-pressable flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-left"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.is_read !== true ? "bg-primary" : "bg-transparent"}`}
                aria-label={notification.is_read !== true ? "Unread" : undefined}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{notification.title}</span>
                {notification.preview && (
                  <span className="line-clamp-2 block pt-0.5 text-xs text-muted-foreground">{notification.preview}</span>
                )}
                <span className="block pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  {timeAgo(notification.created_date)}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
