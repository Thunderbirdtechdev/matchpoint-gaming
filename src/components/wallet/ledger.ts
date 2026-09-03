/**
 * Presentation rules for the nine `wallet_tx_type` values.
 *
 * `txLabel` used to be `type.replace(/_/g, " ")`, which rendered "escrow hold"
 * and "prize payout" — accurate but not language a player recognises on a
 * statement. These map each type to how it should read, and to whether it moved
 * money in or out.
 */

export const LEDGER_TYPES = [
  "deposit",
  "withdrawal",
  "entry_fee",
  "prize_payout",
  "platform_fee",
  "refund",
  "escrow_hold",
  "escrow_release",
  "adjustment",
] as const;

export type LedgerType = (typeof LEDGER_TYPES)[number];

export const TYPE_LABELS: Record<LedgerType, string> = {
  deposit: "Deposit",
  withdrawal: "Cash out",
  entry_fee: "Entry fee",
  prize_payout: "Prize won",
  platform_fee: "Platform fee",
  refund: "Refund",
  escrow_hold: "Staked in match",
  escrow_release: "Stake released",
  adjustment: "Adjustment",
};

export const TYPE_HINTS: Record<LedgerType, string> = {
  deposit: "Money added from your card",
  withdrawal: "Money sent to your bank",
  entry_fee: "Paid to enter a competition",
  prize_payout: "Winnings credited to your wallet",
  platform_fee: "MatchPoint's cut, taken when a match settles",
  refund: "Returned to you — cancelled or refunded",
  escrow_hold: "Locked while your match is live",
  escrow_release: "Unlocked when the match resolved",
  adjustment: "Manual correction by our team",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  completed: "Completed",
  failed: "Failed",
  reversed: "Reversed",
};

export function typeLabel(type: string): string {
  return TYPE_LABELS[type as LedgerType] ?? type.replace(/_/g, " ");
}

export function typeHint(type: string): string | null {
  return TYPE_HINTS[type as LedgerType] ?? null;
}

export function fmtCents(cents: number): string {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}
