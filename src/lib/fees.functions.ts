import { createServerFn } from "@tanstack/react-start";
import { calculateChallengeFee, calculateFee, calculateTournamentFee, type FeeBreakdown } from "./fees";

/** Generic: split any pool. */
export const quoteFee = createServerFn({ method: "POST" })
  .inputValidator((input: { pool: number }) => ({ pool: Number(input.pool) || 0 }))
  .handler(async ({ data }): Promise<FeeBreakdown> => calculateFee(data.pool));

/** Tournament quote: entry_fee × player_count. */
export const quoteTournamentFee = createServerFn({ method: "POST" })
  .inputValidator((input: { entryFee: number; playerCount: number }) => ({
    entryFee: Number(input.entryFee) || 0,
    playerCount: Math.max(0, Math.floor(Number(input.playerCount) || 0)),
  }))
  .handler(async ({ data }): Promise<FeeBreakdown> =>
    calculateTournamentFee(data.entryFee, data.playerCount),
  );

/** 1v1 challenge quote: entry_amount × 2. */
export const quoteChallengeFee = createServerFn({ method: "POST" })
  .inputValidator((input: { entryAmount: number }) => ({ entryAmount: Number(input.entryAmount) || 0 }))
  .handler(async ({ data }): Promise<FeeBreakdown> => calculateChallengeFee(data.entryAmount));
