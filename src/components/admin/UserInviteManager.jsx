import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Mail, Shield, Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function UserInviteManager() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);
  const [sending, setSending] = useState(false);

  const invite = async () => {
    setSending(true);
    setStatus("");
    setIsError(false);
    try {
      await base44.users.inviteUser(email, role);
      setStatus(`Invite sent to ${email}`);
      setIsError(false);
      setEmail("");
    } catch (error) {
      setStatus(error?.message || "Invite could not be sent");
      setIsError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.section
      id="handover-admin"
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="scroll-mt-28 relative overflow-hidden border border-border bg-card/60 cmd-glass"
    >
      {/* Custom gradient accent bar (pink / rose) */}
      <div
        className="h-[2px] w-full"
        style={{
          background: "linear-gradient(90deg, #ec4899 0%, #f43f5e 30%, #fb7185 50%, #f43f5e 70%, #ec4899 100%)",
          backgroundSize: "200% 100%",
          animation: "cmd-data-stream 3s linear infinite",
        }}
      />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 border border-pink-500/20 bg-pink-500/5">
            <UserPlus className="h-3.5 w-3.5 text-pink-400" />
          </div>
          <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-pink-400 font-mono">
            Handover
          </p>
          <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 bg-pink-500/5 border border-pink-500/10">
            <span className="h-1 w-1 rounded-full bg-pink-400 cmd-blink" />
            <span className="text-[7px] font-bold uppercase tracking-wider text-pink-400/70">Active</span>
          </span>
        </div>

        <h2 className="font-display text-3xl md:text-4xl uppercase leading-none tracking-wide text-foreground">
          Invite site managers
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Send access to the handover recipient or future staff so they can manage the admin panel themselves.
        </p>

        {/* Invite Form */}
        <div className="mt-6 border border-border/50 bg-card/30 p-5">
          <div className="grid gap-5 md:grid-cols-[1fr_180px]">
            {/* Email field */}
            <div className="grid gap-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <Mail className="h-3 w-3" />
                Recipient Email
              </label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-none"
              />
              <p className="text-[9px] text-muted-foreground/60">
                The recipient will get an email with login instructions
              </p>
            </div>

            {/* Role field */}
            <div className="grid gap-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <Shield className="h-3 w-3" />
                Access Level
              </label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-11 rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — Full access</SelectItem>
                  <SelectItem value="user">User — Limited access</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[9px] text-muted-foreground/60">
                Admins can manage all settings
              </p>
            </div>
          </div>

          {/* Send Button */}
          <div className="mt-5">
            <Button
              size="mobile"
              onClick={invite}
              disabled={!email || sending}
              className="rounded-none bg-pink-600 hover:bg-pink-500 text-white w-full sm:w-auto min-w-[180px] group/btn"
            >
              <AnimatePresence mode="wait">
                {sending ? (
                  <motion.span
                    key="sending"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-2"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-2"
                  >
                    <Send className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                    Send Invite
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </div>
        </div>

        {/* Status feedback */}
        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: 8, height: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div
                className={`mt-4 flex items-center gap-3 border p-4 ${
                  isError
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {isError ? (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                )}
                <p className="text-sm font-semibold">{status}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
