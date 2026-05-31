import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, MessageSquare, AtSign, CheckCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const relativeTime = (value) => {
  if (!value) return "";
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(String(value).trim());
  const d = new Date(hasTz ? value : `${String(value).trim().replace(" ", "T")}Z`);
  const diff = Date.now() - d.getTime();
  if (Number.isNaN(diff)) return "";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

const typeIcon = (type) => (type === "mention" ? AtSign : MessageSquare);

export default function NotificationBell() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => base44.entities.Notification.filter({ recipient_id: user.id }, "-created_date", 30),
    enabled: Boolean(isAuthenticated && user?.id),
    refetchInterval: 60000,
    retry: false,
    meta: { silent: true },
  });

  const unread = notifications.filter((n) => n.is_read !== true);

  const markRead = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await Promise.all(unread.map((n) => base44.entities.Notification.update(n.id, { is_read: true })));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const open = (notification) => {
    if (notification.is_read !== true) markRead.mutate(notification.id);
    navigate(notification.link || "/forum");
  };

  if (!isAuthenticated) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative flex h-9 w-9 items-center justify-center border border-border transition-colors hover:border-primary" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold tabular-nums text-primary-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-none p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground">Notifications</p>
          {unread.length > 0 && (
            <button onClick={() => markAllRead.mutate()} className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
              <CheckCheck className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">You're all caught up.</p>
          )}
          {notifications.map((n) => {
            const Icon = typeIcon(n.type);
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={`flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-secondary ${n.is_read !== true ? "bg-primary/5" : ""}`}
              >
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border ${n.is_read !== true ? "border-primary/40 text-primary" : "border-border text-muted-foreground"}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{n.title || "Notification"}</p>
                  {n.preview && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.preview}</p>}
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{relativeTime(n.created_date)}</p>
                </div>
                {n.is_read !== true && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
