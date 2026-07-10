import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import NativeAdminShell from "./NativeAdminShell.jsx";
import NativeAdminOverview from "./NativeAdminOverview.jsx";
import {
  NativeAdminSectionHub,
  NativeAdminModuleScreen,
  NativeAdminMoreScreen,
} from "./NativeAdminScreens.jsx";
import { NativeSkeleton } from "../components/NativePrimitives.jsx";

const NativeOrderDetail = lazy(() =>
  import("./workflows/NativeOrdersWorkflow.jsx").then((m) => ({ default: m.NativeOrderDetail }))
);
const NativeRegistrationDetail = lazy(() =>
  import("./workflows/NativeRegistrationsWorkflow.jsx").then((m) => ({ default: m.NativeRegistrationDetail }))
);

const lazyScreen = (node) => <Suspense fallback={<NativeSkeleton className="mx-4 mt-6 h-72" />}>{node}</Suspense>;

/**
 * Native admin route tree (mounted behind RequireAdmin). Unlike the web —
 * where sub-tabs are component state and URLs stop at /admin/<section> —
 * every module here is addressable (/admin/store/orders), so notifications
 * and the overview queue can deep-link straight into the work.
 */
export default function NativeAdminRoutes() {
  return (
    <Routes>
      <Route element={<NativeAdminShell />}>
        <Route index element={<NativeAdminOverview />} />
        <Route path="overview" element={<Navigate to="/admin" replace />} />

        <Route path="content" element={<NativeAdminSectionHub section="content" />} />
        <Route path="content/:module" element={<NativeAdminModuleScreen section="content" />} />
        <Route path="store" element={<NativeAdminSectionHub section="store" />} />
        <Route path="store/orders/:orderId" element={lazyScreen(<NativeOrderDetail />)} />
        <Route path="store/:module" element={<NativeAdminModuleScreen section="store" />} />
        <Route path="community" element={<NativeAdminSectionHub section="community" />} />
        <Route path="community/:module" element={<NativeAdminModuleScreen section="community" />} />

        <Route path="more" element={<NativeAdminMoreScreen />} />
        <Route path="more/:module" element={<NativeAdminModuleScreen section="export" />} />
        <Route path="events" element={<NativeAdminSectionHub section="events" />} />
        <Route path="events/:module" element={<NativeAdminModuleScreen section="events" />} />
        <Route path="people" element={<NativeAdminSectionHub section="people" />} />
        <Route path="people/registrations/:regId" element={lazyScreen(<NativeRegistrationDetail />)} />
        <Route path="people/:module" element={<NativeAdminModuleScreen section="people" />} />
        <Route path="ads" element={<NativeAdminSectionHub section="ads" />} />
        <Route path="ads/:module" element={<NativeAdminModuleScreen section="ads" />} />
        <Route path="settings/:module" element={<NativeAdminModuleScreen section="settings" />} />
        <Route path="settings" element={<Navigate to="/admin/settings/settings" replace />} />

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
