import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import RequireAuth from "@/components/RequireAuth";
import RequireAdmin from "@/components/RequireAdmin";
import PageNotFound from "@/lib/PageNotFound";
import NativePublicShell from "./NativePublicShell.jsx";
import NativeRuntime from "./NativeRuntime.jsx";
import NativeSubScreen from "../components/NativeSubScreen.jsx";
import NativeAuthFrame from "../components/NativeAuthFrame.jsx";
import NativeAccountSection from "../screens/account/NativeAccountSection.jsx";

// Native fan screens (lazy — each is its own chunk fetched inside the shell).
const NativeHomeScreen = lazy(() => import("../screens/home/NativeHomeScreen.jsx"));
const NativeNewsScreen = lazy(() => import("../screens/news/NativeNewsScreen.jsx"));
const NativeArticleScreen = lazy(() => import("../screens/news/NativeArticleScreen.jsx"));
const NativeForumScreen = lazy(() => import("../screens/forum/NativeForumScreen.jsx"));
const NativeThreadScreen = lazy(() => import("../screens/forum/NativeThreadScreen.jsx"));
const NativeStoreScreen = lazy(() => import("../screens/store/NativeStoreScreen.jsx"));
const NativeProductScreen = lazy(() => import("../screens/store/NativeProductScreen.jsx"));
const NativeCheckoutReturnScreen = lazy(() => import("../screens/store/NativeCheckoutReturnScreen.jsx"));
const NativeGalleryScreen = lazy(() => import("../screens/gallery/NativeGalleryScreen.jsx"));
const NativeAccountScreen = lazy(() => import("../screens/account/NativeAccountScreen.jsx"));
const NativeNotificationsScreen = lazy(() => import("../screens/account/NativeNotificationsScreen.jsx"));

// Web pages reused inside native chrome where a rebuild adds no value.
const Faq = lazy(() => import("@/pages/Faq"));
const Terms = lazy(() => import("@/pages/Terms"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const NativeAdminRoutes = lazy(() => import("../admin/NativeAdminRoutes.jsx"));

/**
 * The native iOS route tree. Web keeps its own tree in App.jsx — this one
 * gives the shell app-grade navigation: five fan tabs of native screens,
 * real detail routes (/news/:id, /forum/thread/:id, /store/product/:id),
 * account list/detail, full-screen auth and admin. Canonical paths match
 * the web so universal links resolve on both platforms.
 */
export default function NativeAppRoutes() {
  return (
    <>
      <NativeRuntime />
      <Routes>
      <Route element={<NativePublicShell />}>
        <Route path="/" element={<NativeHomeScreen />} />
        <Route path="/news" element={<NativeNewsScreen />} />
        <Route path="/news/:id" element={<NativeArticleScreen />} />
        <Route path="/forum" element={<NativeForumScreen />} />
        <Route path="/forum/thread/:id" element={<NativeThreadScreen />} />
        <Route path="/store" element={<NativeStoreScreen />} />
        <Route path="/store/product/:id" element={<NativeProductScreen />} />
        <Route path="/store/checkout/success" element={<NativeCheckoutReturnScreen status="success" />} />
        <Route path="/store/checkout/cancel" element={<NativeCheckoutReturnScreen status="cancel" />} />
        <Route path="/gallery" element={<NativeGalleryScreen />} />

        <Route path="/account" element={<RequireAuth><NativeAccountScreen /></RequireAuth>} />
        <Route path="/account/notifications" element={<RequireAuth><NativeNotificationsScreen /></RequireAuth>} />
        <Route path="/account/fanhub" element={<RequireAuth><NativeAccountSection section="fanhub" /></RequireAuth>} />
        <Route path="/account/achievements" element={<RequireAuth><NativeAccountSection section="achievements" /></RequireAuth>} />
        <Route path="/account/leaderboard" element={<RequireAuth><NativeAccountSection section="leaderboard" /></RequireAuth>} />
        <Route path="/account/profile" element={<RequireAuth><NativeAccountSection section="profile" /></RequireAuth>} />
        <Route path="/account/orders" element={<RequireAuth><NativeAccountSection section="orders" /></RequireAuth>} />
        <Route path="/account/posts" element={<RequireAuth><NativeAccountSection section="posts" /></RequireAuth>} />
        <Route path="/account/interest" element={<RequireAuth><NativeAccountSection section="interest" /></RequireAuth>} />
        <Route path="/account/security" element={<RequireAuth><NativeAccountSection section="security" /></RequireAuth>} />

        <Route
          path="/faq"
          element={
            <NativeSubScreen title="FAQ">
              <Faq />
            </NativeSubScreen>
          }
        />
        <Route
          path="/terms"
          element={
            <NativeSubScreen title="Terms">
              <Terms />
            </NativeSubScreen>
          }
        />
        <Route
          path="/privacy"
          element={
            <NativeSubScreen title="Privacy">
              <Privacy />
            </NativeSubScreen>
          }
        />
      </Route>

      {/* Full-screen (no tab bar): auth flows and admin. Auth screens get a
          native Close affordance so signed-out guests are never trapped. */}
      <Route path="/login" element={<NativeAuthFrame><Login /></NativeAuthFrame>} />
      <Route path="/register" element={<NativeAuthFrame><Register /></NativeAuthFrame>} />
      <Route path="/forgot-password" element={<NativeAuthFrame><ForgotPassword /></NativeAuthFrame>} />
      <Route path="/reset-password" element={<NativeAuthFrame><ResetPassword /></NativeAuthFrame>} />
      <Route path="/admin/*" element={<RequireAdmin><NativeAdminRoutes /></RequireAdmin>} />
      <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
}
