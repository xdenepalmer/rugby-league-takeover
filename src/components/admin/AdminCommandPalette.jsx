/* ━━━ AdminCommandPalette ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Cmd+K / Ctrl+K command palette for admin quick navigation.
 * Fuzzy-match against admin routes and quick actions.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, ShoppingBag, FileText, Users, CalendarDays,
  MessagesSquare, Settings, Megaphone, PackagePlus, CalendarPlus,
  Newspaper, Download, ClipboardList, UserCheck, MessageSquare,
  Search, Command, CornerDownLeft, ArrowUp, ArrowDown, Ban, RefreshCw,
} from "lucide-react";
import { queryClientInstance } from "@/lib/query-client";

/* ── Command definitions ─────────────────────────────────── */
const commands = [
  // Navigation
  { id: "nav-overview",    type: "navigate", label: "Overview",        description: "Dashboard & mission control",            icon: LayoutDashboard, path: "/admin/overview",   shortcut: "⌘1" },
  { id: "nav-store",       type: "navigate", label: "Store",           description: "Products, orders & fulfilment",           icon: ShoppingBag,     path: "/admin/store",      shortcut: "⌘4" },
  { id: "nav-content",     type: "navigate", label: "Content",         description: "News, packages & editorial",              icon: FileText,        path: "/admin/content",    shortcut: "⌘2" },
  { id: "nav-people",      type: "navigate", label: "People",          description: "Users, registrations & access",           icon: Users,           path: "/admin/people",     shortcut: "⌘6" },
  { id: "nav-events",      type: "navigate", label: "Events",          description: "Matchups, teams & fan events",            icon: CalendarDays,    path: "/admin/events",     shortcut: "⌘3" },
  { id: "nav-ads",         type: "navigate", label: "Ads",             description: "Campaigns, sponsors & placements",        icon: Megaphone,       path: "/admin/ads",        shortcut: "⌘8" },
  { id: "nav-community",   type: "navigate", label: "Community",       description: "Forum posts & moderation queue",          icon: MessagesSquare,  path: "/admin/community",  shortcut: "⌘5" },
  { id: "nav-settings",    type: "navigate", label: "Settings",        description: "Site config & brand assets",              icon: Settings,        path: "/admin/settings",   shortcut: "⌘7" },
  // Quick actions
  { id: "act-new-product", type: "action",   label: "New Product",     description: "Add a merch product to the store",        icon: PackagePlus,     path: "/admin/store" },
  { id: "act-new-event",   type: "action",   label: "New Event",       description: "Create a fan event or matchday",          icon: CalendarPlus,    path: "/admin/events" },
  { id: "act-new-article", type: "action",   label: "New Article",     description: "Publish a news story",                    icon: Newspaper,       path: "/admin/content" },
  { id: "act-export",      type: "action",   label: "Export Data",     description: "Download registrations & orders",         icon: Download,        action: "export" },
  { id: "act-refresh",     type: "action",   label: "Refresh Data",    description: "Reload all admin data from the server",   icon: RefreshCw,       action: "refresh" },
  { id: "act-orders",      type: "action",   label: "View Orders",     description: "Jump to order fulfilment",               icon: ClipboardList,   path: "/admin/store" },
  { id: "act-regs",        type: "action",   label: "View Registrations", description: "See interest sign-ups",               icon: UserCheck,       path: "/admin/people" },
  { id: "act-forum",       type: "action",   label: "View Forum Posts",description: "Browse and moderate posts",               icon: MessageSquare,   path: "/admin/community" },
  { id: "act-users",       type: "action",   label: "View Users",      description: "Manage user accounts & roles",            icon: Users,           path: "/admin/people" },
  { id: "act-bans",        type: "action",   label: "View Bans",       description: "IP, email & account blocks",              icon: Ban,             path: "/admin/people" },
];

