import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isLikelyBotSubmission, normalizeInterestRegistration } from "@/lib/public-forms";
import { toast } from "@/components/ui/use-toast";
import { appParams } from "@/lib/app-params";
import SectionHeader from "./SectionHeader";
import { motion } from "framer-motion";
import { Heart, Loader2, Plane, ShieldCheck, ArrowRight, ArrowLeft, CheckCircle2, Info } from "lucide-react";

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

const defaultPackages = [
  { name: "Vegas Supporter Pack", description: "Flights, premium accommodation, match tickets, and official fan meetup party passes.", is_coming_soon: true, sort_order: 1 },
  { name: "Sin City VIP Experience", description: "Vegas Strip 5-star suites, Allegiant Stadium lower-bowl hospitality seats, and VIP pool party access.", is_coming_soon: true, sort_order: 2 },
  { name: "Mates & Social Clubs Tour", description: "Special discounts for groups of 8+, Allegiant Stadium suite upgrades, and private transfers.", is_coming_soon: true, sort_order: 3 },
];

export default function TravelSection({ packages, settings = {} }) {
  const emptyForm = { 
    name: "", 
    phone: "", 
    email: "", 
    postcode: "", 
    team_supported: "", 
    trip_details: "", 
    consent_to_contact: false, 
    website: "",
    travel_type: "",
    budget_range: "",
    fan_events_only: false
  };
  const [form, setForm] = useState(emptyForm);
  const [_submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(1);
  const queryClient = useQueryClient();

  const { data: dbTeams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list("sort_order", 200),
    enabled: appParams.hasBase44Config,
    retry: false,
    meta: { silent: true },
  });
  const teamOptions = useMemo(() => {
    const managed = dbTeams.filter((t) => t?.is_active !== false && t?.name).map((t) => t.name);
    const base = managed.length ? managed : teams;
    return [...base.filter((t) => t !== "Other"), "Other"];
  }, [dbTeams]);

  const richPackages = useMemo(() => {
    const list = packages.length ? packages : defaultPackages;
    const details = [
      {
        ideal_fan: "Passionate Supporter",
        inclusions: ["3-Star Strip Hotel Accommodation", "Official Match Tickets", "Pool Party Event Ticket"],
        status: "Registering Now",
        image: "https://images.unsplash.com/photo-1605833556294-ea5c7a74f57d?auto=format&fit=crop&w=600&q=80"
      },
      {
        ideal_fan: "VIP & Hospitality Fans",
        inclusions: ["5-Star Strip Luxury Suites", "Vegas VIP Match Seating", "Exclusive Pool Lounge VIP Ticket"],
        status: "Registering Now",
        image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80"
      },
      {
        ideal_fan: "Groups & Footy Clubs",
        inclusions: ["Group Airfare Discounts", "Allegiant Stadium Suite Upgrade Options", "Dedicated Host Support"],
        status: "Registering Now",
        image: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=600&q=80"
      }
    ];
    return list.map((pkg, idx) => ({
      ...pkg,
      ideal_fan: pkg.ideal_fan || details[idx % 3].ideal_fan,
      inclusions: pkg.inclusions || details[idx % 3].inclusions,
      status: pkg.status || details[idx % 3].status,
      image_url: pkg.image_url || details[idx % 3].image,
    }));
  }, [packages]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (!appParams.hasBase44Config) return { skipped: true };
      if (isLikelyBotSubmission(data)) return { skipped: true };
      
      const tripNote = `[Travel Type: ${data.travel_type || "N/A"}] [Budget: ${data.budget_range || "N/A"}] [Fan Events Only: ${data.fan_events_only ? "Yes" : "No"}] ${data.trip_details || ""}`;
      const clean = normalizeInterestRegistration({
        ...data,
        trip_details: tripNote
      });
      const response = await base44.functions.invoke("submitRegistration", { ...clean, website: data.website, fan_events_only: data.fan_events_only || false });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      setSubmitted(true);
      setStep(4);
    },
    onError: (error) => {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    },
  });

  const nextStep = () => {
    if (step === 1) {
      if (!form.name || !form.email) return;
    }
    if (step === 2) {
      if (!form.travel_type || !form.team_supported) return;
    }
    setStep((s) => s + 1);
  };

  const prevStep = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.consent_to_contact) return;
    mutation.mutate(form);
  };

  const handleReset = () => {
    setForm(emptyForm);
    setSubmitted(false);
    setStep(1);
  };

  return (
    <section className="relative border-t border-border bg-background/85 px-5 py-24 md:px-8 md:py-32 overflow-hidden">
      {/* Laser glow background element */}
      <div className="absolute bottom-0 right-0 w-[450px] h-[450px] bg-primary/[0.03] rounded-full blur-[100px] pointer-events-none" />

      <div className="mx-auto max-w-7xl relative z-10">
        <SectionHeader eyebrow={settings.travel_eyebrow || "Travel Packages"} title={settings.travel_title || "Vegas Supporter Packages"}>
          {settings.travel_description || "Premium flights, tickets, accommodation packages are dropping soon. Register your interest below to secure your spot."}
        </SectionHeader>
        
        {/* Packages Grid with detailed Lead Cards */}
        <div className="grid gap-6 md:grid-cols-3 mt-12">
          {richPackages.map((pkg, index) => (
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
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#030512]/95 via-transparent to-transparent opacity-60" />
                  
                  {/* Ideal for badge overlay */}
                  <span className="absolute top-3 left-3 bg-primary/80 border border-primary/20 backdrop-blur-md px-2 py-0.5 text-[8.5px] font-mono font-bold uppercase tracking-wider text-white">
                    Ideal For: {pkg.ideal_fan}
                  </span>
                </div>
              )}
              
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <p className="mb-2 text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-primary flex items-center gap-1.5">
                    <Plane className="h-3.5 w-3.5" />
                    <span>Package Tier 0{index + 1}</span>
                  </p>
                  <h3 className="font-display text-2xl uppercase leading-none text-foreground group-hover:text-primary transition-colors duration-300">
                    {pkg.name}
                  </h3>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {pkg.description}
                  </p>

                  {/* Bulleted inclusions list */}
                  <div className="mt-4 border-t border-border/30 pt-4">
                    <p className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">Likely Inclusions:</p>
                    <ul className="space-y-1.5">
                      {pkg.inclusions.map((inclusion, i) => (
                        <li key={i} className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                          <span className="h-1 w-1 bg-accent rounded-full shrink-0" />
                          <span>{inclusion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                {/* Status Indicator */}
                <div className="mt-6 border-t border-border/30 pt-4 flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-[0.25em] text-muted-foreground">
                    Status
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                    </span>
                    <span className="text-[9.5px] font-mono font-bold uppercase tracking-[0.15em] text-accent animate-pulse">
                      {pkg.status}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Lead/Registration Stepper Form Block */}
        <div id="travel-registration" style={{ scrollMarginTop: "96px" }} className="mt-16 border border-border bg-card/45 cmd-glass p-6 md:p-10 relative overflow-hidden shadow-2xl">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2.5px] cmd-accent-bar animate-pulse" />

          <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] relative z-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-primary flex items-center gap-1.5 font-mono">
                <Heart className="h-3.5 w-3.5 text-accent animate-pulse" />
                <span>{settings.registration_eyebrow || "SUPPORTER DROP"}</span>
              </p>
              
              <h3 className="mt-4 font-display text-4xl uppercase leading-[0.95] text-foreground">
                {settings.registration_title || "Register Your Travel Interest."}
              </h3>
              
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Ensure you are in the first supporter group contacted when flights, ticket unlocks, and hotel packages drop.
              </p>

              {/* Progress Steps Indicators */}
              <div className="mt-8 space-y-3.5 border-t border-border/30 pt-6">
                {[
                  { stepNum: 1, label: "Contact Information" },
                  { stepNum: 2, label: "Trip Preferences" },
                  { stepNum: 3, label: "Review & Confirmation" },
                ].map((s) => (
                  <div key={s.stepNum} className="flex items-center gap-3">
                    <div className={`h-6 w-6 rounded-none flex items-center justify-center text-[10px] font-mono font-bold border transition-all ${
                      step === s.stepNum 
                        ? "border-primary bg-primary/10 text-primary" 
                        : step > s.stepNum 
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" 
                          : "border-border text-slate-500"
                    }`}>
                      {step > s.stepNum ? "✓" : s.stepNum}
                    </div>
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
                      step === s.stepNum ? "text-foreground" : "text-muted-foreground"
                    }`}>{s.label}</span>
                  </div>
                ))}
              </div>

              {step === 4 && (
                <div className="mt-6 border border-emerald-500/30 bg-emerald-500/10 p-4 text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
                  <span>Your interest is registered successfully!</span>
                </div>
              )}
            </div>

            {/* Registration Input Form Wizard */}
            <div className="min-h-[300px] flex flex-col justify-between">
              {step === 1 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300 mb-2 border-b border-border/20 pb-1.5">Step 1: Your Details</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="travel-name" className="sr-only">Full Name</label>
                      <Input 
                        id="travel-name"
                        required 
                        placeholder="Full Name *" 
                        value={form.name} 
                        onChange={(e) => setForm({ ...form, name: e.target.value })} 
                        className="h-11 rounded-none bg-background/50 border-border text-sm" 
                      />
                    </div>
                    <div>
                      <label htmlFor="travel-phone" className="sr-only">Phone Number</label>
                      <Input 
                        id="travel-phone"
                        placeholder="Phone Number" 
                        value={form.phone} 
                        onChange={(e) => setForm({ ...form, phone: e.target.value })} 
                        className="h-11 rounded-none bg-background/50 border-border text-sm" 
                      />
                    </div>
                    <div>
                      <label htmlFor="travel-email" className="sr-only">Email Address</label>
                      <Input 
                        id="travel-email"
                        required 
                        type="email" 
                        placeholder="Email Address *" 
                        value={form.email} 
                        onChange={(e) => setForm({ ...form, email: e.target.value })} 
                        className="h-11 rounded-none bg-background/50 border-border text-sm" 
                      />
                    </div>
                    <div>
                      <label htmlFor="travel-postcode" className="sr-only">Postcode</label>
                      <Input 
                        id="travel-postcode"
                        placeholder="Postcode" 
                        value={form.postcode} 
                        onChange={(e) => setForm({ ...form, postcode: e.target.value })} 
                        className="h-11 rounded-none bg-background/50 border-border text-sm" 
                      />
                    </div>
                  </div>
                  
                  <div className="pt-6 flex justify-end">
                    <Button 
                      type="button" 
                      onClick={nextStep}
                      disabled={!form.name || !form.email}
                      className="px-6 h-11 rounded-none bg-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span>Preferences</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300 mb-2 border-b border-border/20 pb-1.5">Step 2: Travel Preferences</h4>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Select required value={form.travel_type} onValueChange={(value) => setForm({ ...form, travel_type: value })}>
                      <SelectTrigger aria-label="Travel Party Setup" className="h-11 rounded-none bg-background/50 border-border text-left text-xs uppercase tracking-wider text-muted-foreground focus:ring-primary">
                        <SelectValue placeholder="Travel Party Setup *" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border rounded-none">
                        <SelectItem value="solo" className="rounded-none uppercase text-[10px] tracking-wider font-semibold">Travelling Solo</SelectItem>
                        <SelectItem value="group" className="rounded-none uppercase text-[10px] tracking-wider font-semibold">Travelling with Friends</SelectItem>
                        <SelectItem value="family" className="rounded-none uppercase text-[10px] tracking-wider font-semibold">Travelling with Family</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select required value={form.budget_range} onValueChange={(value) => setForm({ ...form, budget_range: value })}>
                      <SelectTrigger aria-label="Expected Budget" className="h-11 rounded-none bg-background/50 border-border text-left text-xs uppercase tracking-wider text-muted-foreground focus:ring-primary">
                        <SelectValue placeholder="Expected Budget (AUD)" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border rounded-none">
                        <SelectItem value="budget-low" className="rounded-none uppercase text-[10px] tracking-wider font-semibold">$2,000 - $4,000 pp</SelectItem>
                        <SelectItem value="budget-mid" className="rounded-none uppercase text-[10px] tracking-wider font-semibold">$4,000 - $6,000 pp</SelectItem>
                        <SelectItem value="budget-high" className="rounded-none uppercase text-[10px] tracking-wider font-semibold">$6,000+ pp</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select required value={form.team_supported} onValueChange={(value) => setForm({ ...form, team_supported: value })}>
                      <SelectTrigger aria-label="NRL Team You Support" className="h-11 rounded-none bg-background/50 border-border text-left text-xs uppercase tracking-wider text-muted-foreground focus:ring-primary sm:col-span-2">
                        <SelectValue placeholder="NRL Team You Support *" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border rounded-none">
                        {teamOptions.map((team) => (
                          <SelectItem key={team} value={team} className="rounded-none uppercase text-[10px] tracking-wider font-semibold">
                            {team}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="sm:col-span-2">
                      <label htmlFor="travel-trip-details" className="sr-only">Trip Details</label>
                      <Textarea
                        id="travel-trip-details"
                        placeholder="Tell us about the Vegas trip you are after (preferred airline, hotels, custom extensions)..."
                        value={form.trip_details}
                        onChange={(e) => setForm({ ...form, trip_details: e.target.value })}
                        maxLength={1000}
                        rows={3}
                        className="min-h-20 rounded-none bg-background/50 border-border text-sm resize-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="flex items-start gap-3 border border-border bg-background/30 p-3 text-[10.5px] leading-relaxed text-muted-foreground select-none cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.fan_events_only}
                          onChange={(e) => setForm({ ...form, fan_events_only: e.target.checked })}
                          className="mt-0.5 h-[18px] w-[18px] rounded-none border-border bg-background/40 checked:bg-primary accent-primary focus:ring-2 focus:ring-primary"
                        />
                        <span>Send me Fan events info only <span className="text-slate-500">(skip travel packages, just events &amp; meetups)</span></span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-6 flex justify-between">
                    <Button 
                      type="button" 
                      onClick={prevStep}
                      className="px-6 h-11 rounded-none border border-border bg-transparent text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Back</span>
                    </Button>
                    <Button 
                      type="button" 
                      onClick={nextStep}
                      disabled={!form.travel_type || !form.team_supported}
                      className="px-6 h-11 rounded-none bg-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span>Review Details</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300 mb-2 border-b border-border/20 pb-1.5">Step 3: Review & Confirm</h4>
                  
                  {/* Summary of entries */}
                  <div className="border border-border bg-background/40 p-4 font-mono text-[10px] space-y-2 text-slate-300">
                    <div><span className="text-primary font-bold">NAME:</span> {form.name}</div>
                    <div><span className="text-primary font-bold">EMAIL:</span> {form.email}</div>
                    <div><span className="text-primary font-bold">PARTY:</span> {form.travel_type ? form.travel_type.toUpperCase() : "—"}</div>
                    <div><span className="text-primary font-bold">BUDGET:</span> {form.budget_range ? form.budget_range.replace("budget-", "").toUpperCase() : "—"}</div>
                    {form.fan_events_only && (
                      <div><span className="text-primary font-bold">FAN EVENTS ONLY:</span> Yes — skip travel packages, send event &amp; meetup info only</div>
                    )}
                    <div><span className="text-primary font-bold">SUPPORT TEAM:</span> {form.team_supported}</div>
                  </div>

                  <input
                    aria-hidden="true"
                    tabIndex="-1"
                    autoComplete="off"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    className="absolute left-[-9999px] opacity-0 h-0 overflow-hidden"
                    name="website"
                  />

                  <label className="flex items-start gap-3 border border-border bg-background/30 p-4 text-[10.5px] leading-relaxed text-muted-foreground select-none">
                    <input
                      required
                      type="checkbox"
                      checked={form.consent_to_contact}
                      onChange={(e) => setForm({ ...form, consent_to_contact: e.target.checked })}
                      className="mt-0.5 h-[18px] w-[18px] rounded-none border-border bg-background/40 checked:bg-primary accent-primary focus:ring-2 focus:ring-primary"
                    />
                    <span>I agree to be contacted via email/phone regarding travel bookings, tickets updates, and supporter event releases.</span>
                  </label>

                  <div className="pt-6 flex justify-between">
                    <Button 
                      type="button" 
                      onClick={prevStep}
                      className="px-6 h-11 rounded-none border border-border bg-transparent text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Back</span>
                    </Button>
                    <Button 
                      type="submit"
                      disabled={!form.consent_to_contact || mutation.isPending} 
                      className="px-8 h-11 rounded-none bg-primary hover:bg-primary/95 text-white font-bold uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(249,115,22,0.2)] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {mutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          <span>Registering...</span>
                        </>
                      ) : (
                        <span>Confirm & Register</span>
                      )}
                    </Button>
                  </div>
                </form>
              )}

              {step === 4 && (
                <div className="text-center py-6 space-y-5">
                  <div className="flex justify-center">
                    <div className="h-16 w-16 border-2 border-emerald-500 bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="h-9 w-9 text-emerald-400" />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-display text-2xl uppercase tracking-wider text-foreground">Interest Confirmed!</h4>
                    <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
                      Expected response time is <span className="text-primary font-bold">24-48 hours</span>. A confirmation token has been dispatched to <span className="text-slate-300 font-mono font-bold">{form.email}</span>.
                    </p>
                  </div>

                  {/* Helpful info box */}
                  <div className="border border-border/50 bg-secondary/10 p-4 text-[10px] text-muted-foreground font-mono leading-relaxed max-w-sm mx-auto flex items-start gap-2.5 text-left">
                    <Info className="h-[18px] w-[18px] text-primary shrink-0" />
                    <div>
                      <span className="font-bold text-foreground">WHAT'S NEXT:</span> Keep tabs on your travel status directly in the <Link to="/account" className="text-primary underline">My Account Dashboard</Link>, and check out active flight/hotel coordination inside the community forum.
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-6 py-2.5 border border-border text-[9px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Submit Another
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}