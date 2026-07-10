import { lazy, Suspense } from "react";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton } from "../../components/NativePrimitives.jsx";

// The existing account tab components are self-contained (fetch their own
// data, use useAuth) — each becomes a native sub-screen under the hub.
const SECTIONS = {
  fanhub: { title: "Fan Hub", Component: lazy(() => import("@/components/account/FanHubTab")) },
  achievements: { title: "Achievements", Component: lazy(() => import("@/components/account/AchievementsTab")) },
  leaderboard: { title: "Leaderboard", Component: lazy(() => import("@/components/account/LeaderboardTab")) },
  profile: { title: "Profile", Component: lazy(() => import("@/components/account/ProfileTab")) },
  orders: { title: "Orders", Component: lazy(() => import("@/components/account/OrdersTab")) },
  posts: { title: "My Posts", Component: lazy(() => import("@/components/account/PostsTab")) },
  interest: { title: "Trip Interest", Component: lazy(() => import("@/components/account/InterestTab")) },
  security: { title: "Security", Component: lazy(() => import("@/components/account/SecurityTab")) },
};

export const NATIVE_ACCOUNT_SECTIONS = Object.keys(SECTIONS);

export default function NativeAccountSection({ section }) {
  const entry = SECTIONS[section];
  if (!entry) return null;
  const { title, Component } = entry;
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <NativeTopBar title={title} fallback="/account" />
      <div className="mx-auto w-full max-w-2xl px-4 py-4">
        <Suspense fallback={<NativeSkeleton className="h-64 w-full" />}>
          <Component />
        </Suspense>
      </div>
    </div>
  );
}
