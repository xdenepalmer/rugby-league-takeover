import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isLikelyBotSubmission, normalizeInterestRegistration } from "@/lib/public-forms";
import { appParams } from "@/lib/app-params";
import SectionHeader from "./SectionHeader";

const teams = ["Eels", "Tigers", "Titans", "Storm", "Leopards", "Bulls", "Other"];

export default function TravelSection({ packages, settings = {} }) {
  const emptyForm = { name: "", phone: "", email: "", postcode: "", team_supported: "", consent_to_contact: false, website: "" };
  const [form, setForm] = useState(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (!appParams.hasBase44Config) return { skipped: true };
      if (isLikelyBotSubmission(data)) return { skipped: true };
      // Validate client-side for fast feedback; the function re-sanitises,
      // captures the client IP, links the account and enforces bans server-side.
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
    <section id="travel" className="border-t border-border bg-background/80 px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeader eyebrow={settings.travel_eyebrow || "Travel Packages"} title={settings.travel_title || "Your Vegas base camp"}>
          {settings.travel_description || "Air, accommodation, events and more are coming soon. Register your interest to be first in line."}
        </SectionHeader>
        <div className="grid gap-5 md:grid-cols-3">
          {packages.map((pkg, index) => (
            <div key={pkg.id || index} className="border border-border bg-card p-7">
              <p className="mb-8 text-xs font-bold uppercase tracking-[0.28em] text-primary">Package 0{index + 1}</p>
              <h3 className="font-display text-4xl uppercase leading-none text-foreground">{pkg.name}</h3>
              <p className="mt-5 min-h-20 text-sm leading-6 text-muted-foreground">{pkg.description}</p>
              <div className="mt-8 border-t border-border pt-5 text-xs font-bold uppercase tracking-[0.24em] text-foreground">Coming Soon</div>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-8 border border-border bg-secondary p-6 md:grid-cols-[0.8fr_1.2fr] md:p-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-primary">{settings.registration_eyebrow || "Register interest"}</p>
            <h3 className="mt-4 font-display text-5xl uppercase leading-none text-foreground">{settings.registration_title || "Don’t miss the drop."}</h3>
            <p className="mt-5 text-muted-foreground">{settings.registration_description || "Leave your details and the team will contact you when packages go live."}</p>
            {submitted && <p className="mt-6 border border-primary bg-primary/10 p-4 text-sm font-semibold text-foreground">Thanks — your interest has been registered.</p>}
          </div>
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
            <Input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 rounded-none bg-background" />
            <Input placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-12 rounded-none bg-background" />
            <Input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-12 rounded-none bg-background" />
            <Input placeholder="Postcode" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} className="h-12 rounded-none bg-background" />
            <Select required value={form.team_supported} onValueChange={(value) => setForm({ ...form, team_supported: value })}>
              <SelectTrigger className="h-12 rounded-none bg-background md:col-span-2">
                <SelectValue placeholder="Team you support" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => <SelectItem key={team} value={team}>{team}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-start gap-3 border border-border bg-background p-4 text-sm leading-6 text-muted-foreground md:col-span-2">
              <input
                required
                type="checkbox"
                checked={form.consent_to_contact}
                onChange={(e) => setForm({ ...form, consent_to_contact: e.target.checked })}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span>I agree to be contacted about Rugby League Takeover travel packages and related event updates.</span>
            </label>
            <Button disabled={!appParams.hasBase44Config || mutation.isPending} className="h-12 rounded-none bg-primary font-bold uppercase tracking-[0.2em] hover:bg-primary/90 md:col-span-2">
              {mutation.isPending ? "Submitting..." : "Register Interest"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
