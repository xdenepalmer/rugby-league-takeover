import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Copy, Check, Loader2, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { openExternalUrl } from "@/lib/native/open-external";
import { successImpact } from "@/lib/native/haptics";

// Collection pass for an order being picked up at the event.
//
// The code is shown as text regardless of whether any wallet is provisioned —
// it is the thing staff actually scan or type, and a customer standing at the
// stand with no signal still needs to be able to read it out. Wallet buttons are
// a convenience on top, and only render for wallets the server says it can
// actually issue; a dead "Add to Wallet" button is a promise the app can't keep.
export default function CollectionPass({ order }) {
  const [issuing, setIssuing] = useState("");
  const [copied, setCopied] = useState(false);
  const [serial, setSerial] = useState(order?.pass_serial || "");

  const { data: support } = useQuery({
    queryKey: ["walletSupport"],
    queryFn: async () => {
      const response = await base44.functions.invoke("orderPass", { action: "status" });
      return response?.data || null;
    },
    enabled: appParams.hasBase44Config,
    staleTime: 10 * 60 * 1000,
    retry: false,
    meta: { silent: true },
  });

  const redeemed = !!order?.pass_redeemed_at;

  const issue = async (wallet) => {
    setIssuing(wallet || "code");
    try {
      const response = await base44.functions.invoke("orderPass", {
        action: "issue",
        orderId: order.id,
        wallet,
      });
      const data = response?.data || {};
      if (data.serial) setSerial(data.serial);
      if (data.url) {
        successImpact();
        await openExternalUrl(data.url, { fallback: "navigate" });
      }
    } catch (error) {
      const payload = error?.response?.data || error?.data || {};
      toast({
        title: "Couldn't create the pass",
        description: payload.error || error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIssuing("");
    }
  };

  const copy = async () => {
    if (!serial) return;
    try {
      await navigator.clipboard.writeText(serial);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Write the code down instead." });
    }
  };

  return (
    <div className="mt-3 border border-accent/25 bg-accent/[0.04] p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
        <MapPin className="h-3 w-3" /> Collect at the event
      </p>

      {redeemed ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Collected {new Date(order.pass_redeemed_at).toLocaleDateString()}. Nothing further to do.
        </p>
      ) : (
        <>
          {serial ? (
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 select-all border border-border/40 bg-background/60 px-2 py-1.5 font-mono text-sm tracking-[0.15em] text-foreground">
                {serial}
              </code>
              <button
                type="button"
                onClick={copy}
                aria-label="Copy pass code"
                className="touch-target flex items-center justify-center border border-border/40 px-2 text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => issue(undefined)}
              disabled={!!issuing}
              className="mt-2 h-10 w-full rounded-none border-border/50 text-[11px] font-bold uppercase tracking-wider"
            >
              {issuing === "code" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Get my collection code
            </Button>
          )}

          {support?.google && (
            <Button
              type="button"
              onClick={() => issue("google")}
              disabled={!!issuing}
              className="mt-2 h-11 w-full rounded-none bg-foreground text-background text-[11px] font-bold uppercase tracking-wider hover:bg-foreground/90"
            >
              {issuing === "google"
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Wallet className="mr-2 h-4 w-4" />}
              Save to Google Wallet
            </Button>
          )}

          {support?.apple && (
            <Button
              type="button"
              onClick={() => issue("apple")}
              disabled={!!issuing}
              className="mt-2 h-11 w-full rounded-none bg-foreground text-background text-[11px] font-bold uppercase tracking-wider hover:bg-foreground/90"
            >
              {issuing === "apple"
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Wallet className="mr-2 h-4 w-4" />}
              Add to Apple Wallet
            </Button>
          )}

          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            Show this code at the Rugby League Takeover stand with photo ID. It can only be collected once.
          </p>
        </>
      )}
    </div>
  );
}
