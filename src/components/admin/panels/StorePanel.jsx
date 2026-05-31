import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import ProductsManager from "../ProductsManager";
import OrdersManager from "../OrdersManager";

export default function StorePanel() {
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => base44.entities.Product.list("sort_order", 200) });
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: () => base44.entities.StoreOrder.list("-created_date", 200) });

  return (
    <div className="grid gap-8">
      <ProductsManager products={products} />
      <OrdersManager orders={orders} />
    </div>
  );
}
