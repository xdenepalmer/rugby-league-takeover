// Small client-side CSV export helper used across admin tables.
// Usage: downloadCsv("orders.csv", ["Name", "Email"], rows) where each row is an array.
const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export function downloadCsv(filename, headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
