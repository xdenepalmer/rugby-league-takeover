import React, { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const links = [
  { label: "Latest News", href: "#news" },
  { label: "About Us", href: "#about" },
  { label: "Travel Packages", href: "#travel" },
  { label: "Events", href: "#events" },
  { label: "Merch", href: "#merch" },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/95 border-b border-border backdrop-blur-xl" : "bg-background/70 backdrop-blur-md"}`}>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
        <a href="#home" className="font-display text-xl tracking-[0.28em] text-foreground">
          RLT<span className="text-primary">LV</span>
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="group relative text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
              <span className="absolute -bottom-2 left-0 h-px w-0 bg-primary transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>
      {open && (
        <nav className="border-t border-border bg-background px-5 py-6 md:hidden">
          <div className="grid gap-5">
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="font-display text-2xl uppercase tracking-wide text-foreground">
                {link.label}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}