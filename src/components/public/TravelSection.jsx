import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isLikelyBotSubmission, normalizeInterestRegistration } from "@/lib/public-forms";
import { appParams } from "@/lib/app-params";
import SectionHeader from "./SectionHeader";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Loader2, Plane, ShieldCheck } from "lucide-react";

const teams = ["Eels", "Tigers", "Titans", "Storm", "Leopards", "Bulls", "Other"];

// Fade up variants
const cardVariants = {
  hidden: { opacity: 0, y: 25 },
  show: (index) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 110,
      damping: 15,
      delay: index * 0.1,
    }
  })
};

export default function TravelSection({ packages, settings = {} }) {
  const emptyForm = { name: "", phone: "", email: "", postcode: "", team_supported: "", trip_details: "", consent_to_contact: false, website: "" };
  const [form, setForm] = useState(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (!appParams.hasBase44Config) return { skipped: true };
      if (isLikelyBotSubmission(data)) return { skipped: true };
      const clean = normalizeInterestRegistration(data);
      const response = await base44.functions.invoke("submitRegistration", { ...clean, website: data.website });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      setSubmitted(true);
      setForm(emptyForm);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <section id="travel" className="relative border-t border-border bg-background/80 px-5 py-24 md:px-8 md:py-32 overflow-hidden">
      {/* Laser glow background element */}
      <div className="absolute bottom-0 right-0 w-[450px] h-[450px] bg-primary/2 rounded-full blur-[100px] pointer-events-none" />

      <div className="mx-auto max-w-7xl relative z-10">
        <SectionHeader eyebrow={settings.travel_eyebrow || "Travel Packages"} title={settings.travel_title || "Your Vegas base camp"}>
          {settings.travel_description || "Air, accommodation, events and more are coming soon. Register your interest to be first in line."}
        </SectionHeader>
        
        {/* Packages Grid */}
        <div className="grid gap-6 md:grid-cols-3 mt-12">
          {packages.map((pkg, index) => (
            <motion.div 
              key={pkg.id || index}
              variants={cardVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              custom={index}
              className="group relative flex flex-col border border-border bg-card/45 cmd-glass hover:-translate-y-2 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.1)] transition-all duration-500 overflow-hidden"
            >
              {/* Image banner inside package */}
              {pkg.image_url && (
                <div className="aspect-[16/10] overflow-hidden border-b border-border/50 bg-secondary/15 relative">
                  <img 
                    src={pkg.image_url} 
                    alt={pkg.name} 
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-108" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#030512]/90 via-transparent to-transparent opacity-60" />
                </div>
              )}
              
              <div className="p-7 flex-1 flex flex-col justify-between">
                <div>
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-primary flex items-center gap-1">
                    <Plane className="h-3 w-3" />
                    <span>Package 0{index + 1}</span>
                  </p>
                  <h3 className="font-display text-3xl uppercase leading-none text-foreground group-hover:text-primary transition-colors duration-300">
                    {pkg.name}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground min-h-[60px]">
                    {pkg.description}
                  </p>
                </div>
                
                {/* Coming soon button with animated pulsing text badge */}
                <div className="mt-8 border-t border-border/30 pt-5 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-foreground">
                    Status
                  </span>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent animate-pulse">
                    Coming Soon
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Lead/Registration Form Container Block */}
        <div className="mt-16 border border-border bg-card/45 cmd-glass p-6 md:p-10 relative overflow-hidden shadow-2xl">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2.5px] cmd-accent-bar animate-pulse" />

          <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr] relative z-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-primary flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-accent animate-pulse" />
                <span>{settings.registration_eyebrow || "Register interest"}</span>
              </p>
              
              <h3 className="mt-4 font-display text-4xl xl:text-5xl uppercase leading-none text-foreground">
                {settings.registration_title || "Don’t miss the drop."}
              </h3>
              
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                {settings.registration_description || "Leave your details and the team will contact you when packages go live."}
              </p>

              <AnimatePresence>
                {submitted && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-6 border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2"
                  >
                    <ShieldCheck className="h-4.5 w-4.5 text-emerald-500 animate-bounce" />
                    <span>Thanks — your interest is registered!</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Registration Input Form */}
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <input
                aria-hidden="true"
                tabIndex="-1"
                autoComplete="off"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="hidden"
                name="website"
              />
              
              <div>
                <label htmlFor="reg-name" className="sr-only">Full Name</label>
                <Input 
                  id="reg-name"
                  required 
                  placeholder="Full Name" 
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                  className="h-12 rounded-none bg-background/50 border-border focus-visible:ring-primary focus-visible:border-primary/50 text-foreground" 
                />
              </div>
              <div>
                <label htmlFor="reg-phone" className="sr-only">Phone number</label>
                <Input 
                  id="reg-phone"
                  placeholder="Phone number" 
                  value={form.phone} 
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} 
                  className="h-12 rounded-none bg-background/50 border-border focus-visible:ring-primary focus-visible:border-primary/50 text-foreground" 
                />
              </div>
              <div>
                <label htmlFor="reg-email" className="sr-only">Email address</label>
                <Input 
                  id="reg-email"
                  required 
                  type="email" 
                  placeholder="Email address" 
                  value={form.email} 
                  onChange={(e) => setForm({ ...form, email: e.target.value })} 
                  className="h-12 rounded-none bg-background/50 border-border focus-visible:ring-primary focus-visible:border-primary/50 text-foreground" 
                />
              </div>
              <div>
                <label htmlFor="reg-postcode" className="sr-only">Postcode</label>
                <Input 
                  id="reg-postcode"
                  placeholder="Postcode" 
                  value={form.postcode} 
                  onChange={(e) => setForm({ ...form, postcode: e.target.value })} 
                  className="h-12 rounded-none bg-background/50 border-border focus-visible:ring-primary focus-visible:border-primary/50 text-foreground" 
                />
              </div>
              
              <Select required value={form.team_supported} onValueChange={(value) => setForm({ ...form, team_supported: value })}>
                <SelectTrigger className="h-12 rounded-none bg-background/50 border-border text-left text-muted-foreground focus:ring-primary md:col-span-2">
                  <SelectValue placeholder="Team you support" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border rounded-none">
                  {teams.map((team) => (
                    <SelectItem key={team} value={team} className="rounded-none uppercase text-xs font-semibold tracking-wider">
                      {team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="md:col-span-2">
                <label htmlFor="reg-trip-details" className="sr-only">Tell us about the trip you're after</label>
                <Textarea
                  id="reg-trip-details"
                  placeholder="Explain what trip you are after — how many days? what type of hotel? and do you need any customisation?"
                  value={form.trip_details}
                  onChange={(e) => setForm({ ...form, trip_details: e.target.value })}
                  maxLength={1000}
                  rows={4}
                  className="min-h-28 rounded-none bg-background/50 border-border focus-visible:ring-primary focus-visible:border-primary/50 text-foreground resize-none"
                />
              </div>

              <label className="flex items-start gap-3 border border-border bg-background/30 p-4 text-xs leading-relaxed text-muted-foreground md:col-span-2 select-none">
                <input
                  required
                  type="checkbox"
                  checked={form.consent_to_contact}
                  onChange={(e) => setForm({ ...form, consent_to_contact: e.target.checked })}
                  className="mt-0.5 h-4.5 w-4.5 rounded-none border-border bg-background/40 checked:bg-primary accent-primary"
                />
                <span>I agree to be contacted about Rugby League Takeover travel packages and related event updates.</span>
              </label>
              
              <Button 
                type="submit"
                disabled={!appParams.hasBase44Config || mutation.isPending} 
                className="h-12 rounded-none bg-primary hover:bg-primary/95 text-white font-bold uppercase tracking-[0.22em] text-xs md:col-span-2 shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all flex items-center justify-center gap-2"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Register Interest</span>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}