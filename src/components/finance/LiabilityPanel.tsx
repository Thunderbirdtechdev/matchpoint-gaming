/**
 * Module 8 — obligations vs funds held.
 *
 * The rest of the dashboard reports income. This reports exposure, and they
 * answer different questions: revenue can look healthy while the platform is
 * holding less than it owes, and nothing else in the app would say so.
 *
 * Deliberately read-only. The Stripe sweep controls live elsewhere and were
 * left alone.
 */

import { AlertTriangle, ShieldCheck, Wallet, Lock, Send, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Liabilities = {
  player_balance_cents: number;
  escrow_held_cents: number;
  pending_payout_cents: number;
  company_balance_cents: number;
  obligations_cents: number;
  funded_wallet_count: number;
  open_escrow_count: number;
  pending_payout_count: number;
  stripe_available_cents: number | null;
  stripe_pending_cents: number | null;
  stripe_error: string | null;
  coverage_ratio: number | null;
};

function usd(cents: number | null | undefined) {
  return `$${(((cents ?? 0) as number) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Coverage bands.
 *
 * 1.0 is the line that matters — below it the platform is holding less than it
 * owes. 1.1 gives a warning band above it rather than flipping straight from
 * green to red at exactly break-even, because sitting at 1.001 is not a
 * comfortable position to be told is fine.
 */
function band(ratio: number | null) {
  if (ratio === null) return null;
  if (ratio >= 1.1) return { tone: "ok", label: "Fully covered" } as const;
  if (ratio >= 1) return { tone: "warn", label: "Barely covered" } as const;
  return { tone: "bad", label: "Shortfall" } as const;
}

export function LiabilityPanel({
  data,
  isLoading,
}: {
  data: Liabilities | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !data) {
    return <Skeleton className="h-72 w-full rounded-2xl" />;
  }

  const b = band(data.coverage_ratio);
  const shortfall = (data.stripe_available_cents ?? 0) - data.obligations_cents;

  const obligations = [
    {
      label: "Player balances",
      value: data.player_balance_cents,
      sub: `${data.funded_wallet_count} funded wallet${data.funded_wallet_count === 1 ? "" : "s"}`,
      hint: "Spendable money sitting in player wallets.",
      icon: Wallet,
    },
    {
      label: "Locked in escrow",
      value: data.escrow_held_cents,
      sub: `${data.open_escrow_count} open hold${data.open_escrow_count === 1 ? "" : "s"}`,
      hint: "Stakes riding on live matches. Already debited from balances.",
      icon: Lock,
    },
    {
      label: "Payouts promised",
      value: data.pending_payout_cents,
      sub: `${data.pending_payout_count} awaiting send`,
      hint: "Cash-outs approved but not yet paid. Net of withdrawal fees.",
      icon: Send,
    },
  ];

  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Obligations &amp; coverage</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            What the platform owes players, against the settled funds it holds.
          </p>
        </div>

        {b && (
          <div
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
              b.tone === "ok"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : b.tone === "warn"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-red-500/40 bg-red-500/10 text-red-300"
            }`}
          >
            {b.tone === "ok" ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <div className="leading-tight">
              <div className="text-sm font-semibold">{b.label}</div>
              <div className="text-[11px] opacity-80">
                {(data.coverage_ratio! * 100).toFixed(0)}% of obligations held
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Obligations */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {obligations.map((o) => (
          <div key={o.label} className="rounded-xl border border-border/50 bg-surface/30 p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] uppercase tracking-wide">{o.label}</span>
              <o.icon className="h-3.5 w-3.5" />
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{usd(o.value)}</div>
            <div className="text-[11px] text-muted-foreground">{o.sub}</div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground/80">{o.hint}</p>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-surface/40 p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Total owed to players
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {usd(data.obligations_cents)}
          </div>
          <div className="text-[11px] text-muted-foreground">Sum of the three above</div>
        </div>

        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Settled funds held
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-primary">
            {data.stripe_error ? "—" : usd(data.stripe_available_cents)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {data.stripe_error
              ? "Stripe balance unavailable"
              : `Stripe available · ${usd(data.stripe_pending_cents)} still pending`}
          </div>
        </div>

        <div
          className={`rounded-xl border p-4 ${
            data.stripe_error
              ? "border-border/50 bg-surface/30"
              : shortfall >= 0
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-red-500/40 bg-red-500/10"
          }`}
        >
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {shortfall >= 0 ? "Surplus" : "Shortfall"}
          </div>
          <div
            className={`mt-1 text-2xl font-semibold tabular-nums ${
              data.stripe_error ? "" : shortfall >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {data.stripe_error ? "—" : usd(Math.abs(shortfall))}
          </div>
          <div className="text-[11px] text-muted-foreground">Held minus owed</div>
        </div>
      </div>

      {data.stripe_error ? (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100/90">
          <span className="font-medium text-amber-200">Coverage could not be calculated.</span>{" "}
          Obligations above are accurate — they come from the database — but the Stripe balance
          could not be read: {data.stripe_error}
        </div>
      ) : (
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Coverage counts <strong>settled</strong> Stripe funds only; pending Stripe money is real
          but cannot be paid out today. It also excludes anything already swept to the bank, so a
          shortfall here means &ldquo;not covered <em>in Stripe</em>&rdquo; rather than
          &ldquo;insolvent&rdquo; — check the bank before acting on it. Company fee revenue (
          {usd(data.company_balance_cents)}) is an asset, not an obligation, and is excluded from
          the total owed.
        </p>
      )}
    </div>
  );
}
