import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ShoppingBag, Activity } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ProductsManager from "../ProductsManager";
import OrdersManager from "../OrdersManager";
import FaqManager from "../FaqManager";

export default function StorePanel() {
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => base44.entities.Product.list("sort_order", 200) });
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: () => base44.entities.StoreOrder.list("-created_date", 200) });
  const { data: faqs = [] } = useQuery({ queryKey: ["faqs"], queryFn: () => base44.entities.Faq.list("sort_order", 200), retry: false, meta: { silent: true } });

  return (
    <div className="grid gap-5">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden border border-border bg-card/60 cmd-glass"
      >
        <div className="cmd-accent-bar h-[2px] w-full" />
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag className="h-4 w-4 text-accent" />
            <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-accent font-mono">
              Store Module
            </p>
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-accent/5 border border-accent/10">
              <Activity className="h-2.5 w-2.5 text-accent cmd-pulse" />
              <span className="text-[8px] font-bold uppercase tracking-wider text-accent">Live</span>
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl uppercase leading-none tracking-wide">
            Store & Merchandise
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Manage products, pricing, inventory and fulfil merchandise orders.
            All transactions processed securely via Stripe with real-time status tracking.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <ProductsManager products={products} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <OrdersManager orders={orders} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <FaqManager faqs={faqs} />
      </motion.div>
    </div>
  );
}
