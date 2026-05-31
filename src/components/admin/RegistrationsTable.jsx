import React from "react";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function RegistrationsTable({ registrations }) {
  const exportCsv = () => {
    const headers = ["Name", "Email", "Phone", "Postcode", "Team", "Date"];
    const rows = registrations.map((item) => [item.name, item.email, item.phone, item.postcode, item.team_supported, item.created_date || ""]);
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rugby-league-takeover-registrations.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section id="registrations-admin" className="scroll-mt-28 border border-border bg-card p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="font-display text-4xl uppercase">Interest Registrations</h2>
        <Button variant="outline" className="rounded-none" onClick={exportCsv} disabled={!registrations.length}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
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
            {registrations.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.email}</TableCell>
                <TableCell>{item.phone}</TableCell>
                <TableCell>{item.postcode}</TableCell>
                <TableCell>{item.team_supported}</TableCell>
                <TableCell>{item.created_date ? format(new Date(item.created_date), "dd MMM yyyy") : ""}</TableCell>
              </TableRow>
            ))}
            {!registrations.length && (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No registrations yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}