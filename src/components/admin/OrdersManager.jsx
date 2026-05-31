import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statuses = ["pending", "paid", "packing", "shipped", "completed", "cancelled", "refunded"];

export default function OrdersManager({ orders }) {
  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.StoreOrder.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  return (
    <section id="orders-admin" className="scroll-mt-28 border border-border bg-card p-6">
      <h2 className="font-display text-4xl uppercase">Orders Admin</h2>
      <div className="mt-6 grid gap-4">
        {orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
        {orders.map((order) => (
          <div key={order.id} className="grid gap-4 border border-border p-4 lg:grid-cols-[1fr_180px_260px]">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-primary">{order.created_date ? format(new Date(order.created_date), "dd MMM yyyy") : "New order"}</p>
              <h3 className="mt-2 text-lg font-semibold">{order.customer_name || "Customer"} · ${Number(order.total_aud || 0).toFixed(2)} AUD</h3>
              <p className="text-sm text-muted-foreground">{order.customer_email}</p>
              <p className="mt-2 text-sm text-muted-foreground">{(order.line_items || []).map((item) => `${item.quantity}× ${item.name}`).join(", ")}</p>
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