import React, { useState } from "react";
import { UserPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminSection from "./AdminSection";

export default function UserInviteManager() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  const invite = async () => {
    setSending(true);
    await base44.users.inviteUser(email, role);
    setStatus(`Invite sent to ${email}`);
    setEmail("");
    setSending(false);
  };

  return (
    <AdminSection id="handover-admin" eyebrow="Handover" title="Invite site managers" description="Send access to the handover recipient or future staff so they can manage the admin panel themselves.">
      <div className="grid gap-3 border border-border bg-background/50 p-4 md:grid-cols-[1fr_180px_auto]">
        <Input type="email" placeholder="Recipient email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-none" />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={invite} disabled={!email || sending} className="rounded-none bg-primary hover:bg-primary/90">
          <UserPlus className="mr-2 h-4 w-4" /> {sending ? "Sending" : "Send Invite"}
        </Button>
      </div>
      {status && <p className="mt-3 border border-primary/40 bg-primary/10 p-3 text-sm font-semibold text-foreground">{status}</p>}
    </AdminSection>
  );
}