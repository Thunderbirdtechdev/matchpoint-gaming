/**
 * Module 8 — Financial dashboard.
 *
 * Its own route rather than another card on /admin, because Module 7 split
 * operations from treasury and this is the treasury view: a financial_admin
 * holds no moderation capability, so sending them to /admin to read revenue
 * would mean walking past tooling they cannot use.
 *
 * Read-only. Everything that moves money stays on /admin and /payouts.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, RefreshCw, TrendingUp, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { RequireCapability } from "@/components/dashboard/RequireCapability";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LiabilityPanel } from "@/components/finance/LiabilityPanel";
import { RevenueChart } from "@/components/finance/RevenueChart";
import { RANGE_PRESETS, resolveRange, type RangePresetId } from "@/components/finance/range";
import {
  getRevenueDaily,
  getRevenueBySourceRange,
  getPlatformLiabilities,
  getFinanceExportRows,
} from "@/lib/finance.functions";
import { toCsv, csvAmount, csvDate, downloadCsv, type CsvColumn } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Finance | MatchPoint" }] }),
  component: FinancePage,
});

const SOURCE_LABELS: Record<string, string> = {
  challenge_fee: "1v1 challenge fees",
  tournament_fee: "Tournament fees",
  withdrawal_fee_same_day: "Same-day withdrawal fees",
  withdrawal_fee_standard: "Standard withdrawal fees",
  crypto_payout: "Crypto payout fees",
};

function usd(cents: number | null | undefined) {
  return `$${(((cents ?? 0) as number) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type Row = Record<string, unknown>;

/** Column layouts live beside the page that shows the data, not on the server. */
const EXPORTS: Record<string, { label: string; filename: string; columns: CsvColumn<Row>[] }> = {
  fees: {
    label: "Fee revenue",
    filename: "platform-fees",
    columns: [
      { header: "Date (UTC)", value: (r) => csvDate(r.created_at as string) },
      { header: "Source", value: (r) => SOURCE_LABELS[r.source as string] ?? r.source },
      { header: "Username", value: (r) => r._username },
      { header: "Fee (USD)", value: (r) => csvAmount(r.amount_cents as number) },
      { header: "Gross (USD)", value: (r) => csvAmount(r.gross_cents as number) },
      { header: "Net (USD)", value: (r) => csvAmount(r.net_cents as number) },
      { header: "Reference", value: (r) => r.reference_id },
      { header: "Fee ID", value: (r) => r.id },
    ],
  },
  payouts: {
    label: "Player payouts",
    filename: "player-payouts",
    columns: [
      { header: "Date (UTC)", value: (r) => csvDate(r.created_at as string) },
      { header: "Username", value: (r) => r._username },
      { header: "Method", value: (r) => r.method },
      { header: "Speed", value: (r) => r.speed },
      { header: "Handle", value: (r) => r.handle },
      { header: "Status", value: (r) => r.status },
      { header: "Gross (USD)", value: (r) => csvAmount(r.amount_cents as number) },
      { header: "Fee (USD)", value: (r) => csvAmount(r.fee_cents as number) },
      { header: "Net paid (USD)", value: (r) => csvAmount(r.net_cents as number) },
      { header: "Processed (UTC)", value: (r) => csvDate(r.processed_at as string) },
      { header: "Admin note", value: (r) => r.admin_note },
      { header: "Request ID", value: (r) => r.id },
    ],
  },
  withdrawals: {
    label: "Company withdrawals",
    filename: "company-withdrawals",
    columns: [
      { header: "Date (UTC)", value: (r) => csvDate(r.created_at as string) },
      { header: "Destination", value: (r) => r.destination },
      { header: "Amount (USD)", value: (r) => csvAmount(r.amount_cents as number) },
      { header: "Note", value: (r) => r.note },
      { header: "Withdrawal ID", value: (r) => r.id },
    ],
  },
};

