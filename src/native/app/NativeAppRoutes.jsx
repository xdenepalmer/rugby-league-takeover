import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import RequireAuth from "@/components/RequireAuth";
import RequireAdmin from "@/components/RequireAdmin";
import PageNotFound from "@/lib/PageNotFound";
import NativePublicShell from "./NativePublicShell.jsx";
import NativeSubScreen from "../components/NativeSubScreen.jsx";

// Same underlying page chunks as the web tree (shared Vite chunks). Fan tab
// roots temporarily render the existing pages inside native chrome; 003B
// replaces them with native screen compositions one surface at a time.
const Home = lazy(() => import("@/pages/Home"));
const News = lazy(() => import("@/pages/News"));
const Forum = lazy(() => import("@/pages/Forum"));
const Store = lazy(() => import("@/pages/Store"));
const Account = lazy(() => import("@/pages/Account"));
const Gallery = lazy(() => import("@/pages/Gallery"));
const Faq = lazy(() => import("@/pages/Faq"));
const Terms = lazy(() => import("@/pages/Terms"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const Admin = lazy(() => import("@/pages/Admin"));

/**
 * The native iOS route tree. Web keeps its own tree in App.jsx — this one
 * exists so the shell can have app-grade navigation: five fan tabs inside
 * NativePublicShell, secondary destinations wrapped in native sub-screen
 * chrome, full-screen auth, and the (003C) admin experience. Canonical
 * paths match the web so universal links resolve on both platforms.
 */
export default function NativeAppRoutes() {
  return (
    <Routes>
      <Route element={<NativePublicShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/news" element={<News />} />
        <Route path="/forum" element={<Forum />} />
        <Route path="/store" element={<Store />} />
        <Route path="/account/*" element={<RequireAuth><Account /></RequireAuth>} />
        <Route
          path="/gallery"
          element={
            <NativeSubScreen title="Gallery">
              <Gallery />
            </NativeSubScreen>
          }
        />
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

      {/* Full-screen (no tab bar): auth flows and admin. */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin/*" element={<RequireAdmin><Admin /></RequireAdmin>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}
