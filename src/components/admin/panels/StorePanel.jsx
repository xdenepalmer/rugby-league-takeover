import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Package, HelpCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminPanelHeader from "../shared/AdminPanelHeader";
import AdminPanelTabs from "../shared/AdminPanelTabs";
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
    <div className="grid grid-cols-1 gap-5">
      <AdminPanelHeader
        icon={ShoppingBag}
        module="Store Module"
        title="Store & Merchandise"
        description="Manage products, pricing, inventory and fulfil merchandise orders. All transactions processed securely via Stripe with real-time status tracking."
        tone="accent"
      />

      <AdminPanelTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        layoutId="store-subtabs-glow"
        ariaLabel="Store tabs"
        tone="accent"
      />

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
