import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Users, ShoppingCart, MessageSquare, FileSpreadsheet, Clock, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { toast } from "@/components/ui/use-toast";
import { downloadCsv } from "@/lib/csv";
import { isNativeApp } from "@/lib/native/native-env";
import PullToRefresh from "@/components/PullToRefresh";
import { emitHaptic } from "@/lib/native/haptic-events";
import NativeTopBar from "../../components/NativeTopBar.jsx";
import { NativeSkeleton, NativeEmptyState } from "../../components/NativePrimitives.jsx";
import {
  EXPORT_DATASETS,
  LS_KEYS,
  datasetHeaders,
  datasetRows,
  datasetFilename,
  toCsvString,
  formatTimestamp,
  recordCount,
} from "./export-helpers.js";

/**
 * Native Data Export workflow — /admin/more/export. Read-only over three
 * shared query keys (registrations / orders / forumPosts, identical to the
 * web ExportModule wrapper), so the cache stays shared with the web panels.
 *
 * The web DataExporter builds a CSV blob and triggers an <a download> click.
 * That anchor download is silently swallowed inside a WKWebView, so the
 * native path routes the same CSV through the system share sheet
 * (@capacitor/share, dynamically imported). On the plain web/PWA it mirrors
 * the web exactly via @/lib/csv downloadCsv. Either way it writes the same
 * `rlt_export_ts_<dataset>` localStorage timestamp the web writes. Export
 * touches no entity and the web dispatches no rlt_admin_log events, so neither
 * does this.
 */

// Icon + accent styling by dataset id (kept out of the pure helpers).
const DATASET_STYLE = {
  registrations: { icon: Users, tone: "text-cyan-400", border: "border-cyan-500/30", bg: "bg-cyan-500/10" },
  orders: { icon: ShoppingCart, tone: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10" },
  forum: { icon: MessageSquare, tone: "text-violet-400", border: "border-violet-500/30", bg: "bg-violet-500/10" },
};

const EXPORT_QUERY_KEYS = [["registrations"], ["orders"], ["forumPosts"]];

const useExportData = () => {
  const registrations = useQuery({
    queryKey: ["registrations"],
    queryFn: () => base44.entities.InterestRegistration.list("-created_date", 200),
    enabled: appParams.hasBase44Config,
    staleTime: 60000,
  });
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: () => base44.entities.StoreOrder.list("-created_date", 200),
    enabled: appParams.hasBase44Config,
    staleTime: 60000,
  });
  const forumPosts = useQuery({
    queryKey: ["forumPosts"],
    queryFn: () => base44.entities.ForumPost.list("-created_date", 200),
    enabled: appParams.hasBase44Config,
    staleTime: 60000,
  });
  return {
    dataMap: {
      registrations: registrations.data || [],
      orders: orders.data || [],
      forumPosts: forumPosts.data || [],
    },
    isLoading: registrations.isLoading || orders.isLoading || forumPosts.isLoading,
  };
};

const readLastExport = (id) => {
  try {
    return localStorage.getItem(LS_KEYS[id]) || null;
  } catch {
    return null;
  }
};

const writeLastExport = (id, ts) => {
  try {
    localStorage.setItem(LS_KEYS[id], ts);
  } catch {
    // localStorage unavailable — silently ignore (web parity).
  }
};

/**
 * Deliver the CSV: native share sheet inside the shell, blob download on web.
 * Returns "shared" | "downloaded" | "dismissed" | "failed".
 */
async function deliverCsv({ dataset, headers, rows }) {
  const filename = datasetFilename(dataset);
  if (isNativeApp()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({
        title: filename,
        text: toCsvString(headers, rows),
        dialogTitle: `Export ${dataset.title}`,
      });
      return "shared";
    } catch (error) {
      // Closing the share sheet rejects with a cancellation message — a normal
      // outcome, not a failure to report or record.
      if (/cancel/i.test(String(error?.message || error))) return "dismissed";
      return "failed";
    }
  }
  downloadCsv(filename, headers, rows);
  return "downloaded";
}

