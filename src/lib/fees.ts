/**
 * MatchPoint tiered service fee.
 *
 * Fee is calculated against the TOTAL prize pool (sum of all entry fees).
 * Lower rates on bigger pools to incentivize larger events.
 *
 *   Pool size       Rate
 *   $0   – $9.99    10%
 *   $10  – $49.99    8%
 *   $50  – $99.99    6%
 *   $100+            5%
 */

export type FeeTier = {
  minPool: number;
  maxPool: number; // exclusive upper bound; Infinity for top tier
  rate: number; // 0..1
  label: string;
};

export const FEE_TIERS: ReadonlyArray<FeeTier> = [
  { minPool: 0, maxPool: 10, rate: 0.10, label: "$0 – $9.99" },
  { minPool: 10, maxPool: 50, rate: 0.08, label: "$10 – $49.99" },
  { minPool: 50, maxPool: 100, rate: 0.06, label: "$50 – $99.99" },
  { minPool: 100, maxPool: Infinity, rate: 0.05, label: "$100+" },
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
    if (p >= t.minPool && p < t.maxPool) return t;
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
