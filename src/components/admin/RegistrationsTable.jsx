import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, Search } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { SUPPORTED_TEAMS } from "@/lib/public-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function RegistrationsTable({ registrations }) {
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return registrations.filter((item) => {
      if (teamFilter !== "all" && item.team_supported !== teamFilter) return false;
      return `${item.name || ""} ${item.email || ""} ${item.postcode || ""}`.toLowerCase().includes(term);
    });
  }, [registrations, search, teamFilter]);

  const exportCsv = () => {
    const headers = ["Name", "Email", "Phone", "Postcode", "Team", "Consented", "Date"];
    const rows = filtered.map((item) => [
      item.name, item.email, item.phone, item.postcode, item.team_supported,
      item.consent_to_contact ? "yes" : "no",
      item.created_date ? format(new Date(item.created_date), "yyyy-MM-dd") : "",
    ]);
    downloadCsv("rugby-league-takeover-registrations.csv", headers, rows);
  };

  return (
    <section id="registrations-admin" className="scroll-mt-28 border border-border bg-card p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-4xl uppercase">Interest Registrations</h2>
          <p className="mt-1 text-sm text-muted-foreground">{filtered.length} of {registrations.length} shown · your marketing list for the ticket drop</p>
        </div>
        <Button variant="outline" className="rounded-none" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, email or postcode" value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-none pl-10" />
        </div>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="rounded-none sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {SUPPORTED_TEAMS.map((team) => <SelectItem key={team} value={team}>{team}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 overflow-x-auto border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Postcode</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.email}</TableCell>
                <TableCell>{item.phone}</TableCell>
                <TableCell>{item.postcode}</TableCell>
                <TableCell>{item.team_supported}</TableCell>
                <TableCell>{item.created_date ? format(new Date(item.created_date), "dd MMM yyyy") : ""}</TableCell>
              </TableRow>
            ))}
            {!filtered.length && (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No registrations match your filters.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
