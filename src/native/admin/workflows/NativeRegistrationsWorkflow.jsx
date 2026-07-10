import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, UserCheck, Mail, Phone, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import PullToRefresh from "@/components/PullToRefresh";
import { openSystemUrl } from "@/lib/native/open-external";
import { emitHaptic } from "@/lib/native/haptic-events";
import { useWindowedList } from "@/hooks/use-windowed-list";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import { filterRegistrations, registrationEmailTargets } from "./workflow-helpers.js";

// Heavy PII surface: the ["registrations"] key is on the native
// query-persistence denylist — this data never touches disk.
const useRegistrations = () =>
  useQuery({
    queryKey: ["registrations"],
    queryFn: () => base44.entities.InterestRegistration.list("-created_date", 200),
    enabled: appParams.hasBase44Config,
    staleTime: 60000,
  });

const formatDate = (value) => {
  try {
    return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
};

const contact = (href) => {
  openSystemUrl(href).then((handled) => {
    if (!handled && typeof window !== "undefined") window.location.href = href;
  });
};

/** Native registrations list — /admin/people/registrations */
export default function NativeRegistrationsList() {
  const navigate = useNavigate();
  const { data: registrations = [], isLoading } = useRegistrations();
  const [query, setQuery] = useState("");

  const visible = useMemo(() => filterRegistrations(registrations, query), [registrations, query]);
  const { visible: windowed, sentinelRef, done } = useWindowedList(visible, { initial: 20, step: 20 });
  const emailTargets = useMemo(() => registrationEmailTargets(visible), [visible]);

  const emailFiltered = () => {
    emitHaptic("action.primary");
    const bcc = encodeURIComponent(emailTargets.join(","));
    const subject = encodeURIComponent("Rugby League Takeover — Vegas update");
    contact(`mailto:?bcc=${bcc}&subject=${subject}`);
  };

  return (
    <div>
      <NativeTopBar title="Registrations" fallback="/admin/people" />
      <PullToRefresh queryKeys={[["registrations"]]}>
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 border border-border bg-card/50 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, phone, team, plans"
              aria-label="Search registrations"
              className="min-h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {visible.length} registration{visible.length === 1 ? "" : "s"}
            </p>
            {emailTargets.length > 0 && (
              <button
                type="button"
                onClick={emailFiltered}
                className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Email all ({emailTargets.length})
              </button>
            )}
          </div>
          {emailTargets.length > 40 && (
            <p className="pb-1 text-[9px] uppercase tracking-widest text-amber-300">
              Heads up: some mail apps cap BCC lists around 50 addresses
            </p>
          )}
        </div>

        {isLoading && registrations.length === 0 ? (
          <div className="space-y-2 px-4">
            <NativeSkeleton className="h-16 w-full" />
            <NativeSkeleton className="h-16 w-full" />
            <NativeSkeleton className="h-16 w-full" />
          </div>
        ) : windowed.length === 0 ? (
          <div className="px-4 pt-4">
            <NativeEmptyState icon={Users} title="No registrations" description="Nothing matches this search." />
          </div>
        ) : (
          windowed.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                emitHaptic("tab.select");
                navigate(`/admin/people/registrations/${encodeURIComponent(item.id)}`);
              }}
              className="ios-pressable flex w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left"
            >
              <UserCheck className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{item.name || item.email || "Registration"}</span>
                <span className="block truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                  {formatDate(item.created_date)} {item.team_supported ? `· ${item.team_supported}` : ""} {item.postcode ? `· ${item.postcode}` : ""}
                </span>
              </span>
            </button>
          ))
        )}
        {!done && <div ref={sentinelRef} className="h-10" aria-hidden="true" />}
      </PullToRefresh>
    </div>
  );
}

/** Native registration detail — /admin/people/registrations/:regId */
export function NativeRegistrationDetail() {
  const { regId } = useParams();
  const { data: registrations = [], isLoading } = useRegistrations();
  const item = useMemo(() => registrations.find((r) => String(r.id) === String(regId)) || null, [registrations, regId]);

  if (!item) {
    return (
      <div>
        <NativeTopBar title="Registration" fallback="/admin/people/registrations" />
        <div className="px-4 pt-4">
          {isLoading ? <NativeSkeleton className="h-40 w-full" /> : <NativeEmptyState icon={Users} title="Not found" description="This registration may have been removed." />}
        </div>
      </div>
    );
  }

  const fields = [
    ["Registered", formatDate(item.created_date)],
    ["Email", item.email],
    ["Phone", item.phone],
    ["Postcode", item.postcode],
    ["Team", item.team_supported],
    ["Marketing opt-in", item.marketing_opt_in === true ? "Yes" : item.marketing_opt_in === false ? "No" : ""],
  ].filter(([, value]) => value);

  return (
    <div className="pb-10">
      <NativeTopBar title="Registration" fallback="/admin/people/registrations" />
      <div className="space-y-4 px-4 pt-3">
        <div className="border border-border/60 bg-card/50 p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Fan</p>
          <h1 className="pt-1 font-display text-lg font-bold uppercase tracking-wide">{item.name || "—"}</h1>
          <div className="pt-2">
            {fields.map(([label, value]) => (
              <p key={label} className="border-b border-border/30 py-1.5 text-sm last:border-0">
                <span className="block text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
                {value}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-3">
            {item.email && (
              <button type="button" onClick={() => contact(`mailto:${item.email}`)} className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Email
              </button>
            )}
            {item.phone && (
              <button type="button" onClick={() => contact(`tel:${item.phone}`)} className="ios-pressable flex min-h-10 items-center gap-1.5 border border-border px-3 text-[10px] font-bold uppercase tracking-widest">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" /> Call
              </button>
            )}
          </div>
        </div>

        {item.trip_details && (
          <div className="border border-border/60 bg-card/50 p-3">
            <p className="pb-1 text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Travel plans</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.trip_details}</p>
          </div>
        )}
      </div>
    </div>
  );
}
