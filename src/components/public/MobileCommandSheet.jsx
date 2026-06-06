import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Plane, Calendar, Trophy, ArrowRight,
  PenSquare, Ruler,
  Bookmark, Award, Package, Settings, HelpCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import SocialLinks from "./SocialLinks";

/* ── Context-specific content sections ── */

function HomeContent({ onNavigate, onClose, settings = {} }) {
  return (
    <>
      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { onNavigate("#travel"); onClose(); }}
          className="flex flex-col items-start p-4 border border-border/60 bg-muted/10 text-left hover:border-primary/40 hover:bg-muted/20 transition-all group cursor-pointer"
        >
          <div className="p-2 border border-border bg-background/50 text-primary group-hover:border-primary/30">
            <Plane className="h-5 w-5" />
          </div>
          <span className="mt-3 text-xs font-bold uppercase tracking-wider text-foreground">Travel Packages</span>
          <span className="text-[9.5px] text-muted-foreground mt-1">Register for flight &amp; hotel details</span>
        </button>

        <button
          onClick={() => { onNavigate("#events"); onClose(); }}
          className="flex flex-col items-start p-4 border border-border/60 bg-muted/10 text-left hover:border-primary/40 hover:bg-muted/20 transition-all group cursor-pointer"
        >
          <div className="p-2 border border-border bg-background/50 text-accent group-hover:border-primary/30">
            <Calendar className="h-5 w-5" />
          </div>
          <span className="mt-3 text-xs font-bold uppercase tracking-wider text-foreground">Events</span>
          <span className="text-[9.5px] text-muted-foreground mt-1">Pool parties &amp; meetups schedule</span>
        </button>
      </div>

      {/* NRL Vegas Matchups HUD Card */}
      <div className="border border-border/60 bg-muted/10 p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-1 border-l border-b border-border bg-background/30 text-[8px] font-mono uppercase tracking-wider text-slate-500">Live HUD</div>
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Vegas Matchups</span>
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11px] border-b border-border/30 pb-1.5">
            <span className="font-bold text-foreground">Warriors vs Raiders</span>
            <span className="text-[10px] font-mono text-primary">AEST // 28 FEB</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-foreground">Panthers vs Sharks</span>
            <span className="text-[10px] font-mono text-primary">AEST // 28 FEB</span>
          </div>
        </div>
        <button
          onClick={() => { onNavigate("#matchups"); onClose(); }}
          className="mt-3.5 w-full flex items-center justify-center gap-2 py-2 border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 text-[10px] font-bold uppercase tracking-widest text-foreground transition-all cursor-pointer"
        >
          <span>View Full Fixture</span>
          <ArrowRight className="h-3 w-3 text-primary" />
        </button>
      </div>

      {/* Social Links */}
      <SocialLinks settings={settings} compact />

      {/* Quick Community / Shop shortcuts */}
      <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-5">
        <Link
          to="/store"
          onClick={onClose}
          className="flex items-center justify-between p-3 border border-border/40 hover:border-primary/30 hover:bg-muted/5 text-[10.5px] font-bold uppercase tracking-widest text-slate-300 hover:text-foreground transition-all shrink-0"
        >
          <span>Shop Merch</span>
          <ArrowRight className="h-3.5 w-3.5 text-primary" />
        </Link>
        <Link
          to="/forum"
          onClick={onClose}
          className="flex items-center justify-between p-3 border border-border/40 hover:border-primary/30 hover:bg-muted/5 text-[10.5px] font-bold uppercase tracking-widest text-slate-300 hover:text-foreground transition-all shrink-0"
        >
          <span>Join Forum</span>
          <ArrowRight className="h-3.5 w-3.5 text-primary" />
        </Link>
      </div>
    </>
  );
}

