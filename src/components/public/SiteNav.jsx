import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X, User as UserIcon, ShieldCheck, LogOut, ShoppingBag } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import NotificationBell from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const logoUrl = "https://media.base44.com/images/public/6a18d49a2b8f40f0f81cc26e/390eddc5d_Untitled-31May2026at093306.png";

const links = [
  { label: "Latest News", href: "/#news" },
  { label: "About Us", href: "/#about" },
  { label: "Travel Packages", href: "/#travel" },
  { label: "Events", href: "/#events" },
  { label: "Merch", href: "/store" },
  { label: "Forum", href: "/forum" }
];

const initials = (user) => {
  const source = user?.full_name || user?.email || "?";
  return source.trim().slice(0, 2).toUpperCase();
};

export default function SiteNav({ settings = {} }) {
  const { isAuthenticated, isAdmin, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const AccountArea = () => {
    if (!isAuthenticated) {
      return (
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm" className="rounded-none text-xs font-bold uppercase tracking-wider"><Link to="/login">Log in</Link></Button>
          <Button asChild size="sm" className="rounded-none bg-primary text-xs font-bold uppercase tracking-wider hover:bg-primary/90"><Link to="/register">Sign up</Link></Button>
        </div>
      );
    }
    return (
      <div className="hidden md:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Open account menu" className="flex items-center gap-2 border border-border px-2 py-1.5 transition-colors hover:border-primary">
              <Avatar className="h-8 w-8 rounded-none">
                <AvatarImage src={user?.avatar_url} alt={user?.full_name || user?.email} />
                <AvatarFallback className="rounded-none bg-secondary text-xs">{initials(user)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-xs font-bold uppercase tracking-wider text-muted-foreground xl:inline">Account</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-none">
            <DropdownMenuLabel className="truncate">{user?.full_name || user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link to="/account"><UserIcon className="mr-2 h-4 w-4" /> My Account</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/store"><ShoppingBag className="mr-2 h-4 w-4" /> Shop merch</Link></DropdownMenuItem>
            {isAdmin && <DropdownMenuItem asChild><Link to="/admin"><ShieldCheck className="mr-2 h-4 w-4" /> Admin dashboard</Link></DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => base44.auth.logout("/")}><LogOut className="mr-2 h-4 w-4" /> Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/95 border-b border-border backdrop-blur-xl" : "bg-background/40 border-b border-border/10 backdrop-blur-md"}`}>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
        <Link to="/" className="block">
          <img src={settings.site_logo_url || logoUrl} alt="Rugby League Takeover Las Vegas" className="h-14 w-14 object-contain md:h-16 md:w-16" />
        </Link>
        <nav className="hidden items-center gap-8 lg:flex">
          {links.map((link) => (
            <Link key={link.href} to={link.href} className="group relative text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
              <span className="absolute -bottom-2 left-0 h-px w-0 bg-primary transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button asChild variant="outline" size="sm" className="hidden rounded-none text-xs font-bold uppercase tracking-wider md:inline-flex">
              <Link to="/admin"><ShieldCheck className="mr-2 h-4 w-4" /> Admin</Link>
            </Button>
          )}
          <NotificationBell />
          <AccountArea />
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-border bg-background px-5 py-6 md:hidden">
          <div className="grid gap-5">
            {links.map((link) => (
              <Link key={link.href} to={link.href} onClick={() => setOpen(false)} className="font-display text-2xl uppercase tracking-wide text-foreground">
                {link.label}
              </Link>
            ))}
            <div className="mt-2 grid gap-3 border-t border-border pt-5">
              {isAuthenticated ? (
                <>
                  <Link to="/account" onClick={() => setOpen(false)} className="font-display text-2xl uppercase tracking-wide text-foreground">My Account</Link>
                  {isAdmin && <Link to="/admin" onClick={() => setOpen(false)} className="font-display text-2xl uppercase tracking-wide text-foreground">Admin</Link>}
                  <button onClick={() => base44.auth.logout("/")} className="text-left font-display text-2xl uppercase tracking-wide text-muted-foreground">Log out</button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="font-display text-2xl uppercase tracking-wide text-foreground">Log in</Link>
                  <Link to="/register" onClick={() => setOpen(false)} className="font-display text-2xl uppercase tracking-wide text-primary">Sign up</Link>
                </>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
