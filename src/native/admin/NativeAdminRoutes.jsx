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

// ── Content ────────────────────────────────────────────────────────────────
const NativeNewsCompose = lazy(() =>
  import("./workflows/NativeNewsWorkflow.jsx").then((m) => ({ default: m.NativeNewsCompose }))
);
const NativeNewsDetail = lazy(() =>
  import("./workflows/NativeNewsWorkflow.jsx").then((m) => ({ default: m.NativeNewsDetail }))
);
const NativeTravelPackageDetail = lazy(() =>
  import("./workflows/NativeTravelWorkflow.jsx").then((m) => ({ default: m.NativeTravelPackageDetail }))
);
const NativeGalleryItemDetail = lazy(() =>
  import("./workflows/NativeGalleryWorkflow.jsx").then((m) => ({ default: m.NativeGalleryItemDetail }))
);
const NativeFaqDetail = lazy(() =>
  import("./workflows/NativeFaqsWorkflow.jsx").then((m) => ({ default: m.NativeFaqDetail }))
);
const NativePartnerDetail = lazy(() =>
  import("./workflows/NativePartnersWorkflow.jsx").then((m) => ({ default: m.NativePartnerDetail }))
);
const NativeTestimonialDetail = lazy(() =>
  import("./workflows/NativeTestimonialsWorkflow.jsx").then((m) => ({ default: m.NativeTestimonialDetail }))
);

// ── Store ────────────────────────────────────────────────────────────────
const NativeProductDetail = lazy(() =>
  import("./workflows/NativeProductsWorkflow.jsx").then((m) => ({ default: m.NativeProductDetail }))
);
const NativeOrderDetail = lazy(() =>
  import("./workflows/NativeOrdersWorkflow.jsx").then((m) => ({ default: m.NativeOrderDetail }))
);

// ── People ────────────────────────────────────────────────────────────────
const NativeUserDetail = lazy(() =>
  import("./workflows/NativeUsersWorkflow.jsx").then((m) => ({ default: m.NativeUserDetail }))
);
const NativeBanDetail = lazy(() =>
  import("./workflows/NativeBansWorkflow.jsx").then((m) => ({ default: m.NativeBanDetail }))
);
const NativeRegistrationDetail = lazy(() =>
  import("./workflows/NativeRegistrationsWorkflow.jsx").then((m) => ({ default: m.NativeRegistrationDetail }))
);

// ── Events ────────────────────────────────────────────────────────────────
const NativeEventCompose = lazy(() =>
  import("./workflows/NativeEventsWorkflow.jsx").then((m) => ({ default: m.NativeEventCompose }))
);
const NativeEventDetail = lazy(() =>
  import("./workflows/NativeEventsWorkflow.jsx").then((m) => ({ default: m.NativeEventDetail }))
);
const NativeTeamDetail = lazy(() =>
  import("./workflows/NativeTeamsWorkflow.jsx").then((m) => ({ default: m.NativeTeamDetail }))
);
const NativeMatchupDetail = lazy(() =>
  import("./workflows/NativeMatchupsWorkflow.jsx").then((m) => ({ default: m.NativeMatchupDetail }))
);

// ── Ads & Sponsors ──────────────────────────────────────────────────────────
const NativeAdDetail = lazy(() =>
  import("./workflows/NativeAdsWorkflow.jsx").then((m) => ({ default: m.NativeAdDetail }))
);
const NativeSponsorDetail = lazy(() =>
  import("./workflows/NativeSponsorsWorkflow.jsx").then((m) => ({ default: m.NativeSponsorDetail }))
);
const NativeCalendarDay = lazy(() =>
  import("./workflows/NativeCalendarWorkflow.jsx").then((m) => ({ default: m.NativeCalendarDay }))
);
const NativeRevenueSponsorDetail = lazy(() =>
  import("./workflows/NativeRevenueWorkflow.jsx").then((m) => ({ default: m.NativeRevenueSponsorDetail }))
);

const lazyScreen = (node) => <Suspense fallback={<NativeSkeleton className="mx-4 mt-6 h-72" />}>{node}</Suspense>;

