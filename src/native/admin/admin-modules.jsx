/**
 * Native admin module registry. Every one of the 19 admin modules now renders
 * as a true native iOS workflow (003G/003K pattern) — self-chromed, shipping
 * its own top bar and layout. The original web managers are retained as
 * Classic<X>Module named exports (with their exact original data wiring and
 * query keys) so any capability gap has a working escape hatch. Managers are
 * lazy so admin code stays out of fan-path chunks.
 */
import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { NativeSkeleton } from "../components/NativePrimitives.jsx";

// ── Original web managers (retained for Classic escape hatches) ───────────
const NewsManager = lazy(() => import("@/components/admin/NewsManager"));
const TravelPackagesManager = lazy(() => import("@/components/admin/TravelPackagesManager"));
const GalleryManager = lazy(() => import("@/components/admin/GalleryManager"));
const FaqManager = lazy(() => import("@/components/admin/FaqManager"));
const PartnersManager = lazy(() => import("@/components/admin/PartnersManager"));
const TestimonialsManager = lazy(() => import("@/components/admin/TestimonialsManager"));
const ProductsManager = lazy(() => import("@/components/admin/ProductsManager"));
const OrdersManager = lazy(() => import("@/components/admin/OrdersManager"));
const ForumManager = lazy(() => import("@/components/admin/ForumManager"));
const UsersManager = lazy(() => import("@/components/admin/UsersManager"));
const RegistrationsTable = lazy(() => import("@/components/admin/RegistrationsTable"));
const UserInviteManager = lazy(() => import("@/components/admin/UserInviteManager"));
const BansManager = lazy(() => import("@/components/admin/BansManager"));
const EventsManager = lazy(() => import("@/components/admin/EventsManager"));
const TeamsManager = lazy(() => import("@/components/admin/TeamsManager"));
const MatchupsManager = lazy(() => import("@/components/admin/MatchupsManager"));
const SiteSettingsManager = lazy(() => import("@/components/admin/SiteSettingsManager"));
const AdsManager = lazy(() => import("@/components/admin/AdsManager"));
const SponsorManager = lazy(() => import("@/components/admin/SponsorManager"));
const CampaignCalendar = lazy(() => import("@/components/admin/CampaignCalendar"));
const AdRevenueTracker = lazy(() => import("@/components/admin/AdRevenueTracker"));
const DataExporter = lazy(() => import("@/components/admin/DataExporter"));

// ── True native workflows (003G/003K) — these ship their own top bar/chrome.
const NativeNewsList = lazy(() => import("./workflows/NativeNewsWorkflow.jsx"));
const NativeTravelList = lazy(() => import("./workflows/NativeTravelWorkflow.jsx"));
const NativeGalleryList = lazy(() => import("./workflows/NativeGalleryWorkflow.jsx"));
const NativeFaqsList = lazy(() => import("./workflows/NativeFaqsWorkflow.jsx"));
const NativePartnersList = lazy(() => import("./workflows/NativePartnersWorkflow.jsx"));
const NativeTestimonialsList = lazy(() => import("./workflows/NativeTestimonialsWorkflow.jsx"));
const NativeProductsList = lazy(() => import("./workflows/NativeProductsWorkflow.jsx"));
const NativeOrdersList = lazy(() => import("./workflows/NativeOrdersWorkflow.jsx"));
const NativeModerationQueue = lazy(() => import("./workflows/NativeModerationWorkflow.jsx"));
const NativeUsersList = lazy(() => import("./workflows/NativeUsersWorkflow.jsx"));
const NativeRegistrationsList = lazy(() => import("./workflows/NativeRegistrationsWorkflow.jsx"));
const NativeInvitesWorkflow = lazy(() => import("./workflows/NativeInvitesWorkflow.jsx"));
const NativeBansList = lazy(() => import("./workflows/NativeBansWorkflow.jsx"));
const NativeEventsList = lazy(() => import("./workflows/NativeEventsWorkflow.jsx"));
const NativeTeamsList = lazy(() => import("./workflows/NativeTeamsWorkflow.jsx"));
const NativeMatchupsList = lazy(() => import("./workflows/NativeMatchupsWorkflow.jsx"));
const NativeSettingsWorkflow = lazy(() => import("./workflows/NativeSettingsWorkflow.jsx"));
const NativeAdsWorkflow = lazy(() => import("./workflows/NativeAdsWorkflow.jsx"));
const NativeSponsorsList = lazy(() => import("./workflows/NativeSponsorsWorkflow.jsx"));
const NativeCalendarWorkflow = lazy(() => import("./workflows/NativeCalendarWorkflow.jsx"));
const NativeRevenueList = lazy(() => import("./workflows/NativeRevenueWorkflow.jsx"));
const NativeExportWorkflow = lazy(() => import("./workflows/NativeExportWorkflow.jsx"));

