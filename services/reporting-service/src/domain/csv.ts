// CSV export of a report. UTF-8 with a byte-order mark (so Excel shows Thai text correctly) and CRLF line ends.

export interface Column<T> { header: string; value: (row: T) => string | number | boolean | null | undefined }

// A cell that starts with = + - @ (or a tab / carriage return) would be run as a formula by a spreadsheet. Text coming
// from users (vehicle codes, job names, addresses, alert titles) could use that, so such text gets a leading apostrophe.
// Numbers are written as they are; only strings are changed.
function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv<T>(columns: Column<T>[], rows: T[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(","), ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function csvResponse(name: string, csv: string, now = new Date()) {
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}-${now.toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
