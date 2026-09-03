/**
 * Module 8 — daily fee revenue.
 *
 * A bar chart rather than a line or area. Fee revenue is a count of discrete
 * events on discrete days, not a continuous quantity being sampled: a line
 * implies the value passed through the points in between, which for "revenue
 * on a day with no matches" is not just imprecise but wrong. Bars also make a
 * zero day visibly zero instead of a dip in a curve.
 *
 * The series arrives gap-filled from SQL, so every day in the range has a bar.
 */

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay } from "./range";

type Point = { day: string; total_cents: number; event_count: number };

function usdCompact(cents: number) {
  const d = cents / 100;
  if (d >= 1000) return `$${(d / 1000).toFixed(d >= 10000 ? 0 : 1)}k`;
  return `$${d.toFixed(0)}`;
}

function TooltipCard({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border/60 bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
      <div className="text-xs font-medium">{formatDay(p.day, true)}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-primary">
        ${(p.total_cents / 100).toFixed(2)}
      </div>
      <div className="text-[11px] text-muted-foreground">
        {p.event_count} fee event{p.event_count === 1 ? "" : "s"}
      </div>
    </div>
  );
}

export function RevenueChart({
  series,
  isLoading,
}: {
  series: Point[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  const data = series ?? [];
  const hasRevenue = data.some((d) => d.total_cents > 0);

  if (!data.length) {
    return (
      <div className="grid h-64 place-items-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground">
        No data for this range.
      </div>
    );
  }

  // An all-zero range still renders the axis and bars rather than an empty
  // state: "we earned nothing across these 30 days" is a real answer, and
  // replacing it with "no data" would suggest the query failed instead.
  return (
    <div className="relative">
      {!hasRevenue && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            No fee revenue in this period
          </span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={256}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
          <XAxis
            dataKey="day"
            tickFormatter={(d: string) => formatDay(d)}
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            tickLine={false}
            axisLine={false}
            // Cap the number of labels so a 90-day range does not overlap them
            // into an unreadable smear.
            interval={Math.max(0, Math.floor(data.length / 8) - 1)}
          />
          <YAxis
            tickFormatter={(v: number) => usdCompact(v)}
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip content={<TooltipCard />} cursor={{ className: "fill-primary/10" }} />
          <Bar
            dataKey="total_cents"
            radius={[3, 3, 0, 0]}
            className="fill-primary"
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
