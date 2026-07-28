/* ━━━ AdminPullToRefresh ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Admin PWA flavour of the shared pull-to-refresh: invalidates every cached
 * query so all panels reload, with haptics off and a smaller caption.
 */
import React from "react";
import PullToRefresh from "@/components/PullToRefresh";

export default function AdminPullToRefresh({ children }) {
  return (
    <PullToRefresh haptics={false} labelClassName="text-[9px]">
      {children}
    </PullToRefresh>
  );
}
