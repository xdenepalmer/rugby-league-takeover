import React from "react";
import { ShieldCheck, Ticket, MessageSquare, Percent, Calendar } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import MembershipCard from "@/components/membership/MembershipCard";
import {
  isActiveMember, formatMembershipDate, membershipStatusLine, MEMBERSHIP_TERM_MONTHS,
} from "@/lib/membership";

const BENEFITS = [
  { icon: Percent, title: "Bar discounts", text: "Show your card at the bar for member pricing on the night." },
  { icon: ShieldCheck, title: "RLT Member badge", text: "Your posts carry the member badge across the forum." },
  { icon: Ticket, title: "Member events", text: "First access to member-only events and ticket releases." },
  { icon: MessageSquare, title: "Backing the club", text: "Every membership goes straight back into the takeover." },
];

export default function MembershipTab() {
  const { user } = useAuth();
  const active = isActiveMember(user);

  return (
    <div className="grid gap-5">
      <MembershipCard />

      <div className="border border-border/50 bg-card/20 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base uppercase tracking-wide text-foreground">Your membership</h3>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="border border-border/30 bg-black/20 p-3">
            <dt className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Status</dt>
            <dd className={`mt-1 text-sm font-bold ${active ? "text-emerald-400" : "text-slate-400"}`}>
              {active ? "Active" : "Inactive"}
            </dd>
          </div>
          <div className="border border-border/30 bg-black/20 p-3">
            <dt className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Member since</dt>
            <dd className="mt-1 text-sm font-bold text-foreground">
              {formatMembershipDate(user?.membership_started_at)}
            </dd>
          </div>
          <div className="border border-border/30 bg-black/20 p-3">
            <dt className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Renews / expires</dt>
            <dd className="mt-1 text-sm font-bold text-foreground">
              {formatMembershipDate(user?.membership_expires_at)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Calendar className="mt-px h-3 w-3 shrink-0 text-primary/70" />
          {membershipStatusLine(user)} · Memberships run for {MEMBERSHIP_TERM_MONTHS} months from
          purchase. Renewing early adds a full term to the end of your current one, so you never
          lose time you've paid for.
        </p>
      </div>

      <div className="border border-border/50 bg-card/20 p-5">
        <h3 className="font-display text-base uppercase tracking-wide text-foreground">What you get</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="flex items-start gap-3 border border-border/20 bg-black/20 p-3">
              <benefit.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground">{benefit.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{benefit.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
