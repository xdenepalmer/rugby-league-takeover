import React from "react";
import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";

const logoUrl = "https://media.base44.com/images/public/user_6a1808166a6a8ea04ad51c2c/310b03a74_5B0781E5-F8D7-43EC-9088-1897E36AC8C6.png";
const stadiumVideoUrl = "https://media.base44.com/videos/public/6a18d49a2b8f40f0f81cc26e/bf55ac1e7_AllegiantStadiumParadiseNevadaclaytonhaamallegiantallegiantstadiumparadis.mp4";

export default function HeroSection() {
  return (
    <section id="home" className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0">
        <video
          src={stadiumVideoUrl}
          className="h-full w-full object-cover opacity-45 grayscale"
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:80px_80px] opacity-30" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-5 pt-24 text-center md:px-8">
        <motion.img
          src={logoUrl}
          alt="Rugby League Takeover Las Vegas"
          initial={{ opacity: 0, y: -90, scale: 0.86 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 w-64 drop-shadow-2xl md:w-96"
        />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.8 }}>
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.42em] text-primary md:text-sm">Las Vegas • Rugby League • Supporter Takeover</p>
          <h1 className="font-display text-6xl uppercase leading-[0.82] tracking-tight text-foreground md:text-8xl lg:text-9xl">
            The annual<br />Vegas takeover
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
            Join the world’s most passionate and loyal Rugby League supporter groups for an unforgettable Australian footy invasion of Las Vegas.
          </p>
        </motion.div>
        <a href="#news" className="absolute bottom-8 inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground transition-colors hover:text-foreground">
          Enter the site <ArrowDown className="h-4 w-4 animate-bounce text-primary" />
        </a>
      </div>
    </section>
  );
}