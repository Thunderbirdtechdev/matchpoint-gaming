/**
 * Module 8 — the date range shared by the chart, the breakdown and the CSV.
 *
 * One source of truth on purpose: an export whose period differs from what is
 * on screen is worse than no export, because it looks authoritative.
 *
 * Days are UTC to match the SQL side, which buckets on UTC (see the timezone
 * note in 20260904120000_finance_dashboard_reporting.sql). Building these from
 * local time would put the browser's idea of "today" a day out from the
 * server's for anyone west of UTC.
 */

export type RangePresetId = "7d" | "30d" | "90d" | "ytd" | "all";

export type DateRange = { from: string; to: string };

/** Earliest plausible data. The platform has no fee events before this. */
const EPOCH = "2026-06-01";

function toUtcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export const RANGE_PRESETS: { id: RangePresetId; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "ytd", label: "Year to date" },
  { id: "all", label: "All time" },
];

export function resolveRange(preset: RangePresetId, now = new Date()): DateRange {
  const to = toUtcDay(now);

  switch (preset) {
    // -6 rather than -7: a "7 days" window that includes today spans 7 days
    // inclusive, not 8. Off-by-one here shows up as a stray empty column.
    case "7d":
      return { from: toUtcDay(shiftDays(now, -6)), to };
    case "30d":
      return { from: toUtcDay(shiftDays(now, -29)), to };
    case "90d":
      return { from: toUtcDay(shiftDays(now, -89)), to };
    case "ytd":
      return { from: `${now.getUTCFullYear()}-01-01`, to };
    case "all":
      return { from: EPOCH, to };
  }
}

/** "Jun 3" / "Jun 3, 2026" — axis and tooltip labels. */
export function formatDay(day: string, withYear = false): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}
