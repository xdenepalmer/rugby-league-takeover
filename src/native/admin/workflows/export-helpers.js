/**
 * Pure logic for the native Data Export workflow. Mirrors the web
 * DataExporter (src/components/admin/DataExporter.jsx) exactly: the same
 * three datasets, the same column definitions (labels + accessors), the same
 * `rlt-<dataset>-YYYY-MM-DD.csv` filenames, and the same
 * `rlt_export_ts_<dataset>` localStorage keys the web writes to remember the
 * last export.
 *
 * The CSV itself is a client-side download only — it touches no entity — so
 * the native path is free to format the bytes through the shared @/lib/csv
 * quoting (every cell quoted). `toCsvString` reproduces that exact escaping so
 * the native share sheet and the web blob download emit byte-identical files.
 */

// ── localStorage keys (verbatim from the web DataExporter) ────────────────
export const LS_KEYS = {
  registrations: "rlt_export_ts_registrations",
  orders: "rlt_export_ts_orders",
  forum: "rlt_export_ts_forum",
};

// ── Column definitions (verbatim from the web DataExporter) ───────────────
export const REGISTRATION_COLUMNS = [
  { key: "email", label: "Email" },
  { key: "full_name", label: "Full Name" },
  { key: "supporter_group", label: "Supporter Group" },
  { key: "created_date", label: "Created Date" },
];

export const ORDER_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "customer_email", label: "Customer Email" },
  { key: "status", label: "Status" },
  { key: "total_aud", label: "Total (AUD)" },
  { key: "created_date", label: "Created Date" },
  {
    key: "items",
    label: "Items Summary",
    accessor: (row) => {
      if (!row.line_items || !Array.isArray(row.line_items)) return "";
      return row.line_items
        .map((item) => `${item.name || item.title || "Item"} x${item.quantity || 1}`)
        .join("; ");
    },
  },
];

export const FORUM_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "author_name", label: "Author Name" },
  { key: "title", label: "Title" },
  { key: "created_date", label: "Created Date" },
  { key: "is_published", label: "Published" },
  { key: "likes_count", label: "Likes" },
];

// ── Date helpers (verbatim behaviour from the web DataExporter) ────────────
export function todayStamp() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function formatTimestamp(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return d.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Dataset descriptors. `dataKey` is the prop the web DataExporter reads from,
 * and also the react-query key the native module shares with the web wrapper
 * (registrations / orders / forumPosts). Icon + colour styling stays in the
 * JSX; this stays pure so node tests can import it without a DOM.
 */
export const EXPORT_DATASETS = [
  {
    id: "registrations",
    title: "Interest Registrations",
    columns: REGISTRATION_COLUMNS,
    filenamePrefix: "rlt-registrations",
    dataKey: "registrations",
  },
  {
    id: "orders",
    title: "Store Orders",
    columns: ORDER_COLUMNS,
    filenamePrefix: "rlt-orders",
    dataKey: "orders",
  },
  {
    id: "forum",
    title: "Forum Posts",
    columns: FORUM_COLUMNS,
    filenamePrefix: "rlt-forum-posts",
    dataKey: "forumPosts",
  },
];

/** `rlt-registrations-2026-07-13.csv` — mirrors the web filename builders. */
export function datasetFilename(dataset) {
  return `${dataset.filenamePrefix}-${todayStamp()}.csv`;
}

/** Column labels — the CSV header row. */
export function datasetHeaders(columns) {
  return columns.map((c) => c.label);
}

/**
 * Rows as arrays of string cells, applying each column's accessor exactly as
 * the web convertToCSV does (function accessor, else row[key]; null/undefined
 * become ""). Escaping is deferred to toCsvString / @/lib/csv downloadCsv.
 */
export function datasetRows(columns, data) {
  return (data || []).map((row) =>
    columns.map((c) => {
      const raw = typeof c.accessor === "function" ? c.accessor(row) : row[c.key];
      return raw == null ? "" : String(raw);
    })
  );
}

// Same quoting as @/lib/csv (every cell quoted, embedded quotes doubled), so
// the native share text is byte-identical to the web blob download.
const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

/** Full CSV document (header + rows) as a single string for the share sheet. */
export function toCsvString(headers, rows) {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
}

/** Record count shown on a card — web parity: Array.isArray(data) ? length : 0. */
export function recordCount(data) {
  return Array.isArray(data) ? data.length : 0;
}
