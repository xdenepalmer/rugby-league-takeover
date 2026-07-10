/**
 * Native admin module registry: every manager the web admin ships, wrapped
 * with the SAME data wiring its panel uses (identical query keys, fetch
 * shapes and props), rendered full-screen behind a native top bar. Managers
 * are lazy so admin code stays out of fan-path chunks.
 */
import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { NativeSkeleton } from "../components/NativePrimitives.jsx";

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

// True native workflows (003G) — these ship their own top bar/chrome.
const NativeOrdersList = lazy(() => import("./workflows/NativeOrdersWorkflow.jsx"));
const NativeModerationQueue = lazy(() => import("./workflows/NativeModerationWorkflow.jsx"));
const NativeRegistrationsList = lazy(() => import("./workflows/NativeRegistrationsWorkflow.jsx"));

const Fallback = () => <NativeSkeleton className="h-72 w-full" />;
const wrap = (node) => <Suspense fallback={<Fallback />}>{node}</Suspense>;

const readLS = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

// ── Data-wired wrappers (mirror the panels' queries exactly) ─────────────
function NewsModule() {
  const { data: news = [] } = useQuery({ queryKey: ["news"], queryFn: () => base44.entities.NewsArticle.list("-published_date", 50) });
  return wrap(<NewsManager articles={news} />);
}
function TravelModule() {
  const { data: packages = [] } = useQuery({ queryKey: ["packages"], queryFn: () => base44.entities.TravelPackage.list("sort_order", 200) });
  return wrap(<TravelPackagesManager packages={packages} />);
}
function GalleryModule() {
  const { data: gallery = [] } = useQuery({ queryKey: ["gallery"], queryFn: () => base44.entities.GalleryItem.list("sort_order", 200), retry: false, meta: { silent: true } });
  return wrap(<GalleryManager items={gallery} />);
}
function FaqsModule() {
  const { data: faqs = [] } = useQuery({ queryKey: ["faqs"], queryFn: () => base44.entities.Faq.list("sort_order", 200), retry: false, meta: { silent: true } });
  return wrap(<FaqManager faqs={faqs} />);
}
function PartnersModule() {
  const { data: partners = [] } = useQuery({ queryKey: ["partners"], queryFn: () => base44.entities.Partner.list("sort_order", 200), retry: false, meta: { silent: true } });
  return wrap(<PartnersManager partners={partners} />);
}
function TestimonialsModule() {
  const { data: testimonials = [] } = useQuery({ queryKey: ["testimonials"], queryFn: () => base44.entities.Testimonial.list("sort_order", 200), retry: false, meta: { silent: true } });
  return wrap(<TestimonialsManager testimonials={testimonials} />);
}
function ProductsModule() {
  const { data: products = [], isLoading } = useQuery({ queryKey: ["products"], queryFn: () => base44.entities.Product.list("sort_order", 200) });
  return wrap(<ProductsManager products={products} loading={isLoading} />);
}
function OrdersModule() {
  return wrap(<NativeOrdersList />);
}
function ForumModule() {
  return wrap(<NativeModerationQueue />);
}
/** Classic web managers, retained for capability escape hatches. */
export function ClassicOrdersModule() {
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: () => base44.entities.StoreOrder.list("-created_date", 200) });
  return wrap(<OrdersManager orders={orders} />);
}
export function ClassicForumModule() {
  const { data: forumPosts = [] } = useQuery({ queryKey: ["forumPosts"], queryFn: () => base44.entities.ForumPost.list("-created_date", 200) });
  return wrap(<ForumManager posts={forumPosts} />);
}
function UsersModule() {
  return wrap(<UsersManager />);
}
function RegistrationsModule() {
  return wrap(<NativeRegistrationsList />);
}
export function ClassicRegistrationsModule() {
  const { data: registrations = [] } = useQuery({ queryKey: ["registrations"], queryFn: () => base44.entities.InterestRegistration.list("-created_date", 200) });
  return wrap(<RegistrationsTable registrations={registrations} />);
}
function InvitesModule() {
  return wrap(<UserInviteManager />);
}
function BansModule() {
  return wrap(<BansManager />);
}
function EventsModule() {
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.EventContent.list("sort_order", 100) });
  return wrap(<EventsManager events={events} />);
}
function TeamsModule() {
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list("sort_order", 100), retry: false, meta: { silent: true } });
  return wrap(<TeamsManager teams={teams} />);
}
function MatchupsModule() {
  const { data: matchups = [] } = useQuery({ queryKey: ["matchups"], queryFn: () => base44.entities.Matchup.list("sort_order", 100), retry: false, meta: { silent: true } });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list("sort_order", 100), retry: false, meta: { silent: true } });
  return wrap(<MatchupsManager matchups={matchups} teams={teams} />);
}
function SettingsModule() {
  const { data: settingsRecords = [] } = useQuery({ queryKey: ["siteSettings"], queryFn: () => base44.entities.SiteSettings.list("-updated_date", 1) });
  return wrap(<SiteSettingsManager settings={settingsRecords[0]} />);
}
function AdsModule() {
  return wrap(<AdsManager />);
}
function SponsorsModule() {
  return wrap(<SponsorManager />);
}
function CalendarModule() {
  return wrap(<CampaignCalendar ads={readLS("rlt_ad_config", [])} sponsors={readLS("rlt_sponsors", [])} />);
}
function RevenueModule() {
  return wrap(<AdRevenueTracker ads={readLS("rlt_ad_config", [])} sponsors={readLS("rlt_sponsors", [])} stats={readLS("rlt_ad_stats", {})} />);
}
function ExportModule() {
  const { data: registrations = [] } = useQuery({ queryKey: ["registrations"], queryFn: () => base44.entities.InterestRegistration.list("-created_date", 200) });
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: () => base44.entities.StoreOrder.list("-created_date", 200) });
  const { data: forumPosts = [] } = useQuery({ queryKey: ["forumPosts"], queryFn: () => base44.entities.ForumPost.list("-created_date", 200) });
  return wrap(<DataExporter registrations={registrations} orders={orders} forumPosts={forumPosts} />);
}

