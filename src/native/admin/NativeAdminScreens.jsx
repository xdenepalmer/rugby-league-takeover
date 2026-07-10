import { useNavigate, useParams, Navigate } from "react-router-dom";
import {
  Newspaper,
  Plane,
  Image,
  HelpCircle,
  Handshake,
  Quote,
  Package,
  ShoppingBag,
  MessageSquare,
  Users,
  UserCheck,
  UserPlus,
  Ban,
  CalendarDays,
  Shield,
  Swords,
  Settings,
  Megaphone,
  Building2,
  CalendarRange,
  DollarSign,
  Download,
  Undo2,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { emitHaptic } from "@/lib/native/haptic-events";
import NativeTopBar from "../components/NativeTopBar.jsx";
import { NativeListRow } from "../components/NativePrimitives.jsx";
import { ADMIN_SECTION_MODULES, NATIVE_ADMIN_MORE_ITEMS } from "./admin-nav.js";
import { ADMIN_MODULES } from "./admin-modules.jsx";

const MODULE_ICONS = {
  newspaper: Newspaper,
  plane: Plane,
  image: Image,
  "help-circle": HelpCircle,
  handshake: Handshake,
  quote: Quote,
  package: Package,
  "shopping-bag": ShoppingBag,
  "message-square": MessageSquare,
  users: Users,
  "user-check": UserCheck,
  "user-plus": UserPlus,
  ban: Ban,
  "calendar-days": CalendarDays,
  shield: Shield,
  swords: Swords,
  settings: Settings,
  megaphone: Megaphone,
  "building-2": Building2,
  "calendar-range": CalendarRange,
  "dollar-sign": DollarSign,
  download: Download,
  "undo-2": Undo2,
  "log-out": LogOut,
};

const SECTION_TITLES = {
  content: "Content",
  store: "Store",
  community: "Community",
  events: "Events",
  people: "People",
  ads: "Ads & Sponsors",
  settings: "Settings",
  more: "More",
};

/** Hub screen: the modules of one admin section as a native list. */
export function NativeAdminSectionHub({ section }) {
  const navigate = useNavigate();
  const moduleIds = ADMIN_SECTION_MODULES[section] || [];
  return (
    <div className="pt-4">
      <header className="px-4 pb-3">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400">Admin</p>
        <h1 className="font-display text-2xl font-bold uppercase tracking-widest">{SECTION_TITLES[section]}</h1>
      </header>
      <div className="border-t border-border/40">
        {moduleIds.map((id) => {
          const module = ADMIN_MODULES[id];
          if (!module) return null;
          return (
            <NativeListRow
              key={id}
              icon={MODULE_ICONS[module.icon]}
              label={module.title}
              detail={module.detail}
              onClick={() => {
                emitHaptic("tab.select");
                navigate(`/admin/${section}/${id}`);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Module screen: one manager, full-screen, behind a native top bar. */
export function NativeAdminModuleScreen({ section }) {
  const { module: moduleId } = useParams();
  // The export module lives under the More tab rather than its own hub.
  const hubPath = section === "export" ? "/admin/more" : `/admin/${section}`;
  const allowed = (ADMIN_SECTION_MODULES[section] || []).includes(moduleId);
  const module = allowed ? ADMIN_MODULES[moduleId] : null;
  if (!module) return <Navigate to={hubPath} replace />;
  const { title, Component } = module;
  return (
    <div>
      <NativeTopBar title={title} fallback={hubPath} />
      <div className="px-3 py-4">
        <Component />
      </div>
    </div>
  );
}

/** The More tab: secondary sections + app-level actions. */
export function NativeAdminMoreScreen() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return (
    <div className="pt-4">
      <header className="px-4 pb-3">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400">Admin</p>
        <h1 className="font-display text-2xl font-bold uppercase tracking-widest">More</h1>
      </header>
      <div className="border-t border-border/40">
        {NATIVE_ADMIN_MORE_ITEMS.map((item) => (
          <NativeListRow
            key={item.id}
            icon={MODULE_ICONS[item.icon]}
            label={item.label}
            detail={item.detail}
            tone={item.id === "signout" ? "danger" : "default"}
            onClick={() => {
              if (item.action === "return") {
                emitHaptic("nav.back");
                navigate("/");
              } else if (item.action === "signout") {
                emitHaptic("mutation.warning");
                logout();
              } else {
                emitHaptic("tab.select");
                navigate(item.to);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
