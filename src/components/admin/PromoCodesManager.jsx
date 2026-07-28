import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CalendarClock, Plus, RefreshCw, Tag, TicketPercent } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import AdminConfirmSheet from "./shared/AdminConfirmSheet";

const emptyDraft = {
  code: "",
  discountType: "percent",
  discountValue: "",
  minimumSubtotalAud: "",
  maxRedemptions: "",
  expiresAt: "",
};

const formatDate = (timestamp) => {
  if (!timestamp) return "No expiry";
  return new Date(Number(timestamp) * 1000).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const describeDiscount = (promotion) =>
  promotion.discountType === "fixed"
    ? `$${Number(promotion.discountValue || 0).toFixed(2)} AUD off`
    : `${Number(promotion.discountValue || 0).toFixed(2).replace(/\.00$/, "")}% off`;

export default function PromoCodesManager() {
  const [draft, setDraft] = useState(emptyDraft);
  const [showCreate, setShowCreate] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const queryClient = useQueryClient();

  const promoQuery = useQuery({
    queryKey: ["stripePromoCodes"],
    queryFn: async () => {
      const response = await base44.functions.invoke("promoCodes", { action: "list" });
      return response.data;
    },
    staleTime: 30_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["stripePromoCodes"] });
  const createMutation = useMutation({
    mutationFn: async () => {
      const value = Number(draft.discountValue);
      const minimum = draft.minimumSubtotalAud === "" ? 0 : Number(draft.minimumSubtotalAud);
      const limit = draft.maxRedemptions === "" ? null : Number(draft.maxRedemptions);
      if (!/^[A-Z0-9][A-Z0-9-]{1,31}$/.test(draft.code)) {
        throw new Error("Use 2–32 letters, numbers, or dashes for the code.");
      }
      if (!Number.isFinite(value) || value <= 0 || (draft.discountType === "percent" && value > 100)) {
        throw new Error(draft.discountType === "percent" ? "Percentage must be between 0.01 and 100." : "Enter a valid fixed AUD discount.");
      }
      if (!Number.isFinite(minimum) || minimum < 0) throw new Error("Minimum spend cannot be negative.");
      if (limit !== null && (!Number.isInteger(limit) || limit < 1)) throw new Error("Redemption limit must be a positive whole number.");

      return base44.functions.invoke("promoCodes", {
        action: "create",
        code: draft.code,
        discountType: draft.discountType,
        discountValue: value,
        minimumSubtotalAud: minimum,
        maxRedemptions: limit,
        expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null,
        requestId: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      setDraft(emptyDraft);
      setShowCreate(false);
      refresh();
      toast({ title: "Promo code is live", description: "Stripe will enforce it at checkout immediately." });
    },
    onError: (error) => toast({
      title: "Could not create promo code",
      description: error?.data?.error || error.message || "Check the details and try again.",
      variant: "destructive",
    }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (promotionCodeId) => base44.functions.invoke("promoCodes", {
      action: "deactivate",
      promotionCodeId,
    }),
    onSuccess: () => {
      setDeactivateTarget(null);
      refresh();
      toast({ title: "Promo code deactivated" });
    },
    onError: (error) => toast({
      title: "Could not deactivate promo code",
      description: error?.data?.error || "Please try again.",
      variant: "destructive",
    }),
  });

  const promotions = promoQuery.data?.promotionCodes || [];
  const activeCount = promotions.filter((promotion) => promotion.active).length;
  const mode = promoQuery.data?.mode || "—";

  return (
    <div className="overflow-hidden border border-border/60 bg-card/30 cmd-glass">
      <div className="h-[2px] w-full bg-gradient-to-r from-violet-500 via-primary to-violet-500" />
      <div className="p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="border border-violet-500/20 bg-violet-500/10 p-2">
              <TicketPercent className="h-4 w-4 text-violet-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl uppercase tracking-wide">Promo Codes</h2>
                <span className={`border px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider ${
                  mode === "live"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                }`}>Stripe {mode}</span>
              </div>
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                {activeCount} active · {promotions.length} total · one code per order
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="mobileIcon"
              disabled={promoQuery.isFetching}
              onClick={() => promoQuery.refetch()}
              className="rounded-none border-border/50"
              aria-label="Refresh promo codes"
            >
              <RefreshCw className={`h-4 w-4 ${promoQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button
              type="button"
              size="mobile"
              onClick={() => setShowCreate((current) => !current)}
              className="rounded-none text-[9px] font-bold uppercase tracking-wider"
            >
              <Plus className="h-3 w-3" /> {showCreate ? "Close" : "New code"}
            </Button>
          </div>
        </div>

        {showCreate && (
          <div className="mb-5 space-y-4 border border-primary/25 bg-primary/[0.03] p-4 md:p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1">
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Customer code</span>
                <Input
                  value={draft.code}
                  maxLength={32}
                  autoComplete="off"
                  placeholder="TAKEOVER10"
                  onChange={(event) => setDraft({
                    ...draft,
                    code: event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""),
                  })}
                  className="h-11 rounded-none border-border/50 font-mono uppercase"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Discount type</span>
                <select
                  value={draft.discountType}
                  onChange={(event) => setDraft({ ...draft, discountType: event.target.value })}
                  className="h-11 w-full rounded-none border border-border/50 bg-background px-3 text-sm text-foreground"
                >
                  <option value="percent">Percentage off</option>
                  <option value="fixed">Fixed AUD amount</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {draft.discountType === "percent" ? "Percentage" : "Amount (AUD)"}
                </span>
                <Input
                  type="number"
                  min="0.01"
                  max={draft.discountType === "percent" ? "100" : "50000"}
                  step="0.01"
                  placeholder={draft.discountType === "percent" ? "10" : "15.00"}
                  value={draft.discountValue}
                  onChange={(event) => setDraft({ ...draft, discountValue: event.target.value })}
                  className="h-11 rounded-none border-border/50"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Minimum merch spend (AUD)</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional"
                  value={draft.minimumSubtotalAud}
                  onChange={(event) => setDraft({ ...draft, minimumSubtotalAud: event.target.value })}
                  className="h-11 rounded-none border-border/50"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Maximum uses</span>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Unlimited"
                  value={draft.maxRedemptions}
                  onChange={(event) => setDraft({ ...draft, maxRedemptions: event.target.value })}
                  className="h-11 rounded-none border-border/50"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Expires (Brisbane time)</span>
                <Input
                  type="datetime-local"
                  value={draft.expiresAt}
                  onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })}
                  className="h-11 rounded-none border-border/50"
                />
              </label>
            </div>
            <div className="flex flex-col justify-between gap-3 border-t border-border/40 pt-4 sm:flex-row sm:items-center">
              <p className="max-w-2xl text-[10px] leading-relaxed text-muted-foreground">
                The minimum spend and free-shipping threshold use the merchandise subtotal before the discount. Stripe records each successful redemption.
              </p>
              <Button
                type="button"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="min-h-[44px] shrink-0 rounded-none px-6 text-[10px] font-bold uppercase tracking-wider"
              >
                {createMutation.isPending ? "Creating in Stripe…" : "Create & activate"}
              </Button>
            </div>
          </div>
        )}

        {promoQuery.isError && (
          <div className="border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Promo codes could not be loaded. Confirm the function and Stripe secrets are deployed, then refresh.
          </div>
        )}

        {!promoQuery.isLoading && !promoQuery.isError && promotions.length === 0 && (
          <div className="border border-dashed border-border/60 p-10 text-center">
            <Tag className="mx-auto h-7 w-7 text-muted-foreground/30" />
            <p className="mt-3 text-sm font-bold uppercase tracking-wider">No promo codes yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Create the first code when you’re ready to run a promotion.</p>
          </div>
        )}

        <div className="grid gap-3">
          {promotions.map((promotion) => {
            const exhausted = promotion.maxRedemptions && promotion.timesRedeemed >= promotion.maxRedemptions;
            const expired = promotion.expiresAt && Number(promotion.expiresAt) * 1000 <= Date.now();
            const active = promotion.active && !exhausted && !expired;
            return (
              <div key={promotion.id} className={`border p-4 ${active ? "border-border/60 bg-background/35" : "border-border/30 bg-background/15 opacity-65"}`}>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-bold text-foreground">{promotion.code}</span>
                      <span className={`border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                        active
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-border/50 bg-muted/20 text-muted-foreground"
                      }`}>{active ? "Active" : exhausted ? "Used up" : expired ? "Expired" : "Inactive"}</span>
                      <span className="border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold text-violet-300">
                        {describeDiscount(promotion)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                      <span>{promotion.minimumSubtotalAud > 0 ? `Minimum $${Number(promotion.minimumSubtotalAud).toFixed(2)} merch` : "No minimum"}</span>
                      <span>{promotion.maxRedemptions ? `${promotion.timesRedeemed}/${promotion.maxRedemptions} used` : `${promotion.timesRedeemed} used · unlimited`}</span>
                      <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {formatDate(promotion.expiresAt)}</span>
                    </div>
                  </div>
                  {active && (
                    <Button
                      type="button"
                      variant="outline"
                      size="mobile"
                      onClick={() => setDeactivateTarget(promotion)}
                      className="shrink-0 rounded-none border-destructive/30 text-[9px] font-bold uppercase tracking-wider text-destructive hover:bg-destructive/10"
                    >
                      <Ban className="h-3 w-3" /> Deactivate
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AdminConfirmSheet
        open={Boolean(deactivateTarget)}
        title={`Deactivate ${deactivateTarget?.code || "promo code"}?`}
        description="Customers will no longer be able to apply this code. Existing paid orders are not changed."
        confirmLabel="Deactivate"
        variant="destructive"
        loading={deactivateMutation.isPending}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateMutation.mutate(deactivateTarget.id)}
      />
    </div>
  );
}
