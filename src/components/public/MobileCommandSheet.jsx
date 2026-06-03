import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plane, Calendar, Users, Trophy, ExternalLink, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function MobileCommandSheet({ isOpen, onClose, onNavigate }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 lg:hidden pointer-events-none">
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
              <p className="text-[9px] font-mono font-bold tracking-widest text-primary uppercase">VEGAS INVASION // CONSOLE</p>
              <h2 className="font-display text-xl uppercase tracking-wide text-foreground mt-0.5">Plan Your Takeover</h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center border border-border text-slate-300 hover:border-primary hover:text-foreground transition-colors cursor-pointer"
              aria-label="Close sheet"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 cmd-scrollbar">
            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  onNavigate("#travel");
                  onClose();
                }}
                className="flex flex-col items-start p-4 border border-border/60 bg-muted/10 text-left hover:border-primary/40 hover:bg-muted/20 transition-all group cursor-pointer"
              >
                <div className="p-2 border border-border bg-background/50 text-primary group-hover:border-primary/30">
                  <Plane className="h-5 w-5" />
                </div>
                <span className="mt-3 text-xs font-bold uppercase tracking-wider text-foreground">Travel Packages</span>
                <span className="text-[9.5px] text-muted-foreground mt-1">Register for flight & hotel details</span>
              </button>

              <button
                onClick={() => {
                  onNavigate("#events");
                  onClose();
                }}
                className="flex flex-col items-start p-4 border border-border/60 bg-muted/10 text-left hover:border-primary/40 hover:bg-muted/20 transition-all group cursor-pointer"
              >
                <div className="p-2 border border-border bg-background/50 text-accent group-hover:border-primary/30">
                  <Calendar className="h-5 w-5" />
                </div>
                <span className="mt-3 text-xs font-bold uppercase tracking-wider text-foreground">Match Day Events</span>
                <span className="text-[9.5px] text-muted-foreground mt-1">Pool parties & meetups schedule</span>
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
                onClick={() => {
                  onNavigate("#matchups");
                  onClose();
                }}
                className="mt-3.5 w-full flex items-center justify-center gap-2 py-2 border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 text-[10px] font-bold uppercase tracking-widest text-foreground transition-all cursor-pointer"
              >
                <span>View Full Fixture</span>
                <ArrowRight className="h-3 w-3 text-primary" />
              </button>
            </div>

            {/* Facebook Fan Group Integration */}
            <a
              href="https://www.facebook.com/groups/663237792349090"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 border border-[#1877F2]/20 bg-[#1877F2]/[0.03] p-4 hover:bg-[#1877F2]/[0.08] transition-all group"
            >
              <div className="p-3 border border-[#1877F2]/30 bg-background/50 text-[#1877F2] shrink-0">
                <Users className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-1 text-[8.5px] font-mono font-bold tracking-widest text-[#1877F2] uppercase border border-[#1877F2]/30 bg-[#1877F2]/5 px-2 py-0.5 mb-1.5">Facebook Group</span>
                <h4 className="text-xs font-bold text-foreground truncate">NRL Las Vegas Fan Group</h4>
                <p className="text-[9.5px] text-muted-foreground mt-0.5">16.8k members · Match coordinates, tickets exchange</p>
              </div>
              <ExternalLink className="h-4 w-4 text-slate-500 group-hover:text-[#1877F2] group-hover:translate-x-0.5 transition-all shrink-0" />
            </a>

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
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
