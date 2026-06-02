import React, { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";

const OverviewPanel = lazy(() => import("@/components/admin/panels/OverviewPanel"));
const ContentPanel = lazy(() => import("@/components/admin/panels/ContentPanel"));
const EventsPanel = lazy(() => import("@/components/admin/panels/EventsPanel"));
const StorePanel = lazy(() => import("@/components/admin/panels/StorePanel"));
const CommunityPanel = lazy(() => import("@/components/admin/panels/CommunityPanel"));
const PeoplePanel = lazy(() => import("@/components/admin/panels/PeoplePanel"));
const SettingsPanel = lazy(() => import("@/components/admin/panels/SettingsPanel"));
const AdsPanel = lazy(() => import("@/components/admin/panels/AdsPanel"));

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
