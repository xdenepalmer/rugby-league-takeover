import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { LayoutDashboard, FileText, CalendarDays, ShoppingBag, MessagesSquare, Users, Settings, ExternalLink, LogOut, Menu, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/admin/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/content", label: "Content", icon: FileText },
  { to: "/admin/events", label: "Events", icon: CalendarDays },
  { to: "/admin/store", label: "Store", icon: ShoppingBag },
  { to: "/admin/community", label: "Community", icon: MessagesSquare },
  { to: "/admin/people", label: "People", icon: Users },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavList = () => (
    <nav className="grid gap-1">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 border-l-2 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
              isActive
                ? "border-primary bg-primary/10 text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`
          }
        >
          <Icon className="h-4 w-4" /> {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-border bg-secondary px-5 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-none lg:hidden" onClick={() => setMobileOpen((v) => !v)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Admin Dashboard</p>
            <h1 className="font-display text-2xl uppercase leading-none md:text-3xl">Rugby League Takeover</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground md:block">{user?.email}</span>
          <Button asChild variant="outline" size="sm" className="rounded-none"><Link to="/"><ExternalLink className="mr-2 h-4 w-4" /> View site</Link></Button>
          <Button variant="ghost" size="sm" className="rounded-none" onClick={() => base44.auth.logout("/")}><LogOut className="mr-2 h-4 w-4" /> Log out</Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-card/40 py-6 lg:block">
          <div className="sticky top-24"><NavList /></div>
        </aside>

        {mobileOpen && (
          <div className="absolute inset-x-0 z-30 border-b border-border bg-card py-4 lg:hidden"><NavList /></div>
        )}

        <main className="min-w-0 flex-1 px-5 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
