import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function AdminShell({ user, children }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-secondary px-5 py-5 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Admin Dashboard</p>
            <h1 className="font-display text-4xl uppercase leading-none">Rugby League Takeover</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="hidden text-sm text-muted-foreground md:block">{user?.email}</p>
            <Button asChild variant="outline" className="rounded-none">
              <Link to="/">View Site</Link>
            </Button>
            <Button variant="ghost" className="rounded-none" onClick={() => base44.auth.logout("/")}>Log Out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">{children}</main>
    </div>
  );
}