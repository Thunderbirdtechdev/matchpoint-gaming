/**
 * MatchPoint tiered service fee.
 *
 * Fee is calculated against the TOTAL prize pool (sum of all entry fees).
 * Lower rates on bigger pools to incentivize larger events.
 *
 *   Pool size         Rate
 *   $1    – $25       10%
 *   $26   – $100       8%
 *   $101  – $500       6%
 *   $501+              5%
 */

export type FeeTier = {
  minPool: number;
  maxPool: number; // inclusive upper bound; Infinity for top tier
  rate: number; // 0..1
  label: string;
};

export const FEE_TIERS: ReadonlyArray<FeeTier> = [
  { minPool: 0, maxPool: 25, rate: 0.10, label: "$1 – $25" },
  { minPool: 25.01, maxPool: 100, rate: 0.08, label: "$26 – $100" },
  { minPool: 100.01, maxPool: 500, rate: 0.06, label: "$101 – $500" },
  { minPool: 500.01, maxPool: Infinity, rate: 0.05, label: "$501+" },
];

export type FeeBreakdown = {
  pool: number;
  rate: number;
  tierLabel: string;
  serviceFee: number;
  netPrize: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function getFeeTier(pool: number): FeeTier {
  const p = Math.max(0, Number(pool) || 0);
  for (const t of FEE_TIERS) {
    if (p >= t.minPool && p <= t.maxPool) return t;
  }
  return FEE_TIERS[FEE_TIERS.length - 1];
}

export function getFeeRate(pool: number): number {
  return getFeeTier(pool).rate;
}

/**
 * Split a pool into service fee + net prize using the tiered rate.
 * Used for escrow payout: keep `serviceFee`, transfer `netPrize` to winner.
 */
export function calculateFee(pool: number): FeeBreakdown {
  const p = round2(Math.max(0, Number(pool) || 0));
  const tier = getFeeTier(p);
  const serviceFee = round2(p * tier.rate);
  const netPrize = round2(p - serviceFee);
  return { pool: p, rate: tier.rate, tierLabel: tier.label, serviceFee, netPrize };
}

/** Tournament: pool = entryFee * playerCount. */
export function calculateTournamentFee(entryFee: number, playerCount: number): FeeBreakdown {
  const pool = round2(Math.max(0, Number(entryFee) || 0) * Math.max(0, Math.floor(Number(playerCount) || 0)));
  return calculateFee(pool);
}

/** 1v1 challenge: pool = entryAmount * 2 (both players pay). */
export function calculateChallengeFee(entryAmount: number): FeeBreakdown {
  const pool = round2(Math.max(0, Number(entryAmount) || 0) * 2);
  return calculateFee(pool);
}

/* =========================================================================
 *  Withdrawal fees
 *  Standard payouts (2–5 business days) are FREE.
 *  Same-day payouts mirror Cash App instant-deposit pricing:
 *    1.5% of the withdrawal amount, minimum $0.25.
 * ========================================================================= */

export type WithdrawalSpeed = "standard" | "same_day";

export type WithdrawalFeeBreakdown = {
  speed: WithdrawalSpeed;
  grossCents: number;
  feeCents: number;
  netCents: number;
  tierLabel: string;
  etaLabel: string;
};

export function calculateWithdrawalFee(
  amountCents: number,
  speed: WithdrawalSpeed,
): WithdrawalFeeBreakdown {
  const gross = Math.max(0, Math.floor(Number(amountCents) || 0));
  if (speed === "standard") {
    return {
      speed,
      grossCents: gross,
      feeCents: 0,
      netCents: gross,
      tierLabel: "Free",
      etaLabel: "2–5 business days",
    };
  }
  // Same-day: 1.5% with a $0.25 (25¢) minimum — matches Cash App instant deposits
  const fee = Math.max(25, Math.round(gross * 0.015));
  const net = Math.max(0, gross - fee);
  return {
    speed,
    grossCents: gross,
    feeCents: fee,
    netCents: net,
    tierLabel: "1.5% (min $0.25)",
    etaLabel: "Typically 30 minutes – 5 hours",
  };
}