function FinancePage() {
  const [preset, setPreset] = useState<RangePresetId>("30d");
  const range = useMemo(() => resolveRange(preset), [preset]);

  const dailyFn = useServerFn(getRevenueDaily);
  const sourceFn = useServerFn(getRevenueBySourceRange);
  const liabilitiesFn = useServerFn(getPlatformLiabilities);
  const exportFn = useServerFn(getFinanceExportRows);

  const dailyQ = useQuery({
    queryKey: ["finance-daily", range.from, range.to],
    queryFn: () => dailyFn({ data: range }),
  });
  const sourceQ = useQuery({
    queryKey: ["finance-by-source", range.from, range.to],
    queryFn: () => sourceFn({ data: range }),
  });
  const liabilitiesQ = useQuery({
    queryKey: ["finance-liabilities"],
    queryFn: () => liabilitiesFn(),
    refetchInterval: 60_000,
  });

  const [exporting, setExporting] = useState<string | null>(null);

  async function runExport(dataset: keyof typeof EXPORTS) {
    setExporting(dataset);
    try {
      const spec = EXPORTS[dataset];
      const res = await exportFn({ data: { ...range, dataset } });
      if (!res.rows.length) {
        toast.info(`No ${spec.label.toLowerCase()} in this period.`);
        return;
      }
      downloadCsv(
        `matchpoint-${spec.filename}-${range.from}-to-${range.to}.csv`,
        toCsv(res.rows as Row[], spec.columns),
      );
      // Never let a truncated financial export pass quietly — someone
      // reconciles against it and the missing rows read as missing money.
      if (res.truncated) {
        toast.warning(
          `Exported the ${res.limit} most recent of ${res.total_count} rows. Narrow the date range to get the rest.`,
        );
      } else {
        toast.success(`Exported ${res.rows.length} row${res.rows.length === 1 ? "" : "s"}.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  const sourceRows = sourceQ.data ?? [];
  const sourceTotal = sourceRows.reduce((s, r) => s + r.total_cents, 0);

  /**
   * A failed query must never be shown as an empty period.
   *
   * Without this the chart falls back to "No data for this range" whenever the
   * request throws, which reads as "we earned nothing" — the single most
   * misleading thing a financial dashboard can say. PGRST202 (the reporting
   * functions not being installed yet) is called out by name because it is the
   * one failure with a specific, actionable fix.
   */
  const failure = [dailyQ.error, sourceQ.error, liabilitiesQ.error].find(Boolean) as
    | Error
    | undefined;
  const migrationMissing = failure?.message?.includes("PGRST202");

  return (
    <RequireCapability
      capability="finance.view"
      title="Finance"
      subtitle="Revenue, obligations and exports."
    >
      <Link
        to="/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to admin
      </Link>

      {failure && (
        <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-red-300">
                {migrationMissing
                  ? "Reporting functions are not installed yet"
                  : "Could not load financial data"}
              </h2>
              <p className="mt-1 text-xs text-red-100/80">
                {migrationMissing ? (
                  <>
                    Run{" "}
                    <code className="rounded bg-black/30 px-1">
                      20260904120000_finance_dashboard_reporting.sql
                    </code>{" "}
                    in the Lovable SQL editor. Nothing below is accurate until it has run, treat any
                    zero on this page as unknown, not as zero.
                  </>
                ) : (
                  <>
                    Figures on this page may be missing or stale. Do not reconcile against them.{" "}
                    {failure.message}
                  </>
                )}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 border-red-500/40 text-red-200 hover:bg-red-500/10"
                onClick={() => {
                  dailyQ.refetch();
                  sourceQ.refetch();
                  liabilitiesQ.refetch();
                }}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {!liabilitiesQ.error && (
        <LiabilityPanel data={liabilitiesQ.data} isLoading={liabilitiesQ.isPending} />
      )}

      <div className="mt-6 rounded-2xl border border-border/60 bg-gradient-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <TrendingUp className="h-4 w-4" /> Fee revenue
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Daily platform fees, bucketed by UTC day.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-surface/40 p-1">
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                    preset === p.id
                      ? "bg-primary/20 font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                dailyQ.refetch();
                sourceQ.refetch();
                liabilitiesQ.refetch();
              }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${dailyQ.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat
            label="Revenue in range"
            value={dailyQ.isPending ? null : usd(dailyQ.data?.total_cents)}
            accent
          />
          <Stat
            label="Fee events"
            value={dailyQ.isPending ? null : String(dailyQ.data?.event_count ?? 0)}
          />
          <Stat
            label="Daily average"
            value={
              dailyQ.isPending
                ? null
                : usd(
                    Math.round(
                      (dailyQ.data?.total_cents ?? 0) /
                        Math.max(1, dailyQ.data?.series.length ?? 1),
                    ),
                  )
            }
          />
        </div>

        <div className="mt-5">
          <RevenueChart series={dailyQ.data?.series} isLoading={dailyQ.isPending} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Breakdown */}
        <div className="rounded-2xl border border-border/60 bg-gradient-card p-5">
          <h2 className="text-base font-semibold">Where it came from</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Same date range as the chart above.
          </p>

          <div className="mt-4 space-y-3">
            {sourceQ.isPending ? (
              <>
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </>
            ) : !sourceRows.length ? (
              <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                No fee revenue in this period.
              </div>
            ) : (
              sourceRows.map((r) => {
                const pct = sourceTotal > 0 ? (r.total_cents / sourceTotal) * 100 : 0;
                return (
                  <div key={r.source}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{SOURCE_LABELS[r.source] ?? r.source}</span>
                      <span className="tabular-nums text-success">{usd(r.total_cents)}</span>
                    </div>
                    {/* The bar carries the proportion; the caption carries the
                        numbers. Percentage alone hides that "100% of revenue"
                        can mean a single $2 fee. */}
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-gradient-brand"
                        style={{ width: `${Math.max(pct, 1.5)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {pct.toFixed(1)}% · {r.event_count} event
                      {r.event_count === 1 ? "" : "s"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Exports */}
        <div className="rounded-2xl border border-border/60 bg-gradient-card p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Download className="h-4 w-4" /> Export
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            CSV for the selected range ({range.from} to {range.to}), ready for a spreadsheet or your
            accountant.
          </p>

          <div className="mt-4 space-y-2">
            {(Object.keys(EXPORTS) as (keyof typeof EXPORTS)[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => runExport(key)}
                disabled={exporting !== null}
                className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-surface/30 px-4 py-3 text-left transition hover:border-border hover:bg-surface/50 disabled:opacity-60"
              >
                <div>
                  <div className="text-sm font-medium">{EXPORTS[key].label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {EXPORTS[key].columns.length} columns
                  </div>
                </div>
                {exporting === key ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Download className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            ))}
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Amounts are plain decimals so spreadsheets read them as numbers. Cells beginning with a
            formula character are prefixed with a tab, which stops Excel executing text a player
            chose, a display name or payout handle can otherwise run on open.
          </p>
        </div>
      </div>
    </RequireCapability>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | null; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? "border-primary/40 bg-primary/5" : "border-border/50 bg-surface/30"
      }`}
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {value === null ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <div className={`mt-1 text-xl font-semibold tabular-nums ${accent ? "text-primary" : ""}`}>
          {value}
        </div>
      )}
    </div>
  );
}
