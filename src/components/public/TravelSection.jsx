import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SectionHeader from "./SectionHeader";

const teams = ["Eels", "Tigers", "Titans", "Storm", "Leopards", "Bulls", "Other"];

export default function TravelSection({ packages }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", postcode: "", team_supported: "" });
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data) => base44.entities.InterestRegistration.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      setSubmitted(true);
      setForm({ name: "", phone: "", email: "", postcode: "", team_supported: "" });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <section id="travel" className="border-t border-border bg-background px-5 py-24 md:px-8 md:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeader eyebrow="Travel Packages" title="Your Vegas base camp">
          Air, accommodation, events and more are coming soon. Register your interest to be first in line.
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
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-primary">Register interest</p>
            <h3 className="mt-4 font-display text-5xl uppercase leading-none text-foreground">Don’t miss the drop.</h3>
            <p className="mt-5 text-muted-foreground">Leave your details and the team will contact you when packages go live.</p>
            {submitted && <p className="mt-6 border border-primary bg-primary/10 p-4 text-sm font-semibold text-foreground">Thanks — your interest has been registered.</p>}
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
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
            <Button disabled={mutation.isPending} className="h-12 rounded-none bg-primary font-bold uppercase tracking-[0.2em] hover:bg-primary/90 md:col-span-2">
              {mutation.isPending ? "Submitting..." : "Register Interest"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}