function StoreContent({ onClose, cartCount = 0 }) {
  const openCart = () => {
    try {
      window.dispatchEvent(new Event("rlt_open_cart"));
    } catch {}
    onClose();
  };

  return (
    <>
      <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Store Quick Actions</p>
      <div className="border border-primary/25 bg-primary/[0.045] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center border border-primary/30 bg-background/50 text-primary">
            <Package className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-primary">Current cart</p>
            <p className="mt-0.5 text-sm font-bold text-foreground">
              {cartCount > 0 ? `${cartCount} item${cartCount === 1 ? "" : "s"} ready` : "No items yet"}
            </p>
          </div>
          <button
            type="button"
            onClick={openCart}
            className="min-h-11 border border-primary/30 bg-primary/10 px-3 text-[10px] font-extrabold uppercase tracking-wider text-primary transition-colors hover:bg-primary/15"
          >
            Open
          </button>
        </div>
        <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
          Free shipping progress and delivery estimates are shown inside the cart before checkout.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/account"
          onClick={onClose}
          className="flex flex-col items-start p-4 border border-border/60 bg-muted/10 text-left hover:border-accent/40 hover:bg-muted/20 transition-all group"
        >
          <div className="p-2 border border-border bg-background/50 text-accent group-hover:border-accent/30">
            <Package className="h-5 w-5" />
          </div>
          <span className="mt-3 text-xs font-bold uppercase tracking-wider text-foreground">My Orders</span>
          <span className="text-[9.5px] text-muted-foreground mt-1">Track shipments &amp; history</span>
        </Link>

        <Link
          to="/store#sizing"
          onClick={onClose}
          className="flex flex-col items-start p-4 border border-border/60 bg-muted/10 text-left hover:border-primary/40 hover:bg-muted/20 transition-all group"
        >
          <div className="p-2 border border-border bg-background/50 text-primary group-hover:border-primary/30">
            <Ruler className="h-5 w-5" />
          </div>
          <span className="mt-3 text-xs font-bold uppercase tracking-wider text-foreground">Size Guide</span>
          <span className="text-[9.5px] text-muted-foreground mt-1">Apparel fit &amp; measurements</span>
        </Link>
      </div>

      <div className="space-y-2.5">
        <a
          href="mailto:support@rugbyleaguetakeover.com?subject=Store%20Support"
          className="flex items-center justify-between p-3 border border-border/40 hover:border-primary/30 hover:bg-muted/5 text-[10.5px] font-bold uppercase tracking-widest text-slate-300 hover:text-foreground transition-all"
        >
          <span className="flex items-center gap-2"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /> Support</span>
          <ArrowRight className="h-3.5 w-3.5 text-primary" />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-5">
        <Link
          to="/"
          onClick={onClose}
          className="flex items-center justify-between p-3 border border-border/40 hover:border-primary/30 hover:bg-muted/5 text-[10.5px] font-bold uppercase tracking-widest text-slate-300 hover:text-foreground transition-all shrink-0"
        >
          <span>Home</span>
          <ArrowRight className="h-3.5 w-3.5 text-primary" />
        </Link>
        <Link
          to="/forum"
          onClick={onClose}
          className="flex items-center justify-between p-3 border border-border/40 hover:border-primary/30 hover:bg-muted/5 text-[10.5px] font-bold uppercase tracking-widest text-slate-300 hover:text-foreground transition-all shrink-0"
        >
          <span>Forum</span>
          <ArrowRight className="h-3.5 w-3.5 text-primary" />
        </Link>
      </div>
    </>
  );
}

function ForumContent({ onClose }) {
  return (
    <>
      <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Forum Quick Actions</p>
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/forum"
          onClick={onClose}
          className="flex flex-col items-start p-4 border border-border/60 bg-muted/10 text-left hover:border-primary/40 hover:bg-muted/20 transition-all group"
        >
          <div className="p-2 border border-border bg-background/50 text-primary group-hover:border-primary/30">
            <PenSquare className="h-5 w-5" />
          </div>
          <span className="mt-3 text-xs font-bold uppercase tracking-wider text-foreground">New Post</span>
          <span className="text-[9.5px] text-muted-foreground mt-1">Start a new thread</span>
        </Link>

        <Link
          to="/account"
          onClick={onClose}
          className="flex flex-col items-start p-4 border border-border/60 bg-muted/10 text-left hover:border-accent/40 hover:bg-muted/20 transition-all group"
        >
          <div className="p-2 border border-border bg-background/50 text-accent group-hover:border-accent/30">
            <Bookmark className="h-5 w-5" />
          </div>
          <span className="mt-3 text-xs font-bold uppercase tracking-wider text-foreground">My Threads</span>
          <span className="text-[9.5px] text-muted-foreground mt-1">View your posts &amp; replies</span>
        </Link>
      </div>

      <div className="border border-border/60 bg-muted/10 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Award className="h-4 w-4 text-amber-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Fan Rewards</span>
        </div>
        <p className="text-[10px] text-muted-foreground">Post, react, and reply to earn XP and unlock badges. Top contributors get featured!</p>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-5">
        <Link
          to="/"
          onClick={onClose}
          className="flex items-center justify-between p-3 border border-border/40 hover:border-primary/30 hover:bg-muted/5 text-[10.5px] font-bold uppercase tracking-widest text-slate-300 hover:text-foreground transition-all shrink-0"
        >
          <span>Home</span>
          <ArrowRight className="h-3.5 w-3.5 text-primary" />
        </Link>
        <Link
          to="/store"
          onClick={onClose}
          className="flex items-center justify-between p-3 border border-border/40 hover:border-primary/30 hover:bg-muted/5 text-[10.5px] font-bold uppercase tracking-widest text-slate-300 hover:text-foreground transition-all shrink-0"
        >
          <span>Shop Merch</span>
          <ArrowRight className="h-3.5 w-3.5 text-primary" />
        </Link>
      </div>
    </>
  );
}