const Fallback = () => <NativeSkeleton className="h-72 w-full" />;
const wrap = (node) => <Suspense fallback={<Fallback />}>{node}</Suspense>;

const readLS = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

// ── Native module renderers (self-chromed; Suspense-wrapped) ──────────────
function NewsModule() { return wrap(<NativeNewsList />); }
function TravelModule() { return wrap(<NativeTravelList />); }
function GalleryModule() { return wrap(<NativeGalleryList />); }
function FaqsModule() { return wrap(<NativeFaqsList />); }
function PartnersModule() { return wrap(<NativePartnersList />); }
function TestimonialsModule() { return wrap(<NativeTestimonialsList />); }
function ProductsModule() { return wrap(<NativeProductsList />); }
function OrdersModule() { return wrap(<NativeOrdersList />); }
function ForumModule() { return wrap(<NativeModerationQueue />); }
function UsersModule() { return wrap(<NativeUsersList />); }
function RegistrationsModule() { return wrap(<NativeRegistrationsList />); }
function InvitesModule() { return wrap(<NativeInvitesWorkflow />); }
function BansModule() { return wrap(<NativeBansList />); }
function EventsModule() { return wrap(<NativeEventsList />); }
function TeamsModule() { return wrap(<NativeTeamsList />); }
function MatchupsModule() { return wrap(<NativeMatchupsList />); }
function SettingsModule() { return wrap(<NativeSettingsWorkflow />); }
function AdsModule() { return wrap(<NativeAdsWorkflow />); }
function SponsorsModule() { return wrap(<NativeSponsorsList />); }
function CalendarModule() { return wrap(<NativeCalendarWorkflow />); }
function RevenueModule() { return wrap(<NativeRevenueList />); }
function ExportModule() { return wrap(<NativeExportWorkflow />); }

// ── Classic web-manager escape hatches (original data wiring; same keys) ───
export function ClassicNewsModule() {
  const { data: news = [] } = useQuery({ queryKey: ["news"], queryFn: () => base44.entities.NewsArticle.list("-published_date", 50) });
  return wrap(<NewsManager articles={news} />);
}
export function ClassicTravelModule() {
  const { data: packages = [] } = useQuery({ queryKey: ["packages"], queryFn: () => base44.entities.TravelPackage.list("sort_order", 200) });
  return wrap(<TravelPackagesManager packages={packages} />);
}
export function ClassicGalleryModule() {
  const { data: gallery = [] } = useQuery({ queryKey: ["gallery"], queryFn: () => base44.entities.GalleryItem.list("sort_order", 200), retry: false, meta: { silent: true } });
  return wrap(<GalleryManager items={gallery} />);
}
export function ClassicFaqsModule() {
  const { data: faqs = [] } = useQuery({ queryKey: ["faqs"], queryFn: () => base44.entities.Faq.list("sort_order", 200), retry: false, meta: { silent: true } });
  return wrap(<FaqManager faqs={faqs} />);
}
export function ClassicPartnersModule() {
  const { data: partners = [] } = useQuery({ queryKey: ["partners"], queryFn: () => base44.entities.Partner.list("sort_order", 200), retry: false, meta: { silent: true } });
  return wrap(<PartnersManager partners={partners} />);
}
export function ClassicTestimonialsModule() {
  const { data: testimonials = [] } = useQuery({ queryKey: ["testimonials"], queryFn: () => base44.entities.Testimonial.list("sort_order", 200), retry: false, meta: { silent: true } });
  return wrap(<TestimonialsManager testimonials={testimonials} />);
}
export function ClassicProductsModule() {
  const { data: products = [], isLoading } = useQuery({ queryKey: ["products"], queryFn: () => base44.entities.Product.list("sort_order", 200) });
  return wrap(<ProductsManager products={products} loading={isLoading} />);
}
export function ClassicOrdersModule() {
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: () => base44.entities.StoreOrder.list("-created_date", 200) });
  return wrap(<OrdersManager orders={orders} />);
}
export function ClassicForumModule() {
  const { data: forumPosts = [] } = useQuery({ queryKey: ["forumPosts"], queryFn: () => base44.entities.ForumPost.list("-created_date", 200) });
  return wrap(<ForumManager posts={forumPosts} />);
}
export function ClassicUsersModule() {
  return wrap(<UsersManager />);
}
export function ClassicRegistrationsModule() {
  const { data: registrations = [] } = useQuery({ queryKey: ["registrations"], queryFn: () => base44.entities.InterestRegistration.list("-created_date", 200) });
  return wrap(<RegistrationsTable registrations={registrations} />);
}
export function ClassicInvitesModule() {
  return wrap(<UserInviteManager />);
}
export function ClassicBansModule() {
  return wrap(<BansManager />);
}
export function ClassicEventsModule() {
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.EventContent.list("sort_order", 100) });
  return wrap(<EventsManager events={events} />);
}
export function ClassicTeamsModule() {
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list("sort_order", 100), retry: false, meta: { silent: true } });
  return wrap(<TeamsManager teams={teams} />);
}
export function ClassicMatchupsModule() {
  const { data: matchups = [] } = useQuery({ queryKey: ["matchups"], queryFn: () => base44.entities.Matchup.list("sort_order", 100), retry: false, meta: { silent: true } });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list("sort_order", 100), retry: false, meta: { silent: true } });
  return wrap(<MatchupsManager matchups={matchups} teams={teams} />);
}
export function ClassicSettingsModule() {
  const { data: settingsRecords = [] } = useQuery({ queryKey: ["siteSettings"], queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1) });
  return wrap(<SiteSettingsManager settings={settingsRecords[0]} />);
}
export function ClassicAdsModule() {
  return wrap(<AdsManager />);
}
export function ClassicSponsorsModule() {
  return wrap(<SponsorManager />);
}
export function ClassicCalendarModule() {
  return wrap(<CampaignCalendar ads={readLS("rlt_ad_config", [])} sponsors={readLS("rlt_sponsors", [])} />);
}
export function ClassicRevenueModule() {
  return wrap(<AdRevenueTracker ads={readLS("rlt_ad_config", [])} sponsors={readLS("rlt_sponsors", [])} stats={readLS("rlt_ad_stats", {})} />);
}
export function ClassicExportModule() {
  const { data: registrations = [] } = useQuery({ queryKey: ["registrations"], queryFn: () => base44.entities.InterestRegistration.list("-created_date", 200) });
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: () => base44.entities.StoreOrder.list("-created_date", 200) });
  const { data: forumPosts = [] } = useQuery({ queryKey: ["forumPosts"], queryFn: () => base44.entities.ForumPost.list("-created_date", 200) });
  return wrap(<DataExporter registrations={registrations} orders={orders} forumPosts={forumPosts} />);
}

