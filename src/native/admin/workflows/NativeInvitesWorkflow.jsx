import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { UserPlus, Mail, Shield, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import AdminConfirmSheet from "@/components/admin/shared/AdminConfirmSheet";
import MobileActionDrawer from "@/components/admin/MobileActionDrawer";
import { emitHaptic } from "@/lib/native/haptic-events";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeEmptyState } from "../../components/NativePrimitives.jsx";
import {
  INVITE_ROLES,
  DEFAULT_INVITE_ROLE,
  inviteRoleMeta,
  validateInviteEmail,
  buildInviteArgs,
  inviteSuccessMessage,
  inviteErrorMessage,
} from "./invites-helpers.js";

const formatTime = (value) => {
  try {
    return new Date(value).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
};

/**
 * Native invites workflow — /admin/people/invites. Payload parity with the
 * web UserInviteManager: the ONLY write is base44.users.inviteUser(email,
 * role), which invokes the same `inviteUser` edge function with the same
 * { email, role } body. The web manager reads no entities and keeps no
 * invite list (Supabase owns pending invitations), so the "sent" rows below
 * are session-only feedback — they are never persisted and never queried.
 * No revoke exists on the web surface, so none is invented here; the edge
 * function stays the sole authority.
 */
export default function NativeInvitesWorkflow() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(DEFAULT_INVITE_ROLE);
  const [formError, setFormError] = useState("");
  const [confirmArgs, setConfirmArgs] = useState(null); // { email, role } awaiting confirmation
  const [banner, setBanner] = useState(null); // { ok, text } on the main screen
  const [sent, setSent] = useState([]); // this session's successful sends (in-memory only)

  const inviteMutation = useMutation({
    // Same client call the web manager makes — the shared helper invokes the
    // `inviteUser` edge function with { email, role }.
    mutationFn: ({ email: inviteEmail, role: inviteRole }) => base44.users.inviteUser(inviteEmail, inviteRole),
  });

  const openForm = () => {
    emitHaptic("action.primary");
    setFormError("");
    setBanner(null);
    setDrawerOpen(true);
  };

  const submitForm = () => {
    const check = validateInviteEmail(email);
    if (!check.ok) {
      emitHaptic("mutation.error");
      setFormError(check.error);
      return;
    }
    emitHaptic("action.primary");
    setFormError("");
    setConfirmArgs(buildInviteArgs(check.email, role));
  };

  const confirmSend = async () => {
    if (!confirmArgs) return;
    try {
      await inviteMutation.mutateAsync(confirmArgs);
      emitHaptic("save.success");
      setSent((list) => [{ ...confirmArgs, at: new Date().toISOString() }, ...list]);
      setBanner({ ok: true, text: inviteSuccessMessage(confirmArgs.email) });
      setEmail("");
      setConfirmArgs(null);
      setDrawerOpen(false);
    } catch (error) {
      emitHaptic("mutation.error");
      // Web parity: surface error.message with the same fallback copy.
      setFormError(inviteErrorMessage(error));
      setConfirmArgs(null); // back to the form so the address can be fixed
    }
  };

  const roleMeta = inviteRoleMeta(role);

  return (
    <div className="pb-10">
      <NativeTopBar title="Invites" fallback="/admin/people" />

      <div className="space-y-4 px-4 pt-3">
        <div className="border border-border/60 bg-card/50 p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Handover</p>
          <h1 className="pt-1 font-display text-lg font-bold uppercase tracking-wide">Invite site managers</h1>
          <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
            Send access to the handover recipient or future staff so they can manage the admin panel themselves. The
            recipient gets an email with login instructions.
          </p>
          <button
            type="button"
            onClick={openForm}
            className="ios-pressable mt-3 flex min-h-11 w-full items-center justify-center gap-2 border border-pink-500/50 bg-pink-500/10 text-xs font-bold uppercase tracking-widest text-pink-300"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" /> Send an invite
          </button>
        </div>

        {banner && (
          <div
            role="status"
            className={`flex items-center gap-3 border p-3 ${
              banner.ok
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {banner.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <p className="text-sm font-semibold">{banner.text}</p>
          </div>
        )}

        <div>
          <p className="pb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Sent this session
          </p>
          {sent.length === 0 ? (
            <NativeEmptyState
              icon={Mail}
              title="No invites sent yet"
              description="Invites sent from this screen appear here until the app closes. Supabase keeps the real invitation records."
            />
          ) : (
            sent.map((item, index) => (
              <div key={`${item.email}-${item.at}-${index}`} className="flex items-center gap-3 border-b border-border/40 bg-card/40 px-3 py-3">
                <Send className="h-4 w-4 shrink-0 text-pink-400" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{item.email}</span>
                  <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
                    {inviteRoleMeta(item.role).label} · {formatTime(item.at)}
                  </span>
                </span>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
              </div>
            ))
          )}
        </div>
      </div>

      <MobileActionDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setFormError("");
        }}
        title="Send an invite"
        description="The recipient will get an email with login instructions."
      >
        <div className="grid gap-2 py-1">
          <label
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
            htmlFor="native-invite-email"
          >
            <Mail className="h-3 w-3" aria-hidden="true" /> Recipient email
          </label>
          <Input
            id="native-invite-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-none border-border bg-background"
          />
        </div>

        <div className="grid gap-2 pt-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            <Shield className="h-3 w-3" aria-hidden="true" /> Access level
          </p>
          <div className="grid grid-cols-2 gap-2">
            {INVITE_ROLES.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={role === option.key}
                onClick={() => {
                  emitHaptic("tab.select");
                  setRole(option.key);
                }}
                className={`ios-pressable min-h-11 border px-3 text-[10px] font-bold uppercase tracking-widest ${
                  role === option.key
                    ? "border-pink-400 bg-pink-500/15 text-pink-300"
                    : "border-border text-muted-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground/60">{roleMeta.detail}</p>
        </div>

        {formError && (
          <div className="mt-3 flex items-center gap-2 border border-destructive/30 bg-destructive/10 p-3 text-destructive" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="text-sm font-semibold">{formError}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-4">
          <button
            type="button"
            disabled={inviteMutation.isPending}
            onClick={() => setDrawerOpen(false)}
            className="ios-pressable flex min-h-11 items-center justify-center border border-border text-xs font-bold uppercase tracking-widest disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!email.trim() || inviteMutation.isPending}
            onClick={submitForm}
            className="ios-pressable flex min-h-11 items-center justify-center gap-2 border border-pink-500/60 bg-pink-500/15 text-xs font-bold uppercase tracking-widest text-pink-300 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" /> Send invite
          </button>
        </div>
      </MobileActionDrawer>

      <AdminConfirmSheet
        open={!!confirmArgs}
        title={`Invite ${confirmArgs?.email || ""}?`}
        description={
          confirmArgs?.role === "admin"
            ? "Admin — full access. This person will be able to manage all settings in the admin panel."
            : "User — limited access."
        }
        confirmLabel="Send invite"
        loading={inviteMutation.isPending}
        onConfirm={confirmSend}
        onCancel={() => {
          if (!inviteMutation.isPending) setConfirmArgs(null);
        }}
      />
    </div>
  );
}
