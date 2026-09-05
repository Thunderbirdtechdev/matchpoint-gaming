/**
 * "Keep it on MatchPoint."
 *
 * The single most damaging thing two players can agree to is settling a match
 * off the platform. It removes escrow, so a loser who simply does not pay
 * cannot be made to; it removes the dispute route, because there is no match
 * record to review; and it removes the fee, so the platform funds the
 * matchmaking and carries the support burden for a transaction it never sees.
 *
 * The people most likely to accept that offer are new players who do not yet
 * know what escrow is protecting them from, which is why this is worded as
 * what THEY lose rather than what the platform loses.
 *
 * Shown wherever a player is about to deal with a stranger — the marketplace
 * and the match page today, and every chat surface when those land.
 */

import { ShieldAlert } from "lucide-react";

export function OffPlatformNotice({
  variant = "full",
  className = "",
}: {
  /** `compact` is a single line, for placing under a form or inside a panel. */
  variant?: "full" | "compact";
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <p
        className={`flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground ${className}`}
      >
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span>
          Keep payments on MatchPoint. Money sent by Cash App, Venmo, Zelle or bank transfer is not
          held in escrow and cannot be recovered or disputed.
        </span>
      </p>
    );
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 ${className}`}
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="min-w-0 text-xs leading-relaxed">
        <p className="font-semibold text-foreground">Never pay or accept payment off MatchPoint.</p>
        <p className="mt-1 text-muted-foreground">
          Every stake here is held in escrow until the result is confirmed, so neither player can
          take the money and walk. If you agree to settle by Cash App, Venmo, Zelle, PayPal, gift
          card or crypto, none of that applies: we cannot recover your money, and you cannot open a
          dispute. Report anyone who asks you to.
        </p>
      </div>
    </div>
  );
}
