import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
const orders = () => read("../src/components/admin/OrdersManager.jsx");

// The old printer did `window.open("", "_blank")` + document.write + an injected
// auto-print script. In Android WebViews that produced a blank about:blank tab
// where the script never ran and there was no button to print manually.
test("packing slip no longer prints through a pop-up window", () => {
  const source = orders();
  assert.ok(!source.includes('window.open("", "_blank"'), "must not open a blank pop-up to print");
  assert.ok(!source.includes("win.document.write"), "must not document.write a print page");
  assert.ok(source.includes("OrderLabelSheet"), "orders must render the in-page label sheet");
});

test("label sheet renders in-page, offers stock sizes and an explicit Print action", () => {
  const source = read("../src/components/admin/OrderLabelSheet.jsx");
  assert.ok(source.includes("createPortal"), "label sheet should portal so it is a sibling of #root");
  assert.ok(source.includes("window.print()"), "there must be a real Print button, not only auto-print");
  // Size customisation — several real-world stocks, not one hardcoded page.
  for (const key of ["thermal4x6", "a6", "a5", "a4", "dymo99014"]) {
    assert.ok(source.includes(key), `label sizes must include ${key}`);
  }
  assert.ok(/@page \{ size: \$\{size\.width\}mm \$\{size\.height\}mm/.test(source),
    "the chosen stock must drive the @page size so a 4x6 label doesn't print on A4");
});

test("print CSS isolates the label from the admin UI", () => {
  const css = read("../src/index.css");
  assert.ok(css.includes("@media print"), "a print stylesheet must exist");
  const printBlock = css.slice(css.indexOf("@media print"));
  assert.ok(/#root \{ display: none !important; \}/.test(printBlock), "the app must be hidden while printing");
  assert.ok(printBlock.includes(".rlt-print-chrome"), "the size picker / buttons must not print");
  assert.ok(printBlock.includes(".rlt-print-label"), "the label itself must remain printable");
});

// Exporting orders for a postage run is useless without the destination.
test("order CSV export includes the shipping address", () => {
  const source = orders();
  for (const column of ["Ship To Name", "Address 1", "Address 2", "Suburb", "State", "Postcode", "Country", "Shipping Address"]) {
    assert.ok(source.includes(`"${column}"`), `CSV export must include a ${column} column`);
  }
  assert.ok(source.includes("o.shipping_address_line1"), "export must read the structured address fields");
  assert.ok(
    source.includes('orderAddressText(o).replace(/\\n/g, ", ")'),
    "the combined address column must be flattened so newlines don't split the CSV row"
  );
});
