import React, { useMemo, useState, useCallback } from "react";
import AdminConfirmSheet from "./shared/AdminConfirmSheet";
import { format, isToday } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Search, ClipboardList, Users, CalendarCheck,
  Hash, Check, X, Phone, MapPin, Mail, Shield,
  ClipboardCopy, Send, ChevronLeft, ChevronRight, FileText
} from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { SUPPORTED_TEAMS } from "@/lib/public-forms";

/* ── Team colour map ─────────────────────────────────────────── */
const TEAM_COLORS = {
  Eels:     { bg: "bg-blue-500/15",  text: "text-blue-400",    border: "border-blue-500/30",  ring: "bg-blue-500"    },
  Tigers:   { bg: "bg-amber-500/15", text: "text-amber-400",   border: "border-amber-500/30", ring: "bg-amber-500"   },
  Titans:   { bg: "bg-cyan-500/15",  text: "text-cyan-400",    border: "border-cyan-500/30",  ring: "bg-cyan-500"    },
  Storm:    { bg: "bg-purple-500/15",text: "text-purple-400",  border: "border-purple-500/30",ring: "bg-purple-500"  },
  Leopards: { bg: "bg-yellow-500/15",text: "text-yellow-400",  border: "border-yellow-500/30",ring: "bg-yellow-500"  },
  Bulls:    { bg: "bg-red-500/15",   text: "text-red-400",     border: "border-red-500/30",   ring: "bg-red-500"     },
  Other:    { bg: "bg-zinc-500/15",  text: "text-zinc-400",    border: "border-zinc-500/30",  ring: "bg-zinc-500"    },
};

const teamColor = (team) => TEAM_COLORS[team] || TEAM_COLORS.Other;

/* ── Stagger animation variants ──────────────────────────────── */
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show:   { opacity: 1, y: 0,  scale: 1, transition: { type: "spring", stiffness: 400, damping: 28 } },
};

