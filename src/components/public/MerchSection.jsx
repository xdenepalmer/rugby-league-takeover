import React from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import SectionHeader from "./SectionHeader";

export default function MerchSection({ settings }) {
  return (
    <section id="merch" className="relative px-5 py-24 md:px-8 md:py-32 overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent" />
      
      <div className="relative mx-auto max-w-4xl">
        <SectionHeader eyebrow="Merch" title="Official Gear">
          Rep the takeover. Exclusive Rugby League Takeover merch, shipped worldwide.
        </SectionHeader>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-12 border border-border/50 bg-gradient-to-br from-card/80 via-black/60 to-card/40 overflow-hidden"
        >
          <div className="h-[2px] w-full bg-gradient-to-r from-primary via-accent to-primary" />
          <div className="p-8 sm:p-12 flex flex-col items-center text-center">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="mb-6 grid h-16 w-16 place-items-center border border-primary/30 bg-primary/10"
            >
              <ShoppingBag className="h-8 w-8 text-primary" />
            </motion.div>
            <h3 className="font-display text-2xl sm:text-3xl uppercase tracking-wider text-foreground">
              {settings?.merch_heading || "Merch Store"}
            </h3>
            <p className="mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
              {settings?.merch_description || "Caps, tees, hoodies and more. Show your colours at the biggest rugby league event in Las Vegas."}
            </p>
            <div className="mt-3 flex items-center gap-1">
              <span className="inline-block h-1 w-8 bg-primary" />
              <span className="inline-block h-1 w-5 bg-accent" />
              <span className="inline-block h-1 w-3 bg-primary/50" />
            </div>
            <Link
              to="/store"
              className="group mt-8 inline-flex items-center gap-3 border border-primary/40 bg-primary/10 px-8 py-4 text-xs font-bold uppercase tracking-[0.25em] text-primary transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_30px_rgba(249,115,22,0.3)]"
            >
              <Sparkles className="h-4 w-4" />
              Browse Store
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}