/**
 * Native iOS Account — "Fan Card". A native profile hub for the Account tab,
 * NOT the web account console. Native-only: reached via the isNativeApp()
 * branch in src/pages/Account.jsx; the web Account is untouched.
 *
 * A gamification hero (avatar, name, rank, chips/XP/streak) sits above native
 * iOS "Settings"-style grouped lists whose rows navigate to the SAME account
 * tabs the web uses (/account?tab=<id>). Reuses the exact same React Query keys,
 * the same useAuth data, and the same VALID_TABS identifiers as Account.jsx, so
 * nothing in the data layer is forked.
 */
import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles, Trophy, User, ShoppingBag, MessageSquare, Heart, Shield,
  ShieldCheck, Coins, Zap, Flame, ChevronRight, LogOut, Store, Calendar,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { format } from "date-fns";
import { selectionChanged, lightImpact } from "@/lib/native/haptics";
import PullToRefresh from "@/components/PullToRefresh";

// Rows navigate to the SAME destinations/tabs the web Account uses. Tab ids
// here are a subset of VALID_TABS in Account.jsx — do not diverge from them.
function Row({ to, onClick, icon: Icon, tint, label, sublabel, value }) {
  const inner = (
    <>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center border ${tint}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="nt-body block truncate font-semibold text-foreground">{label}</span>
        {sublabel && <span className="nt-caption block truncate text-muted-foreground">{sublabel}</span>}
      </span>
      {Number.isFinite(value) && value > 0 && (
        <span className="nt-row-value shrink-0 tabular-nums">{value}</span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
    </>
  );
  const cls = "nt-row ios-pressable w-full text-left";
  const handle = () => selectionChanged();
  if (onClick) {
    return (
      <button type="button" onClick={() => { handle(); onClick(); }} className={cls}>
        {inner}
      </button>
    );
  }
  return (
    <Link to={to} onClick={handle} className={cls}>
      {inner}
    </Link>
  );
}

function StatTile({ icon: Icon, value, label, tint, iconClass }) {
  return (
    <div className={`border p-4 text-center ${tint}`}>
      <Icon className={`mx-auto h-5 w-5 ${iconClass}`} />
      <div className="mt-1.5 font-display text-2xl font-black tabular-nums text-foreground">{value}</div>
      <div className="nt-caption uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

export default function NativeAccount() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  // SAME query keys as web Account.jsx — the cache is shared, no duplicate layer.
  const { data: orders = [] } = useQuery({
    queryKey: ["myOrdersCount", user?.email],
    queryFn: () => base44.entities.StoreOrder.filter({ user_email: user.email }, "-created_date", 100),
    enabled: Boolean(user?.email),
  });
  const { data: posts = [] } = useQuery({
    queryKey: ["myPostsCount", user?.email],
    queryFn: () => base44.entities.ForumPost.filter({ user_email: user.email }, "-created_date", 100),
    enabled: Boolean(user?.email),
  });
  const { data: registrations = [] } = useQuery({
    queryKey: ["myInterestCount", user?.email],
    queryFn: () => base44.entities.InterestRegistration.filter({ user_email: user.email }, "-created_date", 100),
    enabled: Boolean(user?.email),
  });

  const displayName = user?.full_name || user?.email?.split("@")[0] || "User";
  const avatarLetter = displayName.slice(0, 1).toUpperCase();
  const rankName = user?.casino_rank || "Rookie Punter";
  const chips = Number(user?.casino_chips || 0);
  const xp = Number(user?.casino_xp || 0);
  const streak = Number(user?.casino_streak || 0);

  const memberSince = useMemo(
    () => (user?.created_date ? format(new Date(user.created_date), "MMM yyyy") : "June 2026"),
    [user?.created_date]
  );

  const go = (tab) => navigate(`/account?tab=${tab}`, { replace: true });

  return (
    <PullToRefresh queryKeys={[["myOrdersCount", user?.email], ["myPostsCount", user?.email], ["myInterestCount", user?.email]]}>
      <main className="min-h-dvh bg-background text-foreground nt-legible-floor pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto w-full max-w-xl nt-gutter-x nt-stack">

          {/* ① Gamification hero — the fan card */}
          <div className="nt-raised nt-e2 relative overflow-hidden border border-border/50 p-5">
            <div className="cmd-accent-bar absolute inset-x-0 top-0 h-[2px]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.14),transparent_60%)]" />
            <div className="relative">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={displayName}
                      loading="lazy"
                      decoding="async"
                      className="h-16 w-16 border border-white/20 object-cover shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center bg-gradient-to-tr from-primary via-accent to-primary font-display text-3xl font-bold text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]">
                      {avatarLetter}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="nt-title truncate text-foreground">{displayName}</h1>
                  {user?.email && <p className="nt-caption truncate font-mono text-muted-foreground">{user.email}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 border border-accent/30 bg-accent/10 px-2 py-0.5 text-accent">
                      <Trophy className="h-3 w-3" />
                      <span className="nt-caption font-bold uppercase tracking-wider">{rankName}</span>
                    </span>
                    {isAdmin && (
                      <span className="inline-flex items-center gap-1 border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-emerald-300">
                        <ShieldCheck className="h-3 w-3" />
                        <span className="nt-caption font-bold uppercase tracking-wider">Admin</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stat tiles — mirror NativeHome's fan-card, bigger */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <StatTile icon={Coins} value={chips.toLocaleString()} label="Chips" tint="border-accent/20 bg-accent/[0.06]" iconClass="text-accent" />
                <StatTile icon={Zap} value={xp.toLocaleString()} label="XP" tint="border-primary/20 bg-primary/[0.06]" iconClass="text-primary" />
                <StatTile icon={Flame} value={streak} label="Streak" tint="border-orange-500/20 bg-orange-500/[0.06]" iconClass="text-orange-400" />
              </div>

              <p className="nt-caption mt-3 flex items-center gap-1 uppercase tracking-widest text-muted-foreground">
                <Calendar className="h-3 w-3 text-primary" /> Member since <span className="text-foreground">{memberSince}</span>
              </p>
            </div>
          </div>

          {/* ② Game — gamification tabs */}
          <div>
            <p className="nt-group-header">Game</p>
            <div className="nt-group">
              <Row onClick={() => go("fanhub")} icon={Sparkles} tint="border-primary/25 bg-primary/10 text-primary" label="Fan Hub" sublabel="Daily spin, chips & XP" />
              <Row onClick={() => go("achievements")} icon={Trophy} tint="border-accent/25 bg-accent/10 text-accent" label="Achievements" />
              <Row onClick={() => go("leaderboard")} icon={Trophy} tint="border-amber-400/25 bg-amber-400/10 text-amber-400" label="Leaderboard" />
            </div>
          </div>

          {/* ③ Activity — orders, posts, interest */}
          <div>
            <p className="nt-group-header">Activity</p>
            <div className="nt-group">
              <Row onClick={() => go("orders")} icon={ShoppingBag} tint="border-primary/25 bg-primary/10 text-primary" label="My Orders" value={orders.length} />
              <Row onClick={() => go("posts")} icon={MessageSquare} tint="border-primary/25 bg-primary/10 text-primary" label="My Posts" value={posts.length} />
              <Row onClick={() => go("interest")} icon={Heart} tint="border-red-500/25 bg-red-500/10 text-red-500" label="My Interest" value={registrations.length} />
            </div>
          </div>

          {/* ④ Account — profile & security */}
          <div>
            <p className="nt-group-header">Account</p>
            <div className="nt-group">
              <Row onClick={() => go("profile")} icon={User} tint="border-border bg-background/50 text-foreground" label="Profile" sublabel={displayName} />
              <Row onClick={() => go("security")} icon={Shield} tint="border-border bg-background/50 text-foreground" label="Security" />
            </div>
          </div>

          {/* ⑤ Explore — shortcuts to other native tabs */}
          <div>
            <p className="nt-group-header">Explore</p>
            <div className="nt-group">
              <Row to="/store" icon={Store} tint="border-border bg-background/50 text-primary" label="Merch Store" />
              <Row to="/forum" icon={MessageSquare} tint="border-border bg-background/50 text-primary" label="Forum" />
              {isAdmin && (
                <Row to="/admin" icon={ShieldCheck} tint="border-emerald-400/25 bg-emerald-400/10 text-emerald-300" label="Admin Center" />
              )}
            </div>
          </div>

          {/* ⑥ Sign out */}
          <div>
            <div className="nt-group">
              <button
                type="button"
                onClick={() => { lightImpact(); logout(); }}
                className="nt-row ios-pressable w-full justify-center text-left"
              >
                <LogOut className="h-4 w-4 text-red-500" />
                <span className="nt-body font-semibold text-red-500">Sign out</span>
              </button>
            </div>
          </div>

        </div>
      </main>
    </PullToRefresh>
  );
}
