import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Address label / packing slip printer.
 *
 * Replaces the old `window.open("", "_blank") + document.write + auto
 * window.print()` approach, which on Android (and inside the installed app's
 * WebView) opened a blank `about:blank` tab where the injected auto-print script
 * never ran and there was no button to print manually — the reported "there's no
 * button to actually print it out". Rendering the label in-page and printing the
 * real document avoids pop-up blockers and WebView scripting limits entirely.
 *
 * Print isolation is done in CSS (see index.css): while printing we hide #root
 * and show only .rlt-print-root, and `@page` is set to the chosen stock so a
 * 100x150mm thermal label no longer prints as a stamp in the corner of A4.
 */

export const LABEL_SIZES = {
  thermal4x6: { label: 'Thermal 4x6" (100 x 150mm)', width: 100, height: 150, margin: 4, scale: 1 },
  a6: { label: "A6 (105 x 148mm)", width: 105, height: 148, margin: 5, scale: 1 },
  a5: { label: "A5 (148 x 210mm)", width: 148, height: 210, margin: 8, scale: 1.25 },
  a4: { label: "A4 (210 x 297mm)", width: 210, height: 297, margin: 12, scale: 1.6 },
  dymo99014: { label: "DYMO 99014 (101 x 54mm)", width: 101, height: 54, margin: 3, scale: 0.72 },
};

export const DEFAULT_LABEL_SIZE = "thermal4x6";

export default function OrderLabelSheet({ open, order, addressText, onClose }) {
  const [sizeKey, setSizeKey] = useState(DEFAULT_LABEL_SIZE);
  const [includeItems, setIncludeItems] = useState(true);

  if (!open || !order || typeof document === "undefined") return null;

  const size = LABEL_SIZES[sizeKey] || LABEL_SIZES[DEFAULT_LABEL_SIZE];
  const orderNo = String(order.id || "").slice(-6).toUpperCase();
  const items = order.line_items || [];
  // A small label has no room for a long item table; the toggle is forced off
  // there so the address never gets pushed off the stock.
  const showItems = includeItems && size.height >= 100;
  const px = (mm) => `${mm * 3.78}px`; // ~96dpi preview so the on-screen size matches the print

  return createPortal(
    <div className="rlt-print-root fixed inset-0 z-[300] flex flex-col bg-black/85 p-4 overflow-y-auto">
      {/* Toolbar — hidden when printing */}
      <div className="rlt-print-chrome mx-auto mb-4 flex w-full max-w-2xl flex-wrap items-center gap-2 border border-border bg-card p-3">
        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Label size
          <select
            value={sizeKey}
            onChange={(e) => setSizeKey(e.target.value)}
            className="h-10 rounded-none border border-border bg-background px-2 text-xs text-foreground"
          >
            {Object.entries(LABEL_SIZES).map(([key, s]) => (
              <option key={key} value={key}>{s.label}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <input
            type="checkbox"
            checked={showItems}
            disabled={size.height < 100}
            onChange={(e) => setIncludeItems(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Include item list
        </label>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => window.print()}
            className="h-10 rounded-none bg-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/90"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
          </Button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close label preview"
            className="flex h-10 w-10 items-center justify-center border border-border text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="w-full text-[10px] leading-relaxed text-muted-foreground">
          Preview is shown at actual size. Choose the stock loaded in your printer, then Print — set your printer scaling to 100% / &quot;Actual size&quot;.
          This is an address slip, not paid postage.
        </p>
      </div>

      {/* The page-size rule has to be injected because @page can't be set inline. */}
      <style>{`@page { size: ${size.width}mm ${size.height}mm; margin: ${size.margin}mm; }`}</style>

      <div
        className="rlt-print-label mx-auto bg-white text-black"
        style={{ width: px(size.width - size.margin * 2), minHeight: px(size.height - size.margin * 2), padding: px(3) }}
      >
        <div style={{ fontSize: `${11 * size.scale}px`, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Rugby League Takeover
        </div>
        <div style={{ fontSize: `${8 * size.scale}px`, color: "#555", marginBottom: px(2) }}>
          Order #{orderNo}
          {order.created_date ? ` · ${new Date(order.created_date).toLocaleDateString()}` : ""}
        </div>

        <div style={{ border: "2px solid #111", padding: px(3), margin: `${px(2)} 0` }}>
          <div style={{ fontSize: `${7 * size.scale}px`, color: "#555", textTransform: "uppercase", letterSpacing: "1px", marginBottom: px(1.5) }}>
            Ship to
          </div>
          <div style={{ fontSize: `${13 * size.scale}px`, lineHeight: 1.35, fontWeight: 700, whiteSpace: "pre-line" }}>
            {addressText || "(no address on file)"}
          </div>
        </div>

        {showItems && items.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: `${9 * size.scale}px`, marginTop: px(2) }}>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td style={{ width: "32px", padding: "3px 0", borderBottom: "1px solid #ddd", verticalAlign: "top" }}>
                    {item.quantity}×
                  </td>
                  <td style={{ padding: "3px 0", borderBottom: "1px solid #ddd", verticalAlign: "top" }}>
                    {item.name}{item.size ? ` (Size ${item.size})` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ fontSize: `${6.5 * size.scale}px`, color: "#666", marginTop: px(2) }}>
          Address/packing slip only · Postage must be purchased separately
        </div>
      </div>
    </div>,
    document.body
  );
}