/** Single dataset export card. */
function ExportCard({ dataset, data }) {
  const style = DATASET_STYLE[dataset.id];
  const Icon = style.icon;
  const count = recordCount(data);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [lastExport, setLastExport] = useState(() => readLastExport(dataset.id));

  const disabled = count === 0 || busy;

  const runExport = async () => {
    if (count === 0 || busy) return;
    emitHaptic("action.primary");
    setBusy(true);
    const headers = datasetHeaders(dataset.columns);
    const rows = datasetRows(dataset.columns, data);
    const result = await deliverCsv({ dataset, headers, rows });
    setBusy(false);

    if (result === "shared" || result === "downloaded") {
      const ts = new Date().toISOString();
      writeLastExport(dataset.id, ts);
      setLastExport(ts);
      setDone(true);
      emitHaptic("save.success");
      setTimeout(() => setDone(false), 1200);
    } else if (result === "failed") {
      emitHaptic("mutation.error");
      toast({ title: "Export failed", description: "Could not export the CSV. Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="border border-border/60 bg-card/50 p-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center border ${style.border} ${style.bg}`}>
          <Icon className={`h-5 w-5 ${style.tone}`} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">{dataset.title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="font-display text-base tabular-nums text-foreground">{count.toLocaleString()}</span> records
          </p>
        </div>
      </div>

      {lastExport && (
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
          <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>Last export: {formatTimestamp(lastExport)}</span>
        </div>
      )}

      <button
        type="button"
        onClick={runExport}
        disabled={disabled}
        aria-label={`Export ${dataset.title} as CSV`}
        className={`ios-pressable mt-3 flex min-h-11 w-full items-center justify-center gap-2 border px-4 text-xs font-bold uppercase tracking-wider ${
          count === 0
            ? "cursor-not-allowed border-border/30 bg-muted/5 text-muted-foreground/40"
            : done
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : "border-primary/40 bg-primary/10 text-primary"
        } disabled:opacity-60`}
      >
        {done ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
        {done ? "Exported" : busy ? "Exporting…" : "Export CSV"}
      </button>
    </div>
  );
}

/** Native Data Export Centre — /admin/more/export */
export default function NativeExportWorkflow() {
  const { dataMap, isLoading } = useExportData();
  const datasets = useMemo(() => EXPORT_DATASETS, []);
  const totalRecords = datasets.reduce((sum, d) => sum + recordCount(dataMap[d.dataKey]), 0);

  return (
    <div className="pb-10">
      <NativeTopBar title="Export Data" fallback="/admin/more" />
      <PullToRefresh queryKeys={EXPORT_QUERY_KEYS}>
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 border border-border/60 bg-card/50 p-3">
            <div className="flex h-8 w-8 items-center justify-center border border-cyan-500/30 bg-cyan-500/10">
              <FileSpreadsheet className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base uppercase tracking-wide text-foreground leading-none">Data Export Centre</p>
              <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Download platform data as CSV</p>
            </div>
          </div>
        </div>

        {isLoading && totalRecords === 0 ? (
          <div className="space-y-2 px-4 pt-3">
            <NativeSkeleton className="h-32 w-full" />
            <NativeSkeleton className="h-32 w-full" />
            <NativeSkeleton className="h-32 w-full" />
          </div>
        ) : totalRecords === 0 ? (
          <div className="px-4 pt-4">
            <NativeEmptyState icon={Download} title="Nothing to export yet" description="Registrations, orders and forum posts appear here as fans use the platform." />
          </div>
        ) : (
          <div className="space-y-3 px-4 pt-3">
            {datasets.map((dataset) => (
              <ExportCard key={dataset.id} dataset={dataset} data={dataMap[dataset.dataKey]} />
            ))}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
