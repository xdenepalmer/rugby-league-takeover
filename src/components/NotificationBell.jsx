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
        <button 
          className={`relative flex h-11 w-11 items-center justify-center border transition-all duration-300 bg-secondary/40 cursor-pointer ${
            unread.length > 0
              ? "border-primary/50 text-primary shadow-[0_0_10px_rgba(249,115,22,0.15)] animate-pulse"
              : "border-border text-muted-foreground hover:border-primary hover:text-foreground hover:shadow-[0_0_10px_rgba(249,115,22,0.15)]"
          }`}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute -right-1 -top-1.5 flex h-4 min-w-[16px] items-center justify-center bg-primary px-1 text-[8.5px] font-bold tabular-nums text-white rounded-none shadow-[0_0_10px_hsl(var(--primary))]">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-none bg-background/95 border-border cmd-glass shadow-2xl p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-secondary/20">
          <p className="font-display text-[10px] font-bold uppercase tracking-widest text-foreground">Notifications</p>
          {unread.length > 0 && (
            <button 
              onClick={() => markAllRead.mutate()} 
              className="flex items-center gap-1 text-[9px] uppercase tracking-widest font-mono text-muted-foreground hover:text-primary transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto cmd-scrollbar">
          {notifications.length === 0 && (
            <p className="px-4 py-12 text-center text-xs font-mono tracking-wider text-muted-foreground uppercase">
              No new alerts
            </p>
          )}
          {notifications.map((n) => {
            const Icon = typeIcon(n.type);
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={`flex w-full items-start gap-3 border-b border-border/40 px-4 py-3.5 text-left transition-all duration-300 hover:bg-secondary/60 ${
                  n.is_read !== true ? "bg-primary/5" : ""
                }`}
              >
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border transition-colors ${
                  n.is_read !== true 
                    ? "border-primary/40 text-primary bg-primary/5" 
                    : "border-border/60 text-muted-foreground bg-muted/10"
                }`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-foreground leading-snug">{n.title || "Notification"}</p>
                  {n.preview && <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{n.preview}</p>}
                  <p className="mt-1.5 text-[8.5px] font-mono tracking-wider text-muted-foreground uppercase">{relativeTime(n.created_date)}</p>
                </div>
                {n.is_read !== true && (
                  <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-none bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                )}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
