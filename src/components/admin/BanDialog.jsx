import React, { useState } from "react";
import { Ban as BanIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminStickyActionBar from "./AdminStickyActionBar";
import MobileActionDrawer from "./MobileActionDrawer";

const durations = [
  { value: "0", label: "Permanent" },
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "365", label: "1 year" },
];

// Shared dialog that collects a reason + optional expiry, then calls
// onConfirm({ reason, expiresAt }). expiresAt is an ISO string or null.
export default function BanDialog({ trigger, title, description, confirmLabel = "Apply ban", onConfirm, pending }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("0");

  const confirm = async () => {
    const expiresAt = days === "0" ? null : new Date(Date.now() + Number(days) * 86400000).toISOString();
    await onConfirm({ reason: reason.trim(), expiresAt });
    setOpen(false);
    setReason("");
    setDays("0");
  };

  const triggerElement = React.isValidElement(trigger)
    ? React.cloneElement(trigger, {
        onClick: (event) => {
          trigger.props?.onClick?.(event);
          if (!event.defaultPrevented) setOpen(true);
        },
      })
    : null;

  return (
    <>
      {triggerElement}
      <MobileActionDrawer
        open={open}
        onOpenChange={setOpen}
        title={<span className="flex items-center gap-2"><BanIcon className="h-5 w-5 text-destructive" /> {title}</span>}
        description={description}
      >
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Reason</Label>
            <Input placeholder="e.g. Repeated spam" value={reason} onChange={(e) => setReason(e.target.value)} className="h-11 rounded-none" />
          </div>
          <div className="grid gap-2">
            <Label>Duration</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="h-11 rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent>{durations.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <AdminStickyActionBar className="mt-4">
          <Button variant="ghost" size="mobile" className="rounded-none" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" size="mobile" className="rounded-none" onClick={confirm} disabled={pending}>{pending ? "Applying..." : confirmLabel}</Button>
        </AdminStickyActionBar>
      </MobileActionDrawer>
    </>
  );
}
