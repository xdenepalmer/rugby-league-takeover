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
          <Button asChild variant="ghost" size="sm" className="rounded-none text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-transparent transition-all">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild size="sm" className="rounded-none bg-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/95 text-white shadow-[0_0_12px_rgba(249,115,22,0.3)] hover:shadow-[0_0_18px_rgba(249,115,22,0.5)] transition-all">
            <Link to="/register">Sign up</Link>
          </Button>
        </div>
      );
    }
    return (
      <div className="hidden md:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              aria-label="Open account menu" 
              className="group flex items-center gap-2 border border-border bg-secondary/40 px-2.5 py-1.5 transition-all duration-300 hover:border-primary hover:shadow-[0_0_12px_rgba(249,115,22,0.2)]"
            >
              <Avatar className="h-7 w-7 rounded-none border border-border/60 transition-all duration-300 group-hover:border-primary/50 group-hover:scale-105">
                <AvatarImage src={user?.avatar_url} alt={user?.full_name || user?.email} className="object-cover" />
                <AvatarFallback className="rounded-none bg-muted text-xs font-mono font-bold text-primary">{initials(user)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-[10px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors xl:inline">Account</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-none bg-background/95 border-border cmd-glass shadow-2xl p-1">
            <DropdownMenuLabel className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3.5 py-3">
              {user?.full_name || user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem asChild className="rounded-none hover:bg-secondary/80 text-[10px] uppercase font-bold tracking-wider py-3 px-3.5 cursor-pointer text-muted-foreground hover:text-foreground">
              <Link to="/account"><UserIcon className="mr-2.5 h-4 w-4 text-primary" /> My Account</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-none hover:bg-secondary/80 text-[10px] uppercase font-bold tracking-wider py-3 px-3.5 cursor-pointer text-muted-foreground hover:text-foreground">
              <Link to="/store"><ShoppingBag className="mr-2.5 h-4 w-4 text-accent" /> Shop merch</Link>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem asChild className="rounded-none hover:bg-secondary/80 text-[10px] uppercase font-bold tracking-wider py-3 px-3.5 cursor-pointer text-muted-foreground hover:text-foreground">
                <Link to="/admin"><ShieldCheck className="mr-2.5 h-4 w-4 text-emerald-400" /> Admin dashboard</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem onClick={() => base44.auth.logout("/")} className="rounded-none hover:bg-secondary/80 text-[10px] uppercase font-bold tracking-wider py-3 px-3.5 cursor-pointer text-destructive hover:text-destructive">
              <LogOut className="mr-2.5 h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  // Mobile menu slide animation presets
  const drawerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { x: 30, opacity: 0 },
    show: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 25 } }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full pointer-events-none transition-all duration-500 pt-0">
      <div 
        className={`pointer-events-auto mx-auto flex items-center justify-between transition-all duration-500 ${
          scrolled 
            ? "mt-4 max-w-6xl border border-primary/30 bg-background/80 backdrop-blur-xl shadow-[0_4px_30px_rgba(3,5,18,0.4),0_0_20px_rgba(249,115,22,0.15)] h-16 px-6" 
            : "max-w-7xl border-b border-border/10 bg-background/20 backdrop-blur-md h-20 px-5 md:px-8"
        }`}
      >
        <Link 
          to="/" 
          className="group relative z-10 overflow-hidden block transition-transform duration-300 hover:scale-105"
        >
          <img 
            src={settings.site_logo_url || logoUrl} 
            alt="Rugby League Takeover Las Vegas" 
            className="h-12 w-12 object-contain md:h-14 md:w-14" 
          />
          {/* Glass glare sweep overlay */}
          <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-25deg] -translate-x-[150%] transition-transform duration-1000 group-hover:translate-x-[250%] pointer-events-none" />
        </Link>
        
        {/* Desktop Nav links with HUD bracket hover and glowing indicator */}
        <nav className="hidden items-center gap-6 lg:flex">
          {links.map((link) => {
            const active = isLinkActive(link.href);
            return (
              <Link 
                key={link.href} 
                to={link.href} 
                className={`group relative py-2 font-display text-[10.5px] font-bold uppercase tracking-[0.25em] transition-all duration-300 ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="relative z-10 flex items-center">
                  <span className="opacity-0 -translate-x-1 text-primary transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 mr-1 text-[8px] font-mono">[</span>
                  {link.label}
                  <span className="opacity-0 translate-x-1 text-primary transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 ml-1 text-[8px] font-mono">]</span>
                </span>
                {active ? (
                  <motion.span 
                    layoutId="activeNavLine"
                    className="absolute bottom-[-2px] left-0 right-0 h-[2.5px] bg-gradient-to-r from-primary via-accent to-primary pointer-events-none shadow-[0_0_12px_rgba(249,115,22,0.8)]"
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  />
                ) : (
                  <span className="absolute bottom-[-2px] left-0 right-0 h-[1.5px] w-0 bg-primary/40 transition-all duration-300 group-hover:w-full" />
                )}
              </Link>
            );
          })}
        </nav>
        
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button asChild variant="outline" size="sm" className="hidden rounded-none text-[10px] font-bold uppercase tracking-wider md:inline-flex bg-secondary/40 border-primary/30 text-emerald-400 hover:border-emerald-500 hover:bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.05)] hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-300">
              <Link to="/admin" className="flex items-center">
                <span className="relative mr-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Admin
              </Link>
            </Button>
          )}
          
          <NotificationBell />

          {/* Cart Status Badge */}
          <Link 
            to="/store" 
            className={`relative flex h-9 w-9 items-center justify-center border transition-all duration-300 bg-secondary/40 ${
              cartCount > 0 
                ? "border-primary/50 text-primary shadow-[0_0_10px_rgba(249,115,22,0.15)] animate-pulse" 
                : "border-border text-muted-foreground hover:border-primary hover:text-foreground hover:shadow-[0_0_10px_rgba(249,115,22,0.15)]"
            }`}
            aria-label="View shopping cart"
          >
            <ShoppingBag className="h-4 w-4" />
            <AnimatePresence>
              {cartCount > 0 && (
                <motion.span 
                  key={cartCount}
                  initial={{ scale: 0, y: -4 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0, y: -4 }}
                  transition={{ type: "spring", stiffness: 450, damping: 15 }}
                  className="absolute -right-1 -top-1.5 flex h-4.5 min-w-[18px] items-center justify-center bg-primary px-1 text-[8.5px] font-bold text-white rounded-none shadow-[0_0_10px_hsl(var(--primary))]"
                >
                  {cartCount}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          <AccountArea />
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden border border-border rounded-none h-9 w-9 bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary transition-all duration-300" 
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
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
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm lg:hidden pointer-events-auto"
            />

            <motion.nav 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-72 border-l border-border bg-background/98 cmd-glass px-6 py-6 lg:hidden shadow-2xl flex flex-col justify-between pointer-events-auto"
            >
              {/* Technical Grid background decoration */}
              <div className="absolute inset-0 cmd-grid-bg opacity-10 pointer-events-none" />
              
              <div className="relative z-10">
                {/* Drawer Header */}
                <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-6">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-mono font-bold tracking-widest text-primary uppercase">Console Menu</span>
                    <span className="text-[8px] font-mono text-muted-foreground uppercase">SYSTEM // LIVE</span>
                  </div>
                  <button 
                    onClick={() => setOpen(false)} 
                    className="flex h-8 w-8 items-center justify-center border border-border hover:border-primary text-muted-foreground hover:text-foreground transition-all duration-300"
                    aria-label="Close menu"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Staggered Navigation links */}
                <motion.div 
                  variants={drawerVariants}
                  initial="hidden"
                  animate="show"
                  className="flex flex-col gap-4"
                >
                  {links.map((link) => {
                    const active = isLinkActive(link.href);
                    return (
                      <motion.div key={link.href} variants={itemVariants}>
                        <Link 
                          to={link.href} 
                          onClick={() => setOpen(false)} 
                          className={`group relative flex items-center py-2 font-display text-xl uppercase tracking-wider transition-all ${
                            active ? "text-primary font-bold" : "text-foreground hover:text-primary"
                          }`}
                        >
                          <span className="relative z-10 flex items-center">
                            {active && <span className="mr-2 h-1.5 w-1.5 bg-primary rounded-none shadow-[0_0_8px_rgba(249,115,22,0.8)]" />}
                            {link.label}
                          </span>
                        </Link>
                      </motion.div>
                    );
                  })}
                  
                  <motion.div variants={itemVariants} className="mt-4 border-t border-border/60 pt-4 flex flex-col gap-4">
                    {isAuthenticated ? (
                      <>
                        <Link 
                          to="/account" 
                          onClick={() => setOpen(false)} 
                          className="font-display text-xl uppercase tracking-wider text-foreground hover:text-primary transition-all flex items-center"
                        >
                          My Account
                        </Link>
                        {isAdmin && (
                          <Link 
                            to="/admin" 
                            onClick={() => setOpen(false)} 
                            className="font-display text-xl uppercase tracking-wider text-emerald-400 hover:text-emerald-300 transition-all flex items-center"
                          >
                            <span className="relative mr-2 flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Admin Panel
                          </Link>
                        )}
                        <button 
                          onClick={() => { setOpen(false); base44.auth.logout("/"); }} 
                          className="text-left font-display text-xl uppercase tracking-wider text-destructive flex items-center hover:text-destructive/80 transition-all"
                        >
                          Log out
                        </button>
                      </>
                    ) : (
                      <>
                        <Link 
                          to="/login" 
                          onClick={() => setOpen(false)} 
                          className="font-display text-xl uppercase tracking-wider text-foreground hover:text-primary transition-all"
                        >
                          Log in
                        </Link>
                        <Link 
                          to="/register" 
                          onClick={() => setOpen(false)} 
                          className="font-display text-xl uppercase tracking-wider text-primary hover:text-primary/80 transition-all"
                        >
                          Sign up
                        </Link>
                      </>
                    )}
                  </motion.div>
                </motion.div>
              </div>

              {/* Drawer Footer info */}
              <div className="relative z-10 border-t border-border/40 pt-4 mt-6 text-center">
                <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest">
                  RLT Vegas // Takeover 2026
                </p>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}