/* ── Simple fuzzy match ──────────────────────────────────── */
function fuzzyMatch(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

/* ── Backdrop + Modal animations ─────────────────────────── */
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", damping: 28, stiffness: 380 } },
  exit: { opacity: 0, scale: 0.96, y: -10, transition: { duration: 0.15 } },
};

export default function AdminCommandPalette({ isOpen, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  /* ── Filter results ────────────────────────────────────── */
  const results = useMemo(() => {
    if (!query.trim()) return commands;
    return commands.filter(
      (cmd) => fuzzyMatch(query, cmd.label) || fuzzyMatch(query, cmd.description)
    );
  }, [query]);

  /* Reset on open/close */
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      // Autofocus after animation
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  /* Clamp active index */
  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(results.length - 1, 0)));
  }, [results.length]);

  /* Scroll active item into view */
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;
    const activeEl = listEl.children[activeIndex];
    if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  /* ── Execute command ───────────────────────────────────── */
  const executeCommand = useCallback(
    (cmd) => {
      if (cmd.action === "export") {
        window.dispatchEvent(new CustomEvent("admin:export-data"));
      } else if (cmd.action === "refresh") {
        queryClientInstance.invalidateQueries();
      } else if (cmd.path) {
        navigate(cmd.path);
      }
      onClose();
    },
    [navigate, onClose]
  );

  /* ── Keyboard handler ──────────────────────────────────── */
  const handleKeyDown = useCallback(
    (e) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[activeIndex]) executeCommand(results[activeIndex]);
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    },
    [results, activeIndex, executeCommand, onClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="cmd-palette-backdrop"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-[300] flex items-start justify-center pt-[12vh] sm:pt-[16vh]"
          onClick={onClose}
        >
          {/* Glassmorphism backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-lg mx-4 overflow-hidden border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40"
            style={{
              backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%)",
            }}
          >
            {/* Top gradient accent */}
            <div className="h-[2px] w-full bg-gradient-to-r from-primary via-accent to-primary opacity-60" />

            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search commands…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                aria-label="Search admin commands"
              />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-sm border border-border/40 bg-muted/20 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ESC
              </kbd>
            </div>

            {/* Results list */}
            <div
              ref={listRef}
              className="max-h-[50vh] overflow-y-auto cmd-scrollbar py-2"
              role="listbox"
              aria-label="Command results"
            >
              {results.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground/50">No matching commands</p>
                </div>
              )}

              {results.map((cmd, i) => {
                const Icon = cmd.icon;
                const isActive = i === activeIndex;
                return (
                  <button
                    key={cmd.id}
                    role="option"
                    aria-selected={isActive}
                    type="button"
                    onClick={() => executeCommand(cmd)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isActive
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center border transition-colors ${
                        isActive
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border/40 bg-muted/10 text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{cmd.label}</p>
                      <p className="text-[10px] text-muted-foreground/60 truncate">{cmd.description}</p>
                    </div>

                    {/* Type badge */}
                    <span
                      className={`shrink-0 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider border ${
                        cmd.type === "navigate"
                          ? "text-primary/60 border-primary/15 bg-primary/5"
                          : "text-accent/60 border-accent/15 bg-accent/5"
                      }`}
                    >
                      {cmd.type === "navigate" ? "Go" : "Action"}
                    </span>

                    {/* Shortcut badge */}
                    {cmd.shortcut && (
                      <kbd className="hidden sm:inline-flex shrink-0 items-center gap-0.5 rounded-sm border border-border/30 bg-muted/15 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/60">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer hints */}
            <div className="flex items-center justify-between border-t border-border/30 px-4 py-2">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 text-[9px] font-mono text-muted-foreground/40">
                  <ArrowUp className="h-2.5 w-2.5" />
                  <ArrowDown className="h-2.5 w-2.5" />
                  navigate
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-mono text-muted-foreground/40">
                  <CornerDownLeft className="h-2.5 w-2.5" />
                  select
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[9px] font-mono text-muted-foreground/40">
                <Command className="h-2.5 w-2.5" />K to toggle
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}