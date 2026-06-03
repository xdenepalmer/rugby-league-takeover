import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plane, ArrowRight, Mail } from "lucide-react";
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
        <Plane className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">You haven't registered interest in a travel package yet.</p>
        <Link
          to="/#travel"
          className="mt-4 inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/10 transition-colors"
        >
          Register Interest <ArrowRight className="h-3 w-3" />
        </Link>
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
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Package Status Milestones</p>
              <div className="relative border-l border-border/40 pl-6 space-y-4 ml-2">
                {steps.map((step, idx) => {
                  const isCompleted = step.status === "completed";
                  const isActive = step.status === "active";
                  return (
                    <div key={idx} className="relative" {...(isActive ? { "aria-current": "step" } : {})}>
                      {/* Indicator circle */}
                      <div className={`absolute left-[-31px] top-0.5 flex h-[18px] w-[18px] items-center justify-center border transition-all ${
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
                          isCompleted ? "text-emerald-400" : isActive ? "text-primary" : "text-slate-400"
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

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mt-4 border-t border-border/30 pt-4">
              <a
                href="/#travel"
                className="inline-flex items-center gap-1.5 border border-primary/25 bg-primary/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 transition-colors"
              >
                <Plane className="h-3 w-3" /> View Packages <ArrowRight className="h-2.5 w-2.5" />
              </a>
              <a
                href={`mailto:support@rugbyleaguetakeover.com?subject=Update%20Travel%20Preferences%20-%20${encodeURIComponent(registration.name)}`}
                className="inline-flex items-center gap-1.5 border border-border/50 bg-muted/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-foreground hover:border-primary/30 transition-colors"
              >
                <Mail className="h-3 w-3" /> Update Preferences
              </a>
            </div>
          </article>
        );
      })}
    </div>
  );
}