function AccountContent({ onClose }) {
  return (
    <>
      <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-2">My Takeover</p>
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/account"
          onClick={onClose}
          className="flex flex-col items-start p-4 border border-border/60 bg-muted/10 text-left hover:border-accent/40 hover:bg-muted/20 transition-all group"
        >
          <div className="p-2 border border-border bg-background/50 text-accent group-hover:border-accent/30">
            <Package className="h-5 w-5" />
          </div>
          <span className="mt-3 text-xs font-bold uppercase tracking-wider text-foreground">Track Orders</span>
          <span className="text-[9.5px] text-muted-foreground mt-1">View latest shipment status</span>
        </Link>

        <Link
          to="/account"
          onClick={onClose}
          className="flex flex-col items-start p-4 border border-border/60 bg-muted/10 text-left hover:border-primary/40 hover:bg-muted/20 transition-all group"
        >
          <div className="p-2 border border-border bg-background/50 text-primary group-hover:border-primary/30">
            <Settings className="h-5 w-5" />
          </div>
          <span className="mt-3 text-xs font-bold uppercase tracking-wider text-foreground">Preferences</span>
          <span className="text-[9.5px] text-muted-foreground mt-1">Profile &amp; notification settings</span>
        </Link>
      </div>

      <div className="space-y-2.5">
        <Link
          to="/"
          onClick={onClose}
          className="flex items-center gap-3 p-3 border border-primary/20 bg-primary/[0.03] hover:bg-primary/[0.08] text-[10.5px] font-bold uppercase tracking-widest text-slate-300 hover:text-foreground transition-all"
        >
          <Plane className="h-4 w-4 text-primary" />
          <span>Travel Registration Status</span>
          <ArrowRight className="ml-auto h-3.5 w-3.5 text-primary" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-5">
        <Link
          to="/store"
          onClick={onClose}
          className="flex items-center justify-between p-3 border border-border/40 hover:border-primary/30 hover:bg-muted/5 text-[10.5px] font-bold uppercase tracking-widest text-slate-300 hover:text-foreground transition-all shrink-0"
        >
          <span>Shop Merch</span>
          <ArrowRight className="h-3.5 w-3.5 text-primary" />
        </Link>
        <Link
          to="/forum"
          onClick={onClose}
          className="flex items-center justify-between p-3 border border-border/40 hover:border-primary/30 hover:bg-muted/5 text-[10.5px] font-bold uppercase tracking-widest text-slate-300 hover:text-foreground transition-all shrink-0"
        >
          <span>Forum</span>
          <ArrowRight className="h-3.5 w-3.5 text-primary" />
        </Link>
      </div>
    </>
  );
}

/* ── Context header labels ── */
const CONTEXT_HEADERS = {
  home: { label: "VEGAS INVASION // CONSOLE", title: "Plan Your Takeover" },
  store: { label: "STORE // CONSOLE", title: "Shop Quick Actions" },
  forum: { label: "FORUM // CONSOLE", title: "Community Hub" },
  account: { label: "ACCOUNT // CONSOLE", title: "My Takeover" },
};

export default function MobileCommandSheet({ isOpen, onClose, onNavigate, context = "home", cartCount = 0, settings = {} }) {
  const header = CONTEXT_HEADERS[context] || CONTEXT_HEADERS.home;

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="sheet" className="fixed inset-0 z-50 lg:hidden pointer-events-none">
          {/* Semi-transparent backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "linear" }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm pointer-events-auto"
          />

          {/* Sliding drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="absolute inset-x-0 bottom-0 max-h-[85vh] border-t border-border bg-card/95 pb-safe cmd-glass pointer-events-auto flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* Neon accent line */}
            <div className="h-[2px] w-full bg-gradient-to-r from-primary via-accent to-primary" />

            {/* Drag indicator handle */}
            <div className="flex justify-center py-2 shrink-0">
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4 border-b border-border/40 shrink-0">
              <div>
                <p className="text-[9px] font-mono font-bold tracking-widest text-primary uppercase">{header.label}</p>
                <h2 className="font-display text-xl uppercase tracking-wide text-foreground mt-0.5">{header.title}</h2>
              </div>
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center border border-border text-slate-300 hover:border-primary hover:text-foreground transition-colors cursor-pointer"
                aria-label="Close sheet"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Content — context-aware */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 cmd-scrollbar">
              {context === "store" && <StoreContent onClose={onClose} cartCount={cartCount} />}
              {context === "forum" && <ForumContent onClose={onClose} />}
              {context === "account" && <AccountContent onClose={onClose} />}
              {context === "home" && <HomeContent onNavigate={onNavigate} onClose={onClose} settings={settings} />}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}