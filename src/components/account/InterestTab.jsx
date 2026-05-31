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
      {registrations.map((registration) => (
        <article key={registration.id} className="grid gap-2 border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-primary">{registration.team_supported || "Interest"}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {registration.created_date ? format(new Date(registration.created_date), "dd MMM yyyy") : "Recently"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{registration.name} · {registration.email}{registration.phone ? ` · ${registration.phone}` : ""}</p>
          <p className="text-xs text-muted-foreground">We'll be in touch when packages go live.</p>
        </article>
      ))}
    </div>
  );
}
