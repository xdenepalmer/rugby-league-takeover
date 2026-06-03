import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Activity, Package, HelpCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ProductsManager from "../ProductsManager";
import OrdersManager from "../OrdersManager";
import FaqManager from "../FaqManager";

export default function StorePanel() {
  const [activeTab, setActiveTab] = useState("products");
  const { data: products = [], isLoading: productsLoading } = useQuery({ queryKey: ["products"], queryFn: () => base44.entities.Product.list("sort_order", 200) });
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: () => base44.entities.StoreOrder.list("-created_date", 200) });
  const { data: faqs = [] } = useQuery({ queryKey: ["faqs"], queryFn: () => base44.entities.Faq.list("sort_order", 200), retry: false, meta: { silent: true } });

  const tabs = [
    { id: "products", label: "Merch Products", icon: Package, count: products.length },
    { id: "orders", label: "Orders & Shipping", icon: ShoppingBag, count: orders.length },
    { id: "faqs", label: "Store FAQs", icon: HelpCircle, count: faqs.length },
  ];

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

      {/* Tabs navigation bar */}
      <div className="flex border-b border-border/60 overflow-x-auto cmd-scrollbar bg-secondary/15 backdrop-blur-sm p-1" role="tablist" aria-label="Store tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={isActive}
              className={`relative flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors duration-200 shrink-0 select-none ${
                isActive ? "text-foreground font-extrabold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-accent" : "text-muted-foreground/60"}`} />
              <span>{tab.label}</span>
              <span className={`text-[9px] font-mono px-1.5 py-0.25 ${isActive ? "bg-accent/20 text-accent border border-accent/25" : "bg-muted/30 text-muted-foreground border border-border/40"}`}>
                {tab.count}
              </span>
              {isActive && (
                <motion.div
                  layoutId="store-subtabs-glow"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
                  style={{ boxShadow: "0 0 10px hsl(var(--accent)/0.6)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Tab Panel */}
      <div className="min-h-[250px]" role="tabpanel">
        <AnimatePresence mode="wait">
          {activeTab === "products" && (
            <motion.div
              key="products-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <ProductsManager products={products} loading={productsLoading} />
            </motion.div>
          )}

          {activeTab === "orders" && (
            <motion.div
              key="orders-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <OrdersManager orders={orders} />
            </motion.div>
          )}

          {activeTab === "faqs" && (
            <motion.div
              key="faqs-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <FaqManager faqs={faqs} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
