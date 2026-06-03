import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Ticket } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

export default function InterestTab() {
  const { user } = useAuth();
  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["myInterest", user?.email],
    queryFn: () => base44.entities.InterestRegistration.filter({ user_email: user.email }, "-created_date", 100),
    enabled: Boolean(user?.email),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading your registrations…</p>;

  if (registrations.length === 0) {
    return (
      <div className="border border-border bg-card p-10 text-center">
        <Ticket className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">You haven't registered interest in a travel package yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {registrations.map((registration) => {
        const steps = [
          { title: "Interest Registered", desc: "Submitted successfully", status: "completed" },
          { title: "Preferences Matched", desc: `Setup for ${registration.setup_type || "Standard"} preference (${registration.budget_range || "Flexible"} budget)`, status: "completed" },
          { title: "Allocation Queue", desc: "Awaiting package release for Las Vegas 2026", status: "active" },
          { title: "Booking Confirmed", desc: "Tickets and travel options finalized", status: "upcoming" }
        ];

        return (
          <article key={registration.id} className="grid gap-2 border border-border bg-card p-5 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.2em] text-primary">{registration.team_supported || "Interest"} Supporter Package</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {registration.created_date ? format(new Date(registration.created_date), "dd MMM yyyy") : "Recently"}
              </span>
            </div>
            <p className="text-sm text-slate-200">{registration.name} · {registration.email}{registration.phone ? ` · ${registration.phone}` : ""}</p>
            
            {/* Travel milestones progress timeline */}
            <div className="mt-4 border border-border/20 bg-muted/5 p-4 space-y-4">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-350">Package Status Milestones</p>
              <div className="relative border-l border-border/40 pl-6 space-y-4 ml-2">
                {steps.map((step, idx) => {
                  const isCompleted = step.status === "completed";
                  const isActive = step.status === "active";
                  return (
                    <div key={idx} className="relative">
                      {/* Indicator circle */}
                      <div className={`absolute left-[-31px] top-0.5 flex h-4.5 w-4.5 items-center justify-center border transition-all ${
                        isCompleted 
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 font-extrabold" 
                          : isActive 
                            ? "bg-primary/10 border-primary text-primary ring-2 ring-primary/25" 
                            : "bg-background border-border text-slate-400"
                      }`}>
                        {isCompleted ? "✓" : isActive ? "●" : ""}
                      </div>
                      <div>
                        <span className={`text-xs font-bold uppercase tracking-wider block ${
                          isCompleted ? "text-emerald-400" : isActive ? "text-primary" : "text-slate-350"
                        }`}>
                          {step.title}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground mt-2">We'll be in touch as soon as allocations for {registration.team_supported || "your team"} open.</p>
          </article>
        );
      })}
    </div>
  );
}
