import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ScanLine, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { successImpact, errorImpact } from "@/lib/native/haptics";

// Staff tool for the stand: type or scan a collection pass and mark the order
// collected. Redemption is decided server-side — this screen never decides
// whether a pass is valid, it only reports what the server said.
export default function CollectionRedeem() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const submit = async (event) => {
    event.preventDefault();
    const serial = code.trim().toUpperCase();
    if (!serial || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await base44.functions.invoke("orderPass", { action: "redeem", serial });
      successImpact();
      setResult({ ok: true, ...(response?.data || {}) });
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["storeOrders"] });
    } catch (error) {
      errorImpact();
      const payload = error?.response?.data || error?.data || {};
      setResult({
        ok: false,
        error: payload.error || error?.message || "Could not check that pass.",
        code: payload.code,
        order: payload.order,
      });
    } finally {
      setBusy(false);
    }
  };

  const order = result?.order;

  return (
    <div className="border border-border/60 bg-card/30 p-4 space-y-3">
      <div>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground">
          <ScanLine className="h-4 w-4 text-primary" /> Collect an order
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          Scan the customer&apos;s pass or type the code. Each pass can only be collected once —
          a second attempt is refused, so a screenshotted pass won&apos;t get a second order out the door.
        </p>
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="RLT-XXXXX-XXXXX"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Collection pass code"
          className="h-11 flex-1 rounded-none border-border/40 font-mono tracking-[0.15em]"
        />
        <Button
          type="submit"
          disabled={busy || !code.trim()}
          className="h-11 shrink-0 rounded-none px-4 text-[11px] font-bold uppercase tracking-wider"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Collect"}
        </Button>
      </form>

      {result && (
        <div
          role="status"
          aria-live="polite"
          className={`border p-3 ${
            result.ok
              ? "border-emerald-500/30 bg-emerald-500/[0.06]"
              : "border-destructive/40 bg-destructive/[0.06]"
          }`}
        >
          <p className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
            result.ok ? "text-emerald-400" : "text-destructive"
          }`}>
            {result.ok
              ? <><CheckCircle2 className="h-4 w-4" /> Handed over</>
              : <><AlertTriangle className="h-4 w-4" /> {result.code === "already_redeemed" ? "Already collected" : "Not valid"}</>}
          </p>
          {!result.ok && <p className="mt-1 text-xs text-foreground">{result.error}</p>}
          {order && (
            <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
              <p className="text-foreground">{order.customerName || order.customerEmail}</p>
              <p>${Number(order.totalAud || 0).toFixed(2)} AUD · {order.serial}</p>
              {(order.lineItems || []).map((item, i) => (
                <p key={i}>{item.quantity}× {item.name}{item.size ? ` (${item.size})` : ""}</p>
              ))}
              {order.redeemedAt && !result.ok && (
                <p className="text-destructive">
                  Collected {new Date(order.redeemedAt).toLocaleString()}
                  {order.redeemedBy ? ` by ${order.redeemedBy}` : ""}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