/* ── Component ───────────────────────────────────────────────── */
export default function RegistrationsTable({ registrations }) {
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [copied, setCopied] = useState(false);
  const [emailConfirmOpen, setEmailConfirmOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 25;

  /* Filter logic (unchanged) */
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return registrations.filter((item) => {
      if (teamFilter !== "all" && item.team_supported !== teamFilter) return false;
      return `${item.name || ""} ${item.email || ""} ${item.phone || ""} ${item.postcode || ""} ${item.team_supported || ""} ${item.trip_details || ""}`.toLowerCase().includes(term);
    });
  }, [registrations, search, teamFilter]);

  /* Reset page when filters change */
  React.useEffect(() => {
    setPage(1);
  }, [search, teamFilter]);

  /* Paginate */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pagedItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  /* CSV export (unchanged) */
  const exportCsv = () => {
    const headers = ["Name", "Email", "Phone", "Postcode", "Team", "Travel Plans", "Consented", "Date"];
    const rows = filtered.map((item) => [
      item.name, item.email, item.phone, item.postcode, item.team_supported,
      item.trip_details || "",
      item.consent_to_contact ? "yes" : "no",
      item.created_date ? format(new Date(item.created_date), "yyyy-MM-dd") : "",
    ]);
    downloadCsv("rugby-league-takeover-registrations.csv", headers, rows);
  };

  /* Stats */
  const uniqueTeams = useMemo(
    () => new Set(registrations.map((r) => r.team_supported)).size,
    [registrations]
  );
  const todayCount = useMemo(
    () => registrations.filter((r) => r.created_date && isToday(new Date(r.created_date))).length,
    [registrations]
  );
  const consentedCount = useMemo(
    () => registrations.filter((r) => r.consent_to_contact === true).length,
    [registrations]
  );

  /* Derive the email target list: selected (if any) → filtered+consented */
  const emailTargets = useMemo(() => {
    if (selectedIds.size > 0) {
      return filtered.filter(
        (r) => selectedIds.has(r.id) && r.consent_to_contact === true && r.email
      );
    }
    return filtered.filter((r) => r.consent_to_contact === true && r.email);
  }, [filtered, selectedIds]);

  /* Selection helpers */
  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (filtered.every((r) => prev.has(r.id))) {
        const next = new Set(prev);
        filtered.forEach((r) => next.delete(r.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((r) => next.add(r.id));
      return next;
    });
  }, [filtered]);

  /* Email All handler */
  const handleEmailAll = useCallback(() => {
    const emails = emailTargets.map((r) => r.email);
    if (emails.length === 0) return;
    if (emails.length > 50) {
      setEmailConfirmOpen(true);
      return;
    }
    openMailto();
  }, [emailTargets]);

  const openMailto = useCallback(() => {
    const emails = emailTargets.map((r) => r.email);
    setEmailConfirmOpen(false);
    const subject = encodeURIComponent("Rugby League Takeover Las Vegas — Update");
    const bcc = emails.map(encodeURIComponent).join(",");
    window.location.href = `mailto:?bcc=${bcc}&subject=${subject}`;
  }, [emailTargets]);

  /* Copy Emails handler */
  const handleCopyEmails = useCallback(async () => {
    const emails = emailTargets.map((r) => r.email);
    if (emails.length === 0) return;
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback */
      const ta = document.createElement("textarea");
      ta.value = emails.join(", ");
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [emailTargets]);

  return (
    <>
    <section id="registrations-admin" className="scroll-mt-28">
      {/* ── Glassmorphic wrapper ── */}
      <div className="cmd-glass border border-border overflow-hidden">
        {/* Gradient accent bar */}
        <div className="cmd-accent-bar h-[3px] w-full" />

        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-4 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <div className="relative mt-0.5">
                <ClipboardList className="h-6 w-6 text-primary" />
                <div className="absolute inset-0 h-6 w-6 rounded-full bg-primary/20 cmd-pulse" />
              </div>
              <div>
                <h2 className="font-display text-2xl uppercase tracking-wide md:text-3xl">
                  Interest Registrations
                </h2>
                <p className="mt-0.5 text-[11px] font-mono text-muted-foreground">
                  {filtered.length} of {registrations.length} shown · marketing list for the ticket drop
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Email All */}
              <button
                onClick={handleEmailAll}
                disabled={emailTargets.length === 0}
                className="group flex min-h-11 items-center justify-center gap-2 border border-border px-4 py-2 text-[10px] font-bold uppercase tracking-wider
                           transition-all hover:border-amber-400/50 hover:bg-amber-400/5 disabled:opacity-30 disabled:pointer-events-none"
              >
                <Send className="h-3.5 w-3.5 text-amber-400 transition-transform group-hover:-translate-y-0.5" />
                Email All
                <span className="inline-flex items-center justify-center rounded-sm bg-amber-400/15 px-1.5 text-[8px] tabular-nums text-amber-400">
                  {emailTargets.length}
                </span>
              </button>

              {/* Copy Emails */}
              <button
                onClick={handleCopyEmails}
                disabled={emailTargets.length === 0}
                className="group relative flex min-h-11 items-center justify-center gap-2 border border-border px-4 py-2 text-[10px] font-bold uppercase tracking-wider
                           transition-all hover:border-emerald-400/50 hover:bg-emerald-400/5 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ClipboardCopy className="h-3.5 w-3.5 text-emerald-400 transition-transform group-hover:-translate-y-0.5" />
                {copied ? "Copied!" : "Copy Emails"}
                <AnimatePresence>
                  {copied && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-emerald-500 px-2 py-0.5 text-[8px] font-bold text-white"
                    >
                      Copied to clipboard!
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              {/* Export CSV */}
              <button
                onClick={exportCsv}
                disabled={!filtered.length}
                className="group flex min-h-11 items-center justify-center gap-2 border border-border px-4 py-2 text-[10px] font-bold uppercase tracking-wider
                           transition-all hover:border-primary/50 hover:bg-primary/5 disabled:opacity-30 disabled:pointer-events-none"
              >
                <Download className="h-3.5 w-3.5 text-primary transition-transform group-hover:-translate-y-0.5" />
                Export CSV
              </button>
            </div>
          </div>

          {/* ── Stats bar ── */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {[
              { label: "Total Registrations", value: registrations.length, icon: Users,         color: "text-primary" },
              { label: "Unique Teams",        value: uniqueTeams,          icon: Shield,        color: "text-accent"  },
              { label: "Today's Sign-ups",    value: todayCount,           icon: CalendarCheck, color: "text-emerald-400" },
              { label: "Consented Contacts",  value: consentedCount,       icon: Mail,          color: "text-amber-400" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="flex items-center gap-3 border border-border/50 bg-card/40 px-3 py-2.5"
              >
                <Icon className={`h-4 w-4 ${color} shrink-0`} />
                <div>
                  <p className={`font-mono text-lg font-bold tabular-nums ${color} cmd-count-up`}>{value}</p>
                  <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="border-t border-border/40 px-5 py-4 md:px-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search name, email, phone, postcode or travel plans…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-border bg-card/50 py-2.5 pl-10 pr-4 text-sm font-mono
                         placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30
                         transition-colors cmd-glass"
            />
          </div>

          {/* Select all toggle */}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className={`flex items-center gap-2 border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all
                ${allFilteredSelected
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/30"
                }`}
            >
              <div className={`flex h-3.5 w-3.5 items-center justify-center border transition-colors
                ${allFilteredSelected ? "border-primary bg-primary/20" : "border-muted-foreground/40"}`}
              >
                {allFilteredSelected && <Check className="h-2.5 w-2.5 text-primary" />}
              </div>
              {allFilteredSelected ? "Deselect All" : "Select All"}
            </button>
            {selectedIds.size > 0 && (
              <span className="text-[9px] font-mono text-muted-foreground">
                {selectedIds.size} selected
              </span>
            )}
          </div>

          {/* Team pill filters */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["all", ...SUPPORTED_TEAMS].map((team) => {
              const active = teamFilter === team;
              const tc = team !== "all" ? teamColor(team) : null;
              return (
                <button
                  key={team}
                  onClick={() => setTeamFilter(team)}
                  className={`min-h-11 px-3 py-2 text-[10px] font-bold uppercase tracking-wider border transition-all duration-150
                    ${active
                      ? team === "all"
                        ? "border-primary bg-primary/15 text-primary"
                        : `${tc.border} ${tc.bg} ${tc.text}`
                      : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/30"
                    }`}
                >
                  {team === "all" ? "All Teams" : team}
                  {active && team === "all" && (
                    <span className="ml-1.5 inline-flex items-center justify-center rounded-sm bg-primary/20 px-1 text-[8px] tabular-nums">
                      {registrations.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Registration Cards Grid ── */}
        <div className="border-t border-border/40 px-5 py-5 md:px-6">
          <AnimatePresence mode="wait">
            {filtered.length > 0 ? (
              <motion.div
                key={`${teamFilter}-${search}`}
                variants={container}
                initial="hidden"
                animate="show"
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                {pagedItems.map((item, index) => {
                  const tc = teamColor(item.team_supported);
                  const initial = (item.name || "?")[0].toUpperCase();
                  return (
                    <motion.div
                      key={item.id}
                      variants={cardVariant}
                      layout
                      transition={{ ...cardVariant.show.transition, delay: Math.min(index * 0.04, 0.3) }}
                      className={`group relative border bg-card/50 transition-all hover:border-primary/30 hover:bg-card/80 ${
                        selectedIds.has(item.id)
                          ? "border-primary/60 ring-1 ring-primary/20"
                          : "border-border/60"
                      }`}
                    >
                      {/* Card top accent */}
                      <div className={`h-[2px] w-full ${tc.ring} opacity-40`} />

                      {/* Selection checkbox */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                        className="absolute right-2.5 top-4 z-10"
                        aria-label={selectedIds.has(item.id) ? "Deselect" : "Select"}
                      >
                        <div className={`flex h-4 w-4 items-center justify-center border transition-colors
                          ${selectedIds.has(item.id)
                            ? "border-primary bg-primary/20"
                            : "border-muted-foreground/30 hover:border-muted-foreground/60"}`}
                        >
                          {selectedIds.has(item.id) && <Check className="h-2.5 w-2.5 text-primary" />}
                        </div>
                      </button>

                      <div className="p-4">
                        {/* Avatar + Name row */}
                        <div className="flex items-start gap-3">
                          {/* Avatar circle */}
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center border ${tc.border} ${tc.bg}`}>
                            <span className={`font-display text-base font-bold ${tc.text}`}>{initial}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-bold text-foreground">{item.name}</h3>
                            <div className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="break-all text-[11px] font-mono">{item.email}</span>
                            </div>
                          </div>
                        </div>

                        {/* Team badge */}
                        <div className="mt-3 flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${tc.border} ${tc.bg} ${tc.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${tc.ring}`} />
                            {item.team_supported}
                          </span>
                          {/* Consent indicator */}
                          {item.consent_to_contact ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-400">
                              <Check className="h-3 w-3" /> Consented
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono text-red-400">
                              <X className="h-3 w-3" /> No consent
                            </span>
                          )}
                        </div>

                        {/* Details row */}
                        <div className="mt-3 flex items-center gap-4 border-t border-border/30 pt-3">
                          {item.postcode && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="text-[10px] font-mono">{item.postcode}</span>
                            </div>
                          )}
                          {item.phone && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="text-[10px] font-mono">{item.phone}</span>
                            </div>
                          )}
                          <div className="ml-auto text-[9px] font-mono text-muted-foreground/60">
                            {item.created_date
                              ? format(new Date(item.created_date), "dd MMM yyyy")
                              : "—"}
                          </div>
                        </div>

                        {item.trip_details && (
                          <div className="mt-3 border border-border/40 bg-background/35 p-3">
                            <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                              <FileText className="h-3 w-3" /> Travel plans
                            </div>
                            <p className="whitespace-pre-wrap break-words text-[11px] leading-5 text-muted-foreground">
                              {item.trip_details}
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              /* ── Empty state ── */
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div className="relative mb-4">
                  <ClipboardList className="h-12 w-12 text-muted-foreground/30" />
                  <div className="absolute inset-0 h-12 w-12 rounded-full bg-muted/10 cmd-pulse" />
                </div>
                <p className="font-display text-lg uppercase tracking-wide text-muted-foreground">
                  No registrations found
                </p>
                <p className="mt-1 text-[11px] font-mono text-muted-foreground/60">
                  {search || teamFilter !== "all"
                    ? "Try adjusting your search or clearing the team filter."
                    : "Registrations will appear here once fans sign up."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer count ── */}
        {filtered.length > 0 && (
          <div className="border-t border-border/30 px-5 py-2.5 md:px-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5">
              <Hash className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[9px] font-mono text-muted-foreground/60">
                Showing {Math.min((page - 1) * PER_PAGE + 1, filtered.length)}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} record{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex min-h-8 items-center gap-1 border border-border/50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft className="h-3 w-3" /> Prev
                </button>

                {totalPages <= 7 ? (
                  Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`flex min-h-8 min-w-8 items-center justify-center border text-[9px] font-bold font-mono transition-colors ${
                        p === page
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))
                ) : (
                  /* Show first, surrounding, and last pages with ellipsis */
                  (() => {
                    const pages = [];
                    const addPage = (p) => { if (!pages.includes(p)) pages.push(p); };
                    addPage(1);
                    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) addPage(i);
                    addPage(totalPages);
                    return pages.reduce((acc, p, idx) => {
                      if (idx > 0 && p - pages[idx - 1] > 1) {
                        acc.push(<span key={`e${p}`} className="px-1 text-[9px] text-muted-foreground/40">…</span>);
                      }
                      acc.push(
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`flex min-h-8 min-w-8 items-center justify-center border text-[9px] font-bold font-mono transition-colors ${
                            p === page
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                          }`}
                        >
                          {p}
                        </button>
                      );
                      return acc;
                    }, []);
                  })()
                )}

                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="flex min-h-8 items-center gap-1 border border-border/50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                >
                  Next <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}

            <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/40">
              rlt–registrations
            </span>
          </div>
        )}
      </div>
    </section>

    <AdminConfirmSheet
      open={emailConfirmOpen}
      title={`Email ${emailTargets.length} addresses?`}
      description={`Some email clients limit mailto: links to ~50 addresses or ~2,000 characters. You're about to BCC ${emailTargets.length} addresses.`}
      confirmLabel="Continue"
      onConfirm={openMailto}
      onCancel={() => setEmailConfirmOpen(false)}
    />
    </>
  );
}