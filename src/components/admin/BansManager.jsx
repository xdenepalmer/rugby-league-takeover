import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, ShieldX, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const isExpired = (ban) => ban.expires_at && new Date(ban.expires_at).getTime() <= Date.now();

export default function BansManager() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [newType, setNewType] = useState("ip");
  const [newValue, setNewValue] = useState("");
  const [newReason, setNewReason] = useState("");

  const { data: bans = [], isLoading } = useQuery({ queryKey: ["bans"], queryFn: () => base44.entities.Ban.list("-created_date", 500) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["bans"] });

  const addBan = useMutation({
    mutationFn: () => base44.entities.Ban.create({
      ban_type: newType,
      value: newValue.trim().toLowerCase(),
      reason: newReason.trim() || "Added by admin",
      banned_by: me?.email || "",
      is_active: true,
    }),
    onSuccess: () => { refresh(); setNewValue(""); setNewReason(""); toast({ title: "Ban added" }); },
  });

  const liftBan = useMutation({
    mutationFn: (id) => base44.entities.Ban.update(id, { is_active: false }),
    onSuccess: () => { refresh(); toast({ title: "Ban lifted" }); },
  });

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return bans.filter((b) => `${b.value || ""} ${b.reason || ""} ${b.ban_type || ""}`.toLowerCase().includes(term));
  }, [bans, search]);

  return (
    <section className="border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 font-display text-3xl uppercase"><ShieldX className="h-6 w-6 text-destructive" /> Bans</h2>
      <p className="mt-2 text-sm text-muted-foreground">Block by IP, email or account. IP bans are best-effort (VPNs/shared connections can evade them), so prefer time-limited bans and lift them when no longer needed.</p>

      <div className="mt-5 grid gap-3 border border-border bg-background/40 p-4 md:grid-cols-[140px_1fr_1fr_auto]">
        <Select value={newType} onValueChange={setNewType}>
          <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ip">IP address</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="user">User ID</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Value to block" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="rounded-none" />
        <Input placeholder="Reason" value={newReason} onChange={(e) => setNewReason(e.target.value)} className="rounded-none" />
        <Button onClick={() => addBan.mutate()} disabled={!newValue.trim() || addBan.isPending} className="rounded-none bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Add
        </Button>
      </div>

      <div className="relative mt-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search bans" value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-none pl-10" />
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading bans…</p>
      ) : (
        <div className="mt-5 grid gap-3">
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">No bans found.</p>}
          {filtered.map((ban) => (
            <div key={ban.id} className="grid gap-3 border border-border p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-none uppercase">{ban.ban_type}</Badge>
                  <span className="truncate font-mono text-sm">{ban.value}</span>
                  {!ban.is_active && <Badge variant="outline" className="rounded-none text-muted-foreground">Lifted</Badge>}
                  {ban.is_active && isExpired(ban) && <Badge variant="outline" className="rounded-none text-amber-400">Expired</Badge>}
                  {ban.is_active && !isExpired(ban) && <Badge variant="outline" className="rounded-none border-destructive/40 text-destructive">Active</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{ban.reason || "—"}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {ban.banned_by || "admin"} · {ban.created_date ? format(new Date(ban.created_date), "dd MMM yyyy") : ""}
                  {ban.expires_at ? ` · expires ${format(new Date(ban.expires_at), "dd MMM yyyy")}` : " · permanent"}
                </p>
              </div>
              {ban.is_active && (
                <Button variant="outline" size="sm" className="rounded-none" disabled={liftBan.isPending} onClick={() => liftBan.mutate(ban.id)}>Lift ban</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
