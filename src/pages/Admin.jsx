import React, { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const OverviewPanel = lazyWithRetry(() => import("@/components/admin/panels/OverviewPanel"), "overview");
const ContentPanel = lazyWithRetry(() => import("@/components/admin/panels/ContentPanel"), "content");
const EventsPanel = lazyWithRetry(() => import("@/components/admin/panels/EventsPanel"), "events");
const StorePanel = lazyWithRetry(() => import("@/components/admin/panels/StorePanel"), "store");
const CommunityPanel = lazyWithRetry(() => import("@/components/admin/panels/CommunityPanel"), "community");
const PeoplePanel = lazyWithRetry(() => import("@/components/admin/panels/PeoplePanel"), "people");
const SettingsPanel = lazyWithRetry(() => import("@/components/admin/panels/SettingsPanel"), "settings");
const AdsPanel = lazyWithRetry(() => import("@/components/admin/panels/AdsPanel"), "ads");


const PanelLoading = () => (
  <div className="flex h-48 w-full items-center justify-center">
    <div className="h-6 w-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
  </div>
);

// Access is enforced by <RequireAdmin> in App.jsx. This component only owns the
// dashboard layout and its deep-linkable section routes.
export default function Admin() {
  return (
    <AdminLayout>
      <Suspense fallback={<PanelLoading />}>
        <Routes>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewPanel />} />
          <Route path="content" element={<ContentPanel />} />
          <Route path="events" element={<EventsPanel />} />
          <Route path="store" element={<StorePanel />} />
          <Route path="community" element={<CommunityPanel />} />
          <Route path="people" element={<PeoplePanel />} />
          <Route path="settings" element={<SettingsPanel />} />
          <Route path="ads" element={<AdsPanel />} />
          <Route path="*" element={<Navigate to="overview" replace />} />
        </Routes>
      </Suspense>
    </AdminLayout>
  );
}