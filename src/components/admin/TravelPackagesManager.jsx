import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save, Trash2, Map, Plane, Plus, ChevronDown, Pencil, X, ArrowUpDown, Clock, Eye, EyeOff, Package,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import ImageField from "./ImageField";

const emptyPackage = { name: "", description: "", image_url: "", is_coming_soon: true, sort_order: 1 };

/* ─── Inline label wrapper ──────────────────────────────── */
function FieldLabel({ label, helpText, icon: Icon, children, className = "" }) {
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </label>
      {children}
      {helpText && (
        <p className="text-[9px] text-muted-foreground/50">{helpText}</p>
      )}
    </div>
  );
}

/* ─── Package Preview Card ──────────────────────────────── */
function PackageCard({ pkg, index, updateMutation, deleteMutation }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const descPreview = pkg.description?.length > 100
    ? pkg.description.slice(0, 100) + "…"
    : pkg.description;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: "easeOut" }}
      layout
      className="group relative overflow-hidden border border-border bg-card/60 cmd-glass hover:border-primary/20 transition-all duration-300"
    >
      {/* Top accent line  — cyan/teal */}
      <div
        className="h-[2px] w-full"
        style={{
          background: pkg.is_coming_soon !== false
            ? "linear-gradient(90deg, #06b6d4 0%, #14b8a6 50%, #06b6d4 100%)"
            : "linear-gradient(90deg, #10b981 0%, #34d399 50%, #10b981 100%)",
          backgroundSize: "200% 100%",
          animation: "cmd-data-stream 3s linear infinite",
        }}
      />

      {/* Scanning overlay on hover */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent cmd-scan-line" />
      </div>

      {editing ? (
        /* ── Edit Mode ── */
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Pencil className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-400 font-mono">
                Editing Package
              </span>
            </div>
            <button
              onClick={() => setEditing(false)}
              className="p-1.5 border border-border/50 hover:border-primary/30 hover:text-primary transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FieldLabel label="Package Name" icon={Package} helpText="Display name shown on the homepage">
              <Input
                defaultValue={pkg.name || ""}
                onBlur={(e) => updateMutation.mutate({ id: pkg.id, data: { name: e.target.value } })}
                className="rounded-none"
              />
            </FieldLabel>
            <FieldLabel label="Sort Order" icon={ArrowUpDown} helpText="Lower numbers appear first">
              <Input
                type="number"
                defaultValue={pkg.sort_order || 1}
                onBlur={(e) => updateMutation.mutate({ id: pkg.id, data: { sort_order: Number(e.target.value) } })}
                className="rounded-none"
              />
            </FieldLabel>
            <FieldLabel label="Description" className="md:col-span-2" helpText="Brief summary shown in the package card">
              <Textarea
                defaultValue={pkg.description || ""}
                onBlur={(e) => updateMutation.mutate({ id: pkg.id, data: { description: e.target.value } })}
                className="min-h-24 rounded-none"
              />
            </FieldLabel>
            <ImageField
              label="Package image"
              value={pkg.image_url}
              onChange={(url) => updateMutation.mutate({ id: pkg.id, data: { image_url: url } })}
              className="md:col-span-2"
            />
            <div className="flex items-end gap-3 pb-1">
              <FieldLabel label="Coming Soon">
                <div className="flex items-center gap-2 h-10">
                  <Switch
                    checked={pkg.is_coming_soon !== false}
                    onCheckedChange={(value) => updateMutation.mutate({ id: pkg.id, data: { is_coming_soon: value } })}
                  />
                  <span className="text-xs text-muted-foreground">
                    {pkg.is_coming_soon !== false ? "Coming Soon" : "Available Now"}
                  </span>
                </div>
              </FieldLabel>
            </div>
          </div>
        </div>
      ) : (
        /* ── Preview Mode ── */
        <div className="flex flex-col md:flex-row">
          {/* Image thumbnail */}
          {pkg.image_url ? (
            <div className="relative w-full md:w-40 h-32 md:h-auto shrink-0 overflow-hidden bg-secondary">
              <img
                src={pkg.image_url}
                alt={pkg.name || "Package"}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent md:bg-gradient-to-r" />
            </div>
          ) : (
            <div className="hidden md:flex w-40 shrink-0 items-center justify-center bg-muted/20 border-r border-border/40">
              <Plane className="h-8 w-8 text-muted-foreground/15" />
            </div>
          )}

          <div className="flex-1 p-5">
            {/* Title & badges row */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-xl uppercase leading-tight text-foreground truncate">
                  {pkg.name || "Untitled Package"}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {/* Coming Soon badge */}
                  {pkg.is_coming_soon !== false ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider border text-cyan-400 bg-cyan-500/10 border-cyan-500/20">
                      <Clock className="h-2.5 w-2.5" />
                      Coming Soon
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 cmd-blink" />
                      Available
                    </span>
                  )}

                  {/* Sort order badge */}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono text-muted-foreground bg-muted/20 border border-border/40">
                    <ArrowUpDown className="h-2.5 w-2.5" />
                    #{pkg.sort_order || 1}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setEditing(true)}
                  className="p-2 border border-border/50 hover:border-cyan-400/30 hover:text-cyan-400 transition-colors text-muted-foreground"
                  title="Edit package"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>

                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="p-2 border border-border/50 hover:border-destructive/30 hover:text-destructive transition-colors text-muted-foreground"
                    title="Delete package"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => deleteMutation.mutate(pkg.id)}
                      className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="p-1.5 border border-border/50 hover:border-border text-muted-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Description preview */}
            {pkg.description && (
              <div className="mt-3 border-t border-border/30 pt-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {expanded ? pkg.description : descPreview}
                </p>
                {pkg.description?.length > 100 && (
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    {expanded ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {expanded ? "Show less" : "Read more"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ─── Main TravelPackagesManager ──────────────────────────── */
export default function TravelPackagesManager({ packages }) {
  const [draft, setDraft] = useState(emptyPackage);
  const [formOpen, setFormOpen] = useState(false);
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["packages"] });
  const createMutation = useMutation({ mutationFn: (data) => base44.entities.TravelPackage.create(data), onSuccess: () => { refresh(); setDraft(emptyPackage); setFormOpen(false); } });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.TravelPackage.update(id, data), onSuccess: refresh });
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.TravelPackage.delete(id), onSuccess: refresh });

  return (
    <section id="travel-admin" className="scroll-mt-28 grid gap-5">
      {/* ── Section Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden border border-border bg-card/60 cmd-glass"
      >
        <div
          className="h-[2px] w-full"
          style={{
            background: "linear-gradient(90deg, #06b6d4 0%, #14b8a6 30%, #22d3ee 50%, #14b8a6 70%, #06b6d4 100%)",
            backgroundSize: "200% 100%",
            animation: "cmd-data-stream 3s linear infinite",
          }}
        />
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 border border-cyan-500/20 bg-cyan-500/5">
              <Map className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-cyan-400 font-mono">
              Step 4
            </p>
            <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-500/5 border border-cyan-500/10">
              <span className="h-1 w-1 rounded-full bg-cyan-400 cmd-blink" />
              <span className="text-[7px] font-bold uppercase tracking-wider text-cyan-400/70">Active</span>
            </span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl md:text-4xl uppercase leading-none tracking-wide">
                Travel packages
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create, reorder and edit the package cards shown on the homepage.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/5 border border-cyan-500/10 text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                <Package className="h-3 w-3" />
                {packages.length} {packages.length === 1 ? "Package" : "Packages"}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Collapsible "Create" Form ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35 }}
        className="overflow-hidden border border-border bg-card/60 cmd-glass"
      >
        <button
          onClick={() => setFormOpen(!formOpen)}
          className="w-full flex items-center justify-between p-5 hover:bg-muted/10 transition-colors group/toggle"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 border border-cyan-500/20 bg-cyan-500/5">
              <Plus className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold uppercase tracking-wider text-foreground">
                Add New Package
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Create a new travel package card for the homepage
              </p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: formOpen ? 180 : 0 }}
            transition={{ duration: 0.25 }}
          >
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
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldLabel label="Package Name" icon={Package} helpText="Display name shown on the homepage">
                    <Input
                      placeholder="e.g. VIP Courtside Experience"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      className="rounded-none"
                    />
                  </FieldLabel>
                  <FieldLabel label="Sort Order" icon={ArrowUpDown} helpText="Lower numbers appear first on the page">
                    <Input
                      type="number"
                      value={draft.sort_order}
                      onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                      className="rounded-none"
                    />
                  </FieldLabel>
                  <FieldLabel label="Description" className="md:col-span-2" helpText="Brief summary shown below the package name">
                    <Textarea
                      placeholder="Describe what's included in this travel package…"
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      className="min-h-24 rounded-none"
                    />
                  </FieldLabel>
                  <ImageField
                    label="Package image"
                    value={draft.image_url}
                    onChange={(url) => setDraft({ ...draft, image_url: url })}
                    className="md:col-span-2"
                  />
                  <FieldLabel label="Coming Soon" className="md:col-span-2">
                    <div className="flex items-center gap-3 h-10">
                      <Switch
                        checked={draft.is_coming_soon !== false}
                        onCheckedChange={(value) => setDraft({ ...draft, is_coming_soon: value })}
                      />
                      <span className="text-xs text-muted-foreground">
                        {draft.is_coming_soon !== false ? "Show as coming soon" : "Show as available now"}
                      </span>
                    </div>
                  </FieldLabel>
                  <div className="md:col-span-2">
                    <Button
                      onClick={() => createMutation.mutate(draft)}
                      disabled={!draft.name || createMutation.isPending}
                      className="rounded-none bg-cyan-600 hover:bg-cyan-500 text-white w-full sm:w-auto"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {createMutation.isPending ? "Adding…" : "Add Package"}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Package Cards ── */}
      {packages.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="border border-border/60 bg-card/30 cmd-glass py-16 flex flex-col items-center justify-center text-center"
        >
          <div className="p-4 border border-border/30 bg-muted/10 mb-4">
            <Plane className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <p className="text-sm font-bold text-muted-foreground mb-1">No packages yet</p>
          <p className="text-xs text-muted-foreground/60 max-w-xs">
            Click "Add New Package" above to create your first travel package card.
          </p>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {packages.map((pkg, i) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                index={i}
                updateMutation={updateMutation}
                deleteMutation={deleteMutation}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
