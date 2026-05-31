import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, User as UserIcon, ShieldCheck, LogOut, ShoppingBag } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import NotificationBell from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AnimatePresence, motion } from "framer-motion";

const logoUrl = "https://media.base44.com/images/public/6a18d49a2b8f40f0f81cc26e/24c67d277_LASVEGAS.png";

const links = [
  { label: "Latest News", href: "/#news" },
  { label: "About Us", href: "/#about" },
  { label: "Travel Packages", href: "/#travel" },
  { label: "Events", href: "/#events" },
  { label: "Partners", href: "/#partners" },
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
  const [cartCount, setCartCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Sync cart count reactively
  useEffect(() => {
    const updateCount = () => {
      try {
        const stored = localStorage.getItem("rlt_cart");
        const items = stored ? JSON.parse(stored) : [];
        setCartCount(items.reduce((sum, item) => sum + item.quantity, 0));
      } catch {
        setCartCount(0);
      }
    };
    updateCount();
    window.addEventListener("rlt_cart_changed", updateCount);
    window.addEventListener("storage", updateCount);
    return () => {
      window.removeEventListener("rlt_cart_changed", updateCount);
      window.removeEventListener("storage", updateCount);
    };
  }, []);

  const isLinkActive = (href) => {
    if (href.startsWith("/#")) {
      const hash = href.substring(1);
      return location.pathname === "/" && location.hash === hash;
    }
    return location.pathname === href;
  };

  const AccountArea = () => {
    if (!isAuthenticated) {
      return (
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm" className="rounded-none text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild size="sm" className="rounded-none bg-primary text-xs font-bold uppercase tracking-wider hover:bg-primary/95 text-white shadow-[0_0_12px_rgba(249,115,22,0.25)]">
            <Link to="/register">Sign up</Link>
          </Button>
        </div>
      );
    }
    return (
      <div className="hidden md:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Open account menu" className="flex items-center gap-2 border border-border bg-card/20 px-2 py-1.5 transition-all hover:border-primary hover:shadow-[0_0_10px_rgba(249,115,22,0.15)]">
              <Avatar className="h-8 w-8 rounded-none border border-border/60">
                <AvatarImage src={user?.avatar_url} alt={user?.full_name || user?.email} className="object-cover" />
                <AvatarFallback className="rounded-none bg-secondary text-xs">{initials(user)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-xs font-bold uppercase tracking-wider text-muted-foreground xl:inline">Account</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-none bg-card cmd-glass border-border">
            <DropdownMenuLabel className="truncate text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {user?.full_name || user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem asChild className="rounded-none hover:bg-muted text-xs uppercase font-bold tracking-wider py-2.5">
              <Link to="/account"><UserIcon className="mr-2 h-4 w-4 text-primary" /> My Account</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-none hover:bg-muted text-xs uppercase font-bold tracking-wider py-2.5">
              <Link to="/store"><ShoppingBag className="mr-2 h-4 w-4 text-accent" /> Shop merch</Link>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem asChild className="rounded-none hover:bg-muted text-xs uppercase font-bold tracking-wider py-2.5">
                <Link to="/admin"><ShieldCheck className="mr-2 h-4 w-4 text-emerald-400" /> Admin dashboard</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem onClick={() => base44.auth.logout("/")} className="rounded-none hover:bg-muted text-xs uppercase font-bold tracking-wider py-2.5 text-destructive hover:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/95 border-b border-border/80 backdrop-blur-xl shadow-lg" : "bg-background/20 border-b border-border/10 backdrop-blur-md"}`}>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
        <Link to="/" className="block relative z-10 transition-transform duration-300 hover:scale-105">
          <img src={settings.site_logo_url || logoUrl} alt="Rugby League Takeover Las Vegas" className="h-14 w-14 object-contain md:h-16 md:w-16" />
        </Link>
        
        {/* Desktop Nav links with sliding indicator underlines */}
        <nav className="hidden items-center gap-8 lg:flex">
          {links.map((link) => {
            const active = isLinkActive(link.href);
            return (
              <Link 
                key={link.href} 
                to={link.href} 
                className={`relative text-xs font-bold uppercase tracking-[0.24em] py-2 transition-colors duration-300 ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <span>{link.label}</span>
                {active && (
                  <motion.span 
                    layoutId="activeNavLine"
                    className="absolute bottom-[-2px] left-0 right-0 h-[2px] bg-gradient-to-r from-primary to-accent pointer-events-none"
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
        
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button asChild variant="outline" size="sm" className="hidden rounded-none text-xs font-bold uppercase tracking-wider md:inline-flex bg-card/25 border-border">
              <Link to="/admin"><ShieldCheck className="mr-2 h-4 w-4 text-primary" /> Admin</Link>
            </Button>
          )}
          
          <NotificationBell />

          {/* Cart Status Badge */}
          <Link 
            to="/store" 
            className="relative flex h-9 w-9 items-center justify-center border border-border bg-card/30 hover:border-primary transition-all duration-300"
            aria-label="View shopping cart"
          >
            <ShoppingBag className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            <AnimatePresence>
              {cartCount > 0 && (
                <motion.span 
                  key={cartCount}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", stiffness: 450, damping: 15 }}
                  className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center bg-primary text-[8px] font-bold text-white rounded-none shadow-[0_0_8px_rgba(249,115,22,0.4)]"
                >
                  {cartCount}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          <AccountArea />
          
          <Button variant="ghost" size="icon" className="md:hidden border border-border" onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav Slide Drawer */}
      <AnimatePresence>
        {open && (
          <>
            {/* Dark blur backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 top-20 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />

            <motion.nav 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="fixed top-20 right-0 bottom-0 z-45 w-64 border-l border-border bg-background/95 cmd-glass px-6 py-8 md:hidden shadow-xl"
            >
              <div className="flex flex-col gap-6">
                {links.map((link) => (
                  <Link 
                    key={link.href} 
                    to={link.href} 
                    onClick={() => setOpen(false)} 
                    className="font-display text-2xl uppercase tracking-wider text-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
                
                <div className="mt-4 flex flex-col gap-4 border-t border-border pt-6">
                  {isAuthenticated ? (
                    <>
                      <Link to="/account" onClick={() => setOpen(false)} className="font-display text-2xl uppercase tracking-wider text-foreground hover:text-primary transition-colors">My Account</Link>
                      {isAdmin && <Link to="/admin" onClick={() => setOpen(false)} className="font-display text-2xl uppercase tracking-wider text-accent">Admin panel</Link>}
                      <button onClick={() => base44.auth.logout("/")} className="text-left font-display text-2xl uppercase tracking-wider text-destructive">Log out</button>
                    </>
                  ) : (
                    <>
                      <Link to="/login" onClick={() => setOpen(false)} className="font-display text-2xl uppercase tracking-wider text-foreground hover:text-primary transition-colors">Log in</Link>
                      <Link to="/register" onClick={() => setOpen(false)} className="font-display text-2xl uppercase tracking-wider text-primary">Sign up</Link>
                    </>
                  )}
                </div>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}