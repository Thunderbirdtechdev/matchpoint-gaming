import { Link } from "@tanstack/react-router";
import { Wallet, Lock, Clock, Loader2 } from "lucide-react";
import { IconTile } from "@/components/ui/icon-tile";
import { Status } from "@/components/ui/status";
import { fmtCents } from "./ledger";

export type EscrowHold = {
  id: string;
  amount_cents: number;
  challenge_id: string | null;
  tournament_id: string | null;
  created_at: string;
};

/**
 * Three numbers, because one number lies.
 *
 * `escrow_debit` subtracts a stake from wallets.balance_cents, so a player who
 * enters a $50 match watches their balance fall by $50 with nothing on the page
 * explaining where it went. Available / In escrow / Pending makes that legible.
 */
export function BalanceSummary({
  available,
  escrow,
  pending,
  total,
  holds,
  loading,
}: {
  available: number;
  escrow: number;
  pending: number;
  total: number;
  holds: EscrowHold[];
  loading?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          icon={<Wallet />}
          label="Available"
          value={loading ? null : fmtCents(available)}
          hint="Ready to stake or cash out"
          accent
        />
        <Card
          icon={<Lock />}
          label="In escrow"
          value={loading ? null : fmtCents(escrow)}
          hint={escrow > 0 ? "Locked in live matches" : "Nothing staked right now"}
        />
        <Card
          icon={<Clock />}
          label="Pending"
          value={loading ? null : fmtCents(pending)}
          hint={pending > 0 ? "Deposits still clearing" : "No deposits in flight"}
        />
      </div>

      {!loading && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface/30 px-5 py-3">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Total balance
          </span>
          <span className="font-display text-xl tracking-wide">{fmtCents(total)}</span>
        </div>
      )}

      {holds.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary-glow" />
            <h3 className="text-sm font-semibold">What&rsquo;s locked</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            These stakes return to your available balance when the match resolves.
          </p>
          <ul className="mt-4 divide-y divide-border/50">
            {holds.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  {h.challenge_id ? (
                    <Link
                      to="/match/$id"
                      params={{ id: h.challenge_id }}
                      className="font-medium hover:text-primary-glow"
                    >
                      1v1 challenge
                    </Link>
                  ) : h.tournament_id ? (
                    <Link
                      to="/tournament/$id"
                      params={{ id: h.tournament_id }}
                      className="font-medium hover:text-primary-glow"
                    >
                      Tournament entry
                    </Link>
                  ) : (
                    <span className="font-medium">Staked</span>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    Since {new Date(h.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Status variant="warning">Held</Status>
                  <span className="font-medium">{fmtCents(Number(h.amount_cents))}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Card({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-2">
        <IconTile size="sm">{icon}</IconTile>
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div
        className={`mt-3 font-display text-3xl tracking-wide ${accent ? "text-accent" : "text-foreground"}`}
      >
        {value ?? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
