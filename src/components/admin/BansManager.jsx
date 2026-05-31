import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ShieldX, Plus, Globe, Mail, UserX, ChevronDown,
  Clock, AlertTriangle, CheckCircle2, Calendar, Shield,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const isExpired = (ban) => ban.expires_at && new Date(ban.expires_at).getTime() <= Date.now();

/* ─── Type icon + colour mapping ──────────────────────────── */
const typeConfig = {
  ip:    { icon: Globe, label: "IP Address", color: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/20" },
  email: { icon: Mail,  label: "Email",      color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  user:  { icon: UserX, label: "User ID",    color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20" },
};

/* ─── Inline label wrapper ────────────────────────────────── */
function FieldLabel({ label, children, className = "" }) {
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

/* ─── Stat badge ──────────────────────────────────────────── */
function StatBadge({ icon: Icon, label, value, color = "text-destructive", bg = "bg-destructive/5", border = "border-destructive/10", pulse }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${bg} border ${border} text-[10px] font-bold uppercase tracking-wider ${color}`}>
      {pulse ? <span className={`h-1.5 w-1.5 rounded-full ${color === "text-destructive" ? "bg-destructive" : "bg-current"} cmd-blink`} /> : <Icon className="h-3 w-3" />}
      {value} {label}
    </span>
  );
}

/* ─── Single ban card ─────────────────────────────────────── */
function BanCard({ ban, index, liftBan }) {
  const expired = isExpired(ban);
  const lifted = !ban.is_active;
  const active = ban.is_active && !expired;

  const cfg = typeConfig[ban.ban_type] || typeConfig.ip;
  const TypeIcon = cfg.icon;

  /* Status */
  let statusLabel, statusClasses, dotClasses;
  if (lifted) {
    statusLabel = "Lifted";
    statusClasses = "text-muted-foreground bg-muted/20 border-border/40";
    dotClasses = "bg-muted-foreground";
  } else if (expired) {
    statusLabel = "Expired";
    statusClasses = "text-amber-400 bg-amber-500/10 border-amber-500/20";
    dotClasses = "bg-amber-400";
  } else {
    statusLabel = "Active";
    statusClasses = "text-destructive bg-destructive/10 border-destructive/20";
    dotClasses = "bg-destructive cmd-blink";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: "easeOut" }}
      layout
      className={`group relative overflow-hidden border bg-card/60 cmd-glass transition-all duration-300 ${
        active ? "border-destructive/20 hover:border-destructive/30" : "border-border hover:border-border/80"
      }`}
    >
      {/* Accent line */}
      <div className={`h-[2px] w-full ${
        active
          ? "bg-gradient-to-r from-red-500 via-rose-500 to-red-500 bg-[length:200%_100%] animate-[cmd-data-stream_3s_linear_infinite]"
          : lifted
            ? "bg-gradient-to-r from-muted-foreground/20 via-muted-foreground/10 to-muted-foreground/20"
            : "bg-gradient-to-r from-amber-500/40 via-amber-400/30 to-amber-500/40"
      }`} />

      {/* Hover scan */}
      {active && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-destructive/30 to-transparent cmd-scan-line" />
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Type icon */}
          <div className={`shrink-0 p-2.5 border ${cfg.border} ${cfg.bg}`}>
            <TypeIcon className={`h-5 w-5 ${cfg.color}`} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Value + Status */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-mono text-sm font-semibold ${lifted ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {ban.value}
              </span>

              {/* Status badge */}
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider border ${statusClasses}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${dotClasses}`} />
                {statusLabel}
              </span>

              {/* Type badge */}
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${cfg.color} ${cfg.bg} border ${cfg.border}`}>
                {cfg.label}
              </span>
            </div>

            {/* Reason */}
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {ban.reason || "No reason specified"}
            </p>

            {/* Meta row */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Shield className="h-2.5 w-2.5" />
                {ban.banned_by || "admin"}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-2.5 w-2.5" />
                {ban.created_date ? format(new Date(ban.created_date), "dd MMM yyyy") : "—"}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {ban.expires_at ? `Expires ${format(new Date(ban.expires_at), "dd MMM yyyy")}` : "Permanent"}
              </span>
            </div>
          </div>
        </div>

        {/* Lift button */}
        {ban.is_active && (
          <div className="mt-4 pt-3 border-t border-border/30 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="rounded-none h-8 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
              disabled={liftBan.isPending}
              onClick={() => liftBan.mutate(ban.id)}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              {liftBan.isPending ? "Lifting…" : "Lift Ban"}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Main BansManager ────────────────────────────────────── */
export default function BansManager() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [newType, setNewType] = useState("ip");
  const [newValue, setNewValue] = useState("");
  const [newReason, setNewReason] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const { data: bans = [], isLoading, isError } = useQuery({ queryKey: ["bans"], queryFn: () => base44.entities.Ban.list("-created_date", 500), retry: false, meta: { silent: true } });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["bans"] });

  const addBan = useMutation({
    mutationFn: () => base44.entities.Ban.create({
      ban_type: newType,
      value: newValue.trim().toLowerCase(),
      reason: newReason.trim() || "Added by admin",
      banned_by: me?.email || "",
      is_active: true,
    }),
    onSuccess: () => { refresh(); setNewValue(""); setNewReason(""); toast({ title: "Ban added" }); },
  });

  const liftBan = useMutation({
    mutationFn: (id) => base44.entities.Ban.update(id, { is_active: false }),
    onSuccess: () => { refresh(); toast({ title: "Ban lifted" }); },
  });

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return bans.filter((b) => `${b.value || ""} ${b.reason || ""} ${b.ban_type || ""}`.toLowerCase().includes(term));
  }, [bans, search]);

  /* Stats */
  const totalBans = bans.length;
  const activeCount = bans.filter((b) => b.is_active && !isExpired(b)).length;
  const expiredCount = bans.filter((b) => b.is_active && isExpired(b)).length;
  const liftedCount = bans.filter((b) => !b.is_active).length;

  return (
    <section className="grid gap-5">
      {/* ── Section Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden border border-border bg-card/60 cmd-glass"
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-red-500 via-rose-500 to-red-500 bg-[length:200%_100%] animate-[cmd-data-stream_3s_linear_infinite]" />
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 border border-destructive/30 bg-destructive/10">
              <ShieldX className="h-3.5 w-3.5 text-destructive" />
            </div>
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-destructive font-mono">
              Ban Management
            </p>
            {activeCount > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 bg-destructive/5 border border-destructive/10">
                <span className="h-1 w-1 rounded-full bg-destructive cmd-blink" />
                <span className="text-[7px] font-bold uppercase tracking-wider text-destructive/70">{activeCount} Active</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl md:text-4xl uppercase leading-none tracking-wide">Bans</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Block by IP, email or account. IP bans are best-effort (VPNs/shared connections can evade them), so prefer time-limited bans and lift them when no longer needed.
              </p>
            </div>

            {/* Stats badges */}
            <div className="flex flex-wrap items-center gap-2">
              <StatBadge icon={ShieldX} label="Total" value={totalBans} color="text-muted-foreground" bg="bg-muted/20" border="border-border/40" />
              {activeCount > 0 && (
                <StatBadge icon={ShieldX} label="Active" value={activeCount} color="text-destructive" bg="bg-destructive/5" border="border-destructive/10" pulse />
              )}
              {expiredCount > 0 && (
                <StatBadge icon={AlertTriangle} label="Expired" value={expiredCount} color="text-amber-400" bg="bg-amber-500/5" border="border-amber-500/10" />
              )}
              {liftedCount > 0 && (
                <StatBadge icon={CheckCircle2} label="Lifted" value={liftedCount} color="text-muted-foreground" bg="bg-muted/20" border="border-border/40" />
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {isError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border border-amber-500/40 bg-amber-500/10 cmd-glass p-4"
        >
          <p className="text-sm text-amber-300">
            The ban system activates once the latest changes are deployed to the app. Until then, bans can't be created or listed.
          </p>
        </motion.div>
      )}

      {/* ── Collapsible "Add Ban" Form ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.35 }}
        className="overflow-hidden border border-border bg-card/60 cmd-glass"
      >
        <button
          onClick={() => setFormOpen(!formOpen)}
          className="w-full flex items-center justify-between p-5 hover:bg-muted/10 transition-colors group/toggle"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 border border-destructive/20 bg-destructive/5">
              <Plus className="h-4 w-4 text-destructive" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold uppercase tracking-wider text-foreground">Add New Ban</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Block an IP address, email address, or user account
              </p>
            </div>
          </div>
          <motion.div animate={{ rotate: formOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronDown className="h-4 w-4 text-muted-foreground group-hover/toggle:text-foreground transition-colors" />
          </motion.div>
        </button>

        <AnimatePresence>
          {formOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="border-t border-border/50 p-5">
                <div className="grid gap-4 md:grid-cols-[160px_1fr_1fr]">
                  <FieldLabel label="Ban Type">
                    <Select value={newType} onValueChange={setNewType}>
                      <SelectTrigger className="rounded-none bg-background/40 border-border/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ip">IP address</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="user">User ID</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldLabel>
                  <FieldLabel label="Value to Block">
                    <Input
                      placeholder={newType === "ip" ? "e.g. 192.168.1.1" : newType === "email" ? "e.g. spammer@example.com" : "User ID"}
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="rounded-none bg-background/40 border-border/60 font-mono"
                    />
                  </FieldLabel>
                  <FieldLabel label="Reason">
                    <Input
                      placeholder="e.g. Repeated spam"
                      value={newReason}
                      onChange={(e) => setNewReason(e.target.value)}
                      className="rounded-none bg-background/40 border-border/60"
                    />
                  </FieldLabel>
                </div>
                <div className="mt-4">
                  <Button
                    onClick={() => addBan.mutate()}
                    disabled={!newValue.trim() || addBan.isPending}
                    className="rounded-none bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {addBan.isPending ? "Adding…" : "Add Ban"}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Search ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.35 }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
        <Input
          placeholder="Search bans by value, reason, or type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-none pl-10 bg-card/60 border-border cmd-glass"
        />
      </motion.div>

      {/* ── Ban Cards ── */}
      {isLoading ? (
        <div className="border border-border bg-card/60 cmd-glass overflow-hidden">
          <div className="h-[2px] w-full bg-gradient-to-r from-red-500 via-rose-500 to-red-500 bg-[length:200%_100%] animate-[cmd-data-stream_3s_linear_infinite]" />
          <div className="p-6 flex items-center gap-3">
            <div className="h-5 w-5 border-2 border-destructive/40 border-t-destructive rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading bans…</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="border border-border/60 bg-card/30 cmd-glass py-16 flex flex-col items-center justify-center text-center"
        >
          <div className="p-4 border border-border/30 bg-muted/10 mb-4">
            <ShieldX className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <p className="text-sm font-bold text-muted-foreground mb-1">No bans found</p>
          <p className="text-xs text-muted-foreground/60 max-w-xs">
            {bans.length === 0
              ? 'Click "Add New Ban" above to create your first ban rule.'
              : "Try adjusting your search term above."
            }
          </p>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {filtered.map((ban, i) => (
              <BanCard key={ban.id} ban={ban} index={i} liftBan={liftBan} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