export const ADMIN_MODULES = {
  news: { title: "News Articles", detail: "Write and publish news", icon: "newspaper", Component: NewsModule, selfChrome: true },
  travel: { title: "Travel Packages", detail: "Vegas trip packages", icon: "plane", Component: TravelModule, selfChrome: true },
  gallery: { title: "Gallery", detail: "Photos and videos", icon: "image", Component: GalleryModule, selfChrome: true },
  faqs: { title: "FAQs", detail: "Questions and answers", icon: "help-circle", Component: FaqsModule, selfChrome: true },
  partners: { title: "Partners", detail: "Partner logos and links", icon: "handshake", Component: PartnersModule, selfChrome: true },
  testimonials: { title: "Testimonials", detail: "Fan quotes, publish queue", icon: "quote", Component: TestimonialsModule, selfChrome: true },
  products: { title: "Products", detail: "Merch, pricing and stock", icon: "package", Component: ProductsModule, selfChrome: true },
  orders: { title: "Orders", detail: "Fulfilment and tracking", icon: "shopping-bag", Component: OrdersModule, selfChrome: true },
  forum: { title: "Forum Moderation", detail: "Pending, reported, removed", icon: "message-square", Component: ForumModule, selfChrome: true },
  users: { title: "User Accounts", detail: "Roles and access", icon: "users", Component: UsersModule, selfChrome: true },
  registrations: { title: "Registrations", detail: "Trip interest signups", icon: "user-check", Component: RegistrationsModule, selfChrome: true },
  invites: { title: "Invites", detail: "Invitations and handover", icon: "user-plus", Component: InvitesModule, selfChrome: true },
  bans: { title: "Bans", detail: "Email, IP and user blocks", icon: "ban", Component: BansModule, selfChrome: true },
  events: { title: "Events", detail: "Event content and tickets", icon: "calendar-days", Component: EventsModule, selfChrome: true },
  teams: { title: "Teams", detail: "Clubs and crests", icon: "shield", Component: TeamsModule, selfChrome: true },
  matchups: { title: "Matchups", detail: "Fixtures and results", icon: "swords", Component: MatchupsModule, selfChrome: true },
  settings: { title: "Site Settings", detail: "Brand, hero, countdown, shipping", icon: "settings", Component: SettingsModule, selfChrome: true },
  ads: { title: "Ad Manager", detail: "Slots and creatives", icon: "megaphone", Component: AdsModule, selfChrome: true },
  sponsors: { title: "Sponsors", detail: "Sponsor profiles", icon: "building-2", Component: SponsorsModule, selfChrome: true },
  calendar: { title: "Campaign Calendar", detail: "Campaign timeline", icon: "calendar-range", Component: CalendarModule, selfChrome: true },
  revenue: { title: "Ad Revenue", detail: "Reports and tracking", icon: "dollar-sign", Component: RevenueModule, selfChrome: true },
  export: { title: "Export Data", detail: "CSV downloads", icon: "download", Component: ExportModule, selfChrome: true },
};
