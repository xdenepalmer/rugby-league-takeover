import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  User,
  Bell,
  Package,
  MessageSquare,
  Trophy,
  BarChart3,
  Plane,
  Lock,
  ShieldCheck,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useNotifications } from "@/hooks/data/use-fan-data";
import { ACCOUNT_TAB_ROUTES } from "../../navigation/native-aliases.js";
import { NativeListRow } from "../../components/NativePrimitives.jsx";
import { emitHaptic } from "@/lib/native/haptic-events";
import { hideBrokenImage } from "@/lib/img-fallback";

/**
 * Native Account hub: profile summary + list/detail navigation into the
 * existing account sections (each a full native sub-screen), notification
 * centre, gated Admin entry, sign out. Legacy /account?tab= links are
 * normalized onto the child routes.
 */
export default function NativeAccountScreen() {
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const { data: notifications = [] } = useNotifications(user?.id);
  const unread = notifications.filter((n) => n.is_read !== true).length;

  // Legacy alias: /account?tab=orders → /account/orders
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ACCOUNT_TAB_ROUTES[tab] && ACCOUNT_TAB_ROUTES[tab] !== "/account") {
      navigate(ACCOUNT_TAB_ROUTES[tab], { replace: true });
    }
  }, [searchParams, navigate]);

  const go = (to) => () => {
    emitHaptic("tab.select");
    navigate(to);
  };

  return (
    <div className="mx-auto w-full max-w-2xl pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
      <header className="flex items-center gap-3 px-4 pb-4 pr-28">
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt="" onError={hideBrokenImage} className="h-14 w-14 rounded-full border border-primary/50 object-cover" />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/50 bg-primary/15 font-display text-lg font-bold text-primary">
            {(user?.full_name || user?.email || "?")[0]?.toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-bold uppercase tracking-widest">
            {user?.full_name || "Member"}
          </h1>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </header>

      <div className="border-t border-border/40">
        <NativeListRow icon={Bell} label="Notifications" detail="Replies, mentions and alerts" badge={unread} onClick={go("/account/notifications")} />
        <NativeListRow icon={Sparkles} label="Fan hub" detail="Your takeover activity" onClick={go("/account/fanhub")} />
        <NativeListRow icon={Package} label="Orders" detail="Merch orders and tracking" onClick={go("/account/orders")} />
        <NativeListRow icon={MessageSquare} label="My posts" detail="Threads and replies" onClick={go("/account/posts")} />
        <NativeListRow icon={Trophy} label="Achievements" detail="Badges you've unlocked" onClick={go("/account/achievements")} />
        <NativeListRow icon={BarChart3} label="Leaderboard" detail="Where you rank" onClick={go("/account/leaderboard")} />
        <NativeListRow icon={Plane} label="Trip interest" detail="Your Vegas registration" onClick={go("/account/interest")} />
        <NativeListRow icon={User} label="Profile" detail="Details, avatar, notifications" onClick={go("/account/profile")} />
        <NativeListRow icon={Lock} label="Security" detail="Password and sign-in" onClick={go("/account/security")} />
        {isAdmin && (
          <NativeListRow icon={ShieldCheck} label="Admin" detail="Open the command centre" tone="admin" onClick={go("/admin")} />
        )}
        <NativeListRow
          icon={LogOut}
          label="Sign out"
          tone="danger"
          onClick={() => {
            emitHaptic("mutation.warning");
            logout();
          }}
        />
      </div>

      <p className="px-4 pt-6 text-center text-[9px] uppercase tracking-[0.3em] text-muted-foreground/60">
        Rugby League Takeover — Las Vegas
      </p>
    </div>
  );
}