export const ADMIN_MODULES = {
  news: { title: "News Articles", detail: "Write and publish news", icon: "newspaper", Component: NewsModule },
  travel: { title: "Travel Packages", detail: "Vegas trip packages", icon: "plane", Component: TravelModule },
  gallery: { title: "Gallery", detail: "Photos and videos", icon: "image", Component: GalleryModule },
  faqs: { title: "FAQs", detail: "Questions and answers", icon: "help-circle", Component: FaqsModule },
  partners: { title: "Partners", detail: "Partner logos and links", icon: "handshake", Component: PartnersModule },
  testimonials: { title: "Testimonials", detail: "Fan quotes, publish queue", icon: "quote", Component: TestimonialsModule },
  products: { title: "Products", detail: "Merch, pricing and stock", icon: "package", Component: ProductsModule },
  orders: { title: "Orders", detail: "Fulfilment and tracking", icon: "shopping-bag", Component: OrdersModule, selfChrome: true },
  forum: { title: "Forum Moderation", detail: "Pending, reported, removed", icon: "message-square", Component: ForumModule, selfChrome: true },
  users: { title: "User Accounts", detail: "Roles and access", icon: "users", Component: UsersModule },
  registrations: { title: "Registrations", detail: "Trip interest signups", icon: "user-check", Component: RegistrationsModule, selfChrome: true },
  invites: { title: "Invites", detail: "Invitations and handover", icon: "user-plus", Component: InvitesModule },
  bans: { title: "Bans", detail: "Email, IP and user blocks", icon: "ban", Component: BansModule },
  events: { title: "Events", detail: "Event content and tickets", icon: "calendar-days", Component: EventsModule },
  teams: { title: "Teams", detail: "Clubs and crests", icon: "shield", Component: TeamsModule },
  matchups: { title: "Matchups", detail: "Fixtures and results", icon: "swords", Component: MatchupsModule },
  settings: { title: "Site Settings", detail: "Brand, hero, countdown, shipping", icon: "settings", Component: SettingsModule },
  ads: { title: "Ad Manager", detail: "Slots and creatives", icon: "megaphone", Component: AdsModule },
  sponsors: { title: "Sponsors", detail: "Sponsor profiles", icon: "building-2", Component: SponsorsModule },
  calendar: { title: "Campaign Calendar", detail: "Campaign timeline", icon: "calendar-range", Component: CalendarModule },
  revenue: { title: "Ad Revenue", detail: "Reports and tracking", icon: "dollar-sign", Component: RevenueModule },
  export: { title: "Export Data", detail: "CSV downloads", icon: "download", Component: ExportModule },
};
