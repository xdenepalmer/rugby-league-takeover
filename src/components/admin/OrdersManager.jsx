import React, { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, Download, DollarSign, ShoppingCart, Clock, PackageCheck, BadgeCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { downloadCsv } from "@/lib/csv";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statuses = ["pending", "paid", "packing", "shipped", "completed", "cancelled", "refunded"];
const paidLike = ["paid", "packing", "shipped", "completed"];
const toFulfil = ["paid", "packing"];

const statusTone = {
  paid: "border-emerald-500/40 text-emerald-400",
  packing: "border-sky-500/40 text-sky-400",
  shipped: "border-sky-500/40 text-sky-400",
  completed: "border-emerald-500/40 text-emerald-400",
  cancelled: "border-destructive/40 text-destructive",
  refunded: "border-destructive/40 text-destructive",
  pending: "border-amber-500/40 text-amber-400",
};

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between border border-border bg-background/40 p-4">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-2xl text-foreground">{value}</p>
      </div>
      <Icon className="h-6 w-6 stroke-1 text-primary" />
    </div>
  );
}

export default function OrdersManager({ orders }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.StoreOrder.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const revenue = useMemo(() => orders.filter((o) => paidLike.includes(o.status)).reduce((s, o) => s + Number(o.total_aud || 0), 0), [orders]);
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const fulfilCount = orders.filter((o) => toFulfil.includes(o.status)).length;

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && (o.status || "pending") !== statusFilter) return false;
      const hay = `${o.customer_name || ""} ${o.customer_email || ""} ${(o.line_items || []).map((i) => i.name).join(" ")}`.toLowerCase();
      return hay.includes(term);
    });
  }, [orders, search, statusFilter]);

  const exportCsv = () => {
    const headers = ["Date", "Customer", "Email", "Account", "Status", "Total AUD", "Items", "Shipping notes"];
    const rows = filtered.map((o) => [
      o.created_date ? format(new Date(o.created_date), "yyyy-MM-dd") : "",
      o.customer_name, o.customer_email, o.user_email || "guest", o.status || "pending",
      Number(o.total_aud || 0).toFixed(2),
      (o.line_items || []).map((i) => `${i.quantity}x ${i.name}`).join("; "),
      o.shipping_notes || "",
    ]);
    downloadCsv("rugby-league-takeover-orders.csv", headers, rows);
  };

  return (
    <section id="orders-admin" className="scroll-mt-28 border border-border bg-card p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="font-display text-4xl uppercase">Orders</h2>
        <Button variant="outline" className="rounded-none" onClick={exportCsv} disabled={!filtered.length}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={DollarSign} label="Revenue (paid)" value={`$${revenue.toFixed(2)}`} />
        <Stat icon={ShoppingCart} label="Total orders" value={orders.length} />
        <Stat icon={Clock} label="Pending payment" value={pendingCount} />
        <Stat icon={PackageCheck} label="To fulfil" value={fulfilCount} />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search customer, email or item" value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-none pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="rounded-none sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 grid gap-4">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No orders match your filters.</p>}
        {filtered.map((order) => (
          <div key={order.id} className="grid gap-4 border border-border p-4 lg:grid-cols-[1fr_180px_260px]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs uppercase tracking-[0.25em] text-primary">{order.created_date ? format(new Date(order.created_date), "dd MMM yyyy") : "New order"}</p>
                <Badge variant="outline" className={`rounded-none uppercase ${statusTone[order.status] || "border-border text-muted-foreground"}`}>{order.status || "pending"}</Badge>
                {order.payment_verified_at && <span className="flex items-center gap-1 text-[10px] uppercase text-emerald-400"><BadgeCheck className="h-3 w-3" /> Verified</span>}
              </div>
              <h3 className="mt-2 text-lg font-semibold">{order.customer_name || "Customer"} · ${Number(order.total_aud || 0).toFixed(2)} AUD</h3>
              <p className="text-sm text-muted-foreground">{order.customer_email}{order.user_email ? " · account" : " · guest"}</p>
              <p className="mt-2 text-sm text-muted-foreground">{(order.line_items || []).map((item) => `${item.quantity}× ${item.name}`).join(", ") || "—"}</p>
            </div>
            <Select value={order.status || "pending"} onValueChange={(value) => updateMutation.mutate({ id: order.id, data: { status: value } })}>
              <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea placeholder="Shipping notes / tracking" defaultValue={order.shipping_notes || ""} onBlur={(e) => updateMutation.mutate({ id: order.id, data: { shipping_notes: e.target.value } })} className="min-h-20 rounded-none" />
          </div>
        ))}
      </div>
    </section>
  );
}
