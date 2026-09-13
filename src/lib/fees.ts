/**
 * Floors on the three amounts a player can choose, in USD.
 *
 * Lowered from $10 so a newer platform is not asking for a $10 commitment
 * before anyone has seen a match run. They move together on purpose: a deposit
 * floor above the entry floor leaves money that cannot be staked, and a
 * withdrawal floor above either strands a player who deposited the minimum,
 * played it, and then cannot take their winnings out.
 *
 * Card processing is the reason these have a floor at all — Stripe takes
 * roughly 2.9% + 30c, so a $5 deposit costs about 45c before anyone plays. The
 * 10% fee on the resulting $10 pool covers it, but the margin is thinner than
 * it was at $10, which is the trade for the lower barrier.
 */
export const MIN_ENTRY_USD = 5;
export const MIN_DEPOSIT_USD = 5;
export const MIN_WITHDRAWAL_USD = 5;

/**
 * Supported games.
 *
 * Slugs are stable identifiers stored in the database (`challenges.game_slug`,
 * `tournaments.game_slug`), so they deliberately do NOT carry a year — only the
 * display labels do. That way next season's rename is a one-line label change
 * and never a data migration.
 */
export const SUPPORTED_GAMES = ["fortnite", "nba2k", "madden", "ncaa", "mlbshow"] as const;
export type SupportedGame = (typeof SUPPORTED_GAMES)[number];

/**
 * Platforms a match can be played on.
 *
 * "Crossplay" is not a console — it is the player saying the platform does not
 * matter, which most of these titles now support. It sits in the same list
 * because that is the one question the challenge form asks, and splitting it
 * into a separate toggle would make every existing challenge ambiguous about
 * whether it had opted in.
 *
 * Stored as free text on `challenges.platform`, so adding one is a code change
 * and never a migration. Kept here rather than in each route because two copies
 * had already drifted apart once.
 */
export const PLATFORMS = ["PC", "PlayStation", "Xbox", "Switch", "Crossplay"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const GAME_LABELS: Record<SupportedGame, string> = {
  fortnite: "Fortnite",
  nba2k: "NBA 2K27",
  madden: "Madden NFL 27",
  ncaa: "NCAA 27",
  mlbshow: "MLB The Show 26",
};

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
  { minPool: 0, maxPool: 25, rate: 0.1, label: "$1 – $25" },
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
  const pool = round2(
    Math.max(0, Number(entryFee) || 0) * Math.max(0, Math.floor(Number(playerCount) || 0)),
  );
  return calculateFee(pool);
}

/** 1v1 challenge: pool = entryAmount * 2 (both players pay). */
export function calculateChallengeFee(entryAmount: number): FeeBreakdown {
  const pool = round2(Math.max(0, Number(entryAmount) || 0) * 2);
  return calculateFee(pool);
}

/* =========================================================================
 *  Withdrawal fees
 *
 *  Standard payouts (2–5 business days) are FREE.
 *  Same-day payouts cost a flat 8% of the amount withdrawn — no tiers, no
 *  minimum, the same rate at $10 as at $5,000.
 *
 *  Flat on purpose. Kevin asked for percentage-based pricing after tiered
 *  flat fees, and a single rate is the version a player can check in their
 *  head before they tap the button. A tier table only earns its complexity if
 *  the rate actually changes across it.
 * ========================================================================= */

export type WithdrawalSpeed = "standard" | "same_day";

/** Same-day withdrawal fee, as a fraction of the gross amount. */
export const SAME_DAY_WITHDRAWAL_RATE = 0.08;

export type WithdrawalFeeBreakdown = {
  speed: WithdrawalSpeed;
  grossCents: number;
  feeCents: number;
  netCents: number;
  /** Percentage rate charged (0..1); 0 for standard payouts. */
  rate: number;
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
      rate: 0,
      tierLabel: "Free",
      etaLabel: "2–5 business days",
    };
  }
  // Capped at the withdrawal itself so a rounding edge can never return a
  // negative net.
  const fee = Math.min(gross, Math.round(gross * SAME_DAY_WITHDRAWAL_RATE));
  return {
    speed,
    grossCents: gross,
    feeCents: fee,
    netCents: Math.max(0, gross - fee),
    rate: SAME_DAY_WITHDRAWAL_RATE,
    tierLabel: "8% of the amount",
    etaLabel: "Typically 30 minutes – 5 hours",
  };
}
