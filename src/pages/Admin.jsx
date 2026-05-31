import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import OverviewPanel from "@/components/admin/panels/OverviewPanel";
import ContentPanel from "@/components/admin/panels/ContentPanel";
import EventsPanel from "@/components/admin/panels/EventsPanel";
import StorePanel from "@/components/admin/panels/StorePanel";
import CommunityPanel from "@/components/admin/panels/CommunityPanel";
import PeoplePanel from "@/components/admin/panels/PeoplePanel";
import SettingsPanel from "@/components/admin/panels/SettingsPanel";

// Access is enforced by <RequireAdmin> in App.jsx. This component only owns the
// dashboard layout and its deep-linkable section routes.
export default function Admin() {
  return (
    <AdminLayout>
      <Routes>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<OverviewPanel />} />
        <Route path="content" element={<ContentPanel />} />
        <Route path="events" element={<EventsPanel />} />
        <Route path="store" element={<StorePanel />} />
        <Route path="community" element={<CommunityPanel />} />
        <Route path="people" element={<PeoplePanel />} />
        <Route path="settings" element={<SettingsPanel />} />
        <Route path="*" element={<Navigate to="overview" replace />} />
      </Routes>
    </AdminLayout>
  );
}