/**
 * Native admin route tree (mounted behind RequireAdmin). Unlike the web —
 * where sub-tabs are component state and URLs stop at /admin/<section> —
 * every module here is addressable (/admin/store/orders), so notifications
 * and the overview queue can deep-link straight into the work. Detail and
 * compose screens are declared as more-specific routes above the generic
 * /admin/<section>/:module module screen; React Router ranks by specificity,
 * not declaration order, so the static/detail segments win their matches.
 */
export default function NativeAdminRoutes() {
  return (
    <Routes>
      <Route element={<NativeAdminShell />}>
        <Route index element={<NativeAdminOverview />} />
        <Route path="overview" element={<Navigate to="/admin" replace />} />

        <Route path="content" element={<NativeAdminSectionHub section="content" />} />
        <Route path="content/news/new" element={lazyScreen(<NativeNewsCompose />)} />
        <Route path="content/news/:articleId" element={lazyScreen(<NativeNewsDetail />)} />
        <Route path="content/travel/:packageId" element={lazyScreen(<NativeTravelPackageDetail />)} />
        <Route path="content/gallery/:itemId" element={lazyScreen(<NativeGalleryItemDetail />)} />
        <Route path="content/faqs/:faqId" element={lazyScreen(<NativeFaqDetail />)} />
        <Route path="content/partners/:partnerId" element={lazyScreen(<NativePartnerDetail />)} />
        <Route path="content/testimonials/:testimonialId" element={lazyScreen(<NativeTestimonialDetail />)} />
        <Route path="content/:module" element={<NativeAdminModuleScreen section="content" />} />

        <Route path="store" element={<NativeAdminSectionHub section="store" />} />
        <Route path="store/orders/:orderId" element={lazyScreen(<NativeOrderDetail />)} />
        <Route path="store/products/:productId" element={lazyScreen(<NativeProductDetail />)} />
        <Route path="store/:module" element={<NativeAdminModuleScreen section="store" />} />

        <Route path="community" element={<NativeAdminSectionHub section="community" />} />
        <Route path="community/:module" element={<NativeAdminModuleScreen section="community" />} />

        <Route path="more" element={<NativeAdminMoreScreen />} />
        <Route path="more/:module" element={<NativeAdminModuleScreen section="export" />} />

        <Route path="events" element={<NativeAdminSectionHub section="events" />} />
        <Route path="events/events/new" element={lazyScreen(<NativeEventCompose />)} />
        <Route path="events/events/:eventId" element={lazyScreen(<NativeEventDetail />)} />
        <Route path="events/teams/:teamName" element={lazyScreen(<NativeTeamDetail />)} />
        <Route path="events/matchups/:matchupId" element={lazyScreen(<NativeMatchupDetail />)} />
        <Route path="events/:module" element={<NativeAdminModuleScreen section="events" />} />

        <Route path="people" element={<NativeAdminSectionHub section="people" />} />
        <Route path="people/registrations/:regId" element={lazyScreen(<NativeRegistrationDetail />)} />
        <Route path="people/users/:userId" element={lazyScreen(<NativeUserDetail />)} />
        <Route path="people/bans/:banId" element={lazyScreen(<NativeBanDetail />)} />
        <Route path="people/:module" element={<NativeAdminModuleScreen section="people" />} />

        <Route path="ads" element={<NativeAdminSectionHub section="ads" />} />
        <Route path="ads/creatives/:adId" element={lazyScreen(<NativeAdDetail />)} />
        <Route path="ads/sponsors/:sponsorId" element={lazyScreen(<NativeSponsorDetail />)} />
        <Route path="ads/calendar/:date" element={lazyScreen(<NativeCalendarDay />)} />
        <Route path="ads/revenue/:sponsorId" element={lazyScreen(<NativeRevenueSponsorDetail />)} />
        <Route path="ads/:module" element={<NativeAdminModuleScreen section="ads" />} />

        <Route path="settings/:module" element={<NativeAdminModuleScreen section="settings" />} />
        <Route path="settings" element={<Navigate to="/admin/settings/settings" replace />} />

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
