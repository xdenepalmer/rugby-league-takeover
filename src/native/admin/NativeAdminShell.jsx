import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Undo2 } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { appParams } from "@/lib/app-params";
import AdminOfflineBanner from "@/components/admin/AdminOfflineBanner";
import { emitHaptic } from "@/lib/native/haptic-events";
import NativeAdminTabBar from "./NativeAdminTabBar.jsx";
import NativeScrollMemory from "../navigation/NativeScrollMemory.jsx";

/**
 * Native admin operations shell. Deliberately drops the desktop command
 * centre chrome (collapsible sidebar, command palette, live clock,
 * keyboard-shortcut hints, path-trail bars) for a five-tab phone operations
 * app. Every web admin capability stays reachable through the hubs and
 * modules; server authority and RLS are untouched.
 */
export default function NativeAdminShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Attention badges: pending moderation + orders needing fulfilment.
  // head:true count queries — no row payloads leave the database, so the
  // badge poll can never serialize post/order contents anywhere.
  const { data: attention = { community: 0, store: 0 } } = useQuery({
    queryKey: ["adminAttention"],
    queryFn: async () => {
      const [posts, orders] = await Promise.all([
        supabase.from("forum_posts_view").select("*", { count: "exact", head: true }).eq("is_published", false),
        supabase.from("store_orders").select("*", { count: "exact", head: true }).eq("status", "paid"),
      ]);
      if (posts.error) throw posts.error;
      if (orders.error) throw orders.error;
      return { community: posts.count || 0, store: orders.count || 0 };
    },
    enabled: appParams.hasBase44Config,
    refetchInterval: 60000,
    retry: false,
    meta: { silent: true },
  });

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-emerald-500/30 bg-background/95 backdrop-blur pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex h-11 max-w-2xl items-center gap-2 px-4">
          <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <p className="min-w-0 flex-1 truncate text-[10px] font-black uppercase tracking-[0.25em] text-emerald-300">
            Command Centre
          </p>
          <button
            type="button"
            onClick={() => {
              emitHaptic("nav.back");
              navigate("/");
            }}
            className="ios-pressable flex min-h-9 items-center gap-1.5 border border-border/70 px-2.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Fan app
          </button>
        </div>
      </header>

      <AdminOfflineBanner />

      <main id="admin-content" className="mx-auto w-full max-w-2xl pb-[max(84px,calc(84px+var(--safe-bottom)))]">
        <Outlet />
      </main>

      <NativeAdminTabBar attention={attention} currentPath={pathname} />
      <NativeScrollMemory />
    </div>
  );
}
