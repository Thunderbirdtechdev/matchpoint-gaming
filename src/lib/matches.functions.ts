import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateChallengeFee, calculateTournamentFee, calculateFee } from "./fees";

const toCents = (usd: number) => Math.round(Number(usd || 0) * 100);

// ─────────────────────────────────────────────────────────────────────────────
// TOURNAMENTS
// ─────────────────────────────────────────────────────────────────────────────

const PayoutPlaceSchema = z.object({
  place: z.number().int().min(1).max(20),
  percent: z.number().min(0).max(100).optional(),
  amount_cents: z.number().int().min(0).optional(),
});

const CreateTournamentSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional().default(""),
  game_slug: z.string().min(1),
  platform: z.string().trim().min(1).max(100),
  max_players: z.number().int().min(2).max(256),
  entry_fee: z.number().min(0).max(5000)
    .refine((v) => v === 0 || v >= 5, { message: "Entry fee must be $0 (free) or at least $5" }),
  prize_pool: z.number().min(0).max(500_000).optional().default(0),
  starts_at: z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid start date" }),
  payout_type: z.enum(["winner_take_all", "fixed", "percentage"]).optional().default("winner_take_all"),
  payout_structure: z.array(PayoutPlaceSchema).max(20).optional().default([]),
}).superRefine((data, ctx) => {
  const places = data.payout_structure.map((p) => p.place);
  if (new Set(places).size !== places.length) {
    ctx.addIssue({ code: "custom", path: ["payout_structure"], message: "Duplicate places in payout structure" });
  }
  if (data.payout_type === "percentage") {
    if (!data.payout_structure.length) {
      ctx.addIssue({ code: "custom", path: ["payout_structure"], message: "Percentage payout requires at least one place" });
      return;
    }
    const total = data.payout_structure.reduce((s, p) => s + (p.percent ?? 0), 0);
    if (Math.round(total) !== 100) {
      ctx.addIssue({ code: "custom", path: ["payout_structure"], message: `Payout percentages must add up to 100% (currently ${total}%)` });
    }
  }
  if (data.payout_type === "fixed") {
    if (!data.payout_structure.length) {
      ctx.addIssue({ code: "custom", path: ["payout_structure"], message: "Fixed payout requires at least one place" });
      return;
    }
    if (data.payout_structure.some((p) => p.amount_cents == null)) {
      ctx.addIssue({ code: "custom", path: ["payout_structure"], message: "Every place needs a fixed dollar amount" });
    }
  }
});

/** Create a tournament. Validates entry-fee floor, player caps, dates, and payout structure server-side. */
export const createTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateTournamentSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t, error } = await supabaseAdmin
      .from("tournaments")
      .insert({
        host_id: context.userId,
        title: data.title,
        description: data.description,
        game_slug: data.game_slug,
        platform: data.platform,
        max_players: data.max_players,
        entry_fee: data.entry_fee,
        prize_pool: data.prize_pool,
        starts_at: new Date(data.starts_at).toISOString(),
        payout_type: data.payout_type,
        payout_structure: data.payout_structure,
      } as never)
      .select()
      .single();
    if (error) throw error;
    return { ok: true, tournament: t };
  });

/** Join a tournament: debit wallet, place entry fee in escrow, insert entry. */
export const joinTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tournament_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: t, error: tErr } = await supabaseAdmin
      .from("tournaments").select("*").eq("id", data.tournament_id).single();
    if (tErr || !t) throw new Error("Tournament not found");
    if (t.status !== "open" && t.status !== "upcoming") throw new Error("Tournament is not open for entry");

    const { count } = await supabaseAdmin
      .from("tournament_entries")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", t.id);
    if ((count ?? 0) >= t.max_players) throw new Error("Tournament is full");

    const { data: existing } = await supabaseAdmin
      .from("tournament_entries")
      .select("id").eq("tournament_id", t.id).eq("user_id", context.userId).maybeSingle();
    if (existing) throw new Error("Already joined");

    const entryCents = toCents(Number(t.entry_fee));

    if (entryCents > 0) {
      const { error: dErr } = await supabaseAdmin.rpc("escrow_debit", {
        _user_id: context.userId,
        _amount_cents: entryCents,
        _tournament_id: t.id,
        _challenge_id: undefined,
        _description: `Entry: ${t.title}`,
      });
      if (dErr) throw new Error(dErr.message);
    }

    const { error: eErr } = await supabaseAdmin
      .from("tournament_entries").insert({ tournament_id: t.id, user_id: context.userId });
    if (eErr) throw eErr;

    return { ok: true };
  });

const DeclareWinnerSchema = z.object({
  tournament_id: z.string().uuid(),
  winners: z.array(z.object({
    user_id: z.string().uuid(),
    place: z.number().int().min(1),
  })).min(1).max(20),
});

/**
 * Host (or admin) declares tournament winner(s). Releases escrow, pays out
 * per the tournament's payout_type (winner_take_all / fixed / percentage),
 * and charges the platform fee.
 */
export const declareTournamentWinner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => DeclareWinnerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: t } = await supabaseAdmin.from("tournaments").select("*").eq("id", data.tournament_id).single();
    if (!t) throw new Error("Tournament not found");
    if (t.status === "completed") throw new Error("Already settled");

    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (t.host_id !== context.userId && !isAdmin) throw new Error("Only the host or an admin can declare the winner");

    const places = data.winners.map((w) => w.place);
    if (new Set(places).size !== places.length) throw new Error("Duplicate places in winners list");
    const userIds = data.winners.map((w) => w.user_id);
    if (new Set(userIds).size !== userIds.length) throw new Error("Duplicate winners");

    const { data: entries } = await supabaseAdmin
      .from("tournament_entries").select("user_id")
      .eq("tournament_id", t.id).in("user_id", userIds);
    const participantIds = new Set((entries ?? []).map((e: { user_id: string }) => e.user_id));
    for (const w of data.winners) {
      if (!participantIds.has(w.user_id)) throw new Error(`One of the selected winners is not a participant`);
    }

    const { data: holds } = await supabaseAdmin
      .from("escrow_holds").select("*")
      .eq("tournament_id", t.id).eq("status", "held");

    let poolCents = 0;
    for (const h of holds ?? []) {
      const amt = await supabaseAdmin.rpc("escrow_resolve", { _hold_id: h.id, _new_status: "released" });
      if (amt.error) throw new Error(amt.error.message);
      poolCents += Number(amt.data);
    }

    const fee = calculateFee(poolCents / 100);
    const feeCents = Math.round(fee.serviceFee * 100);
    const netCents = poolCents - feeCents;

    const tExtra = t as unknown as { payout_type?: string; payout_structure?: unknown };
    const payoutType = (tExtra.payout_type ?? "winner_take_all") as "winner_take_all" | "fixed" | "percentage";
    const structure = (tExtra.payout_structure ?? []) as Array<{ place: number; percent?: number; amount_cents?: number }>;

    const placeAmounts = new Map<number, number>();
    if (payoutType === "winner_take_all") {
      if (data.winners.length !== 1) throw new Error("Winner-take-all tournaments have exactly one winner");
      if (netCents > 0) placeAmounts.set(data.winners[0].place, netCents);
    } else if (payoutType === "percentage") {
      const sorted = [...data.winners].sort((a, b) => a.place - b.place);
      let allocated = 0;
      for (const w of sorted) {
        const entry = structure.find((s) => s.place === w.place);
        if (!entry || entry.percent == null) throw new Error(`No payout percentage configured for place ${w.place}`);
        const amt = Math.round(netCents * (entry.percent / 100));
        placeAmounts.set(w.place, amt);
        allocated += amt;
      }
      // Give any rounding remainder to 1st place so the full net pool is always distributed.
      const remainder = netCents - allocated;
      if (remainder !== 0 && sorted.length) {
        const firstPlace = sorted[0].place;
        placeAmounts.set(firstPlace, (placeAmounts.get(firstPlace) ?? 0) + remainder);
      }
    } else {
      let totalFixed = 0;
      for (const w of data.winners) {
        const entry = structure.find((s) => s.place === w.place);
        if (!entry || entry.amount_cents == null) throw new Error(`No fixed payout configured for place ${w.place}`);
        placeAmounts.set(w.place, entry.amount_cents);
        totalFixed += entry.amount_cents;
      }
      if (totalFixed > netCents) {
        throw new Error(
          `Fixed payouts total $${(totalFixed / 100).toFixed(2)} but the actual prize pool is only $${(netCents / 100).toFixed(2)}. Adjust the payout structure or declare fewer places.`,
        );
      }
    }

    for (const w of data.winners) {
      const amt = placeAmounts.get(w.place) ?? 0;
      if (amt > 0) {
        const { error } = await supabaseAdmin.rpc("wallet_credit", {
          _user_id: w.user_id,
          _amount_cents: amt,
          _type: "prize_payout",
          _description: `Prize (place ${w.place}): ${t.title}`,
          _tournament_id: t.id,
          _challenge_id: undefined,
          _metadata: { pool_cents: poolCents, fee_cents: feeCents, fee_rate: fee.rate, place: w.place, payout_type: payoutType },
        });
        if (error) throw new Error(error.message);
      }
    }

    // Fixed payouts may not consume the whole net pool - sweep any leftover
    // to platform revenue rather than leaving it unaccounted for.
    if (payoutType === "fixed") {
      const totalPaid = Array.from(placeAmounts.values()).reduce((s, v) => s + v, 0);
      const leftover = netCents - totalPaid;
      if (leftover > 0) {
        await supabaseAdmin.rpc("record_platform_fee", {
          _source: "tournament_unclaimed_prize",
          _amount_cents: leftover,
          _reference_id: t.id,
          _gross_cents: poolCents,
          _net_cents: netCents,
          _metadata: { tournament_title: t.title, reason: "fixed payout below net pool" },
        });
      }
    }

    if (feeCents > 0) {
      await supabaseAdmin.rpc("record_platform_fee", {
        _source: "tournament_fee",
        _amount_cents: feeCents,
        _user_id: data.winners[0]?.user_id,
        _reference_id: t.id,
        _gross_cents: poolCents,
        _net_cents: netCents,
        _metadata: { fee_rate: fee.rate, tournament_title: t.title },
      });
    }

    await supabaseAdmin.from("tournaments")
      .update({ status: "completed" })
      .eq("id", t.id);

    return {
      ok: true,
      pool_cents: poolCents,
      fee_cents: feeCents,
      net_cents: netCents,
      payouts: Array.from(placeAmounts.entries()).map(([place, amount_cents]) => ({ place, amount_cents })),
    };
  });

/** Host cancels a tournament before completion: refund all escrow holds. */
export const cancelTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tournament_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin.from("tournaments").select("*").eq("id", data.tournament_id).single();
    if (!t) throw new Error("Tournament not found");
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (t.host_id !== context.userId && !isAdmin) throw new Error("Only the host can cancel");
    if (t.status === "completed") throw new Error("Already completed");

    const { data: holds } = await supabaseAdmin
      .from("escrow_holds").select("*").eq("tournament_id", t.id).eq("status", "held");

    for (const h of holds ?? []) {
      const r = await supabaseAdmin.rpc("escrow_resolve", { _hold_id: h.id, _new_status: "refunded" });
      if (r.error) throw new Error(r.error.message);
      const c = await supabaseAdmin.rpc("wallet_credit", {
        _user_id: h.user_id,
        _amount_cents: Number(r.data),
        _type: "refund",
        _description: `Refund: ${t.title} cancelled`,
        _tournament_id: t.id,
        _challenge_id: undefined,
        _metadata: { escrow_hold_id: h.id },
      });
      if (c.error) throw new Error(c.error.message);
    }

    await supabaseAdmin.from("tournaments").update({ status: "cancelled" }).eq("id", t.id);
    return { ok: true, refunded: holds?.length ?? 0 };
  });

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGES (1v1)
// ─────────────────────────────────────────────────────────────────────────────

/** Create + escrow the creator's stake. */
export const createChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    game_slug: z.string().min(1),
    platform: z.string().min(1),
    entry_amount: z.number().min(0).max(5000)
      .refine((v) => v === 0 || v >= 5, { message: "Entry must be $0 (free) or at least $5" }),
    rules: z.string().max(2000).optional().default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const entryCents = toCents(data.entry_amount);

    const { data: ch, error } = await supabaseAdmin.from("challenges").insert({
      creator_id: context.userId,
      game_slug: data.game_slug,
      platform: data.platform,
      entry_amount: data.entry_amount,
      rules: data.rules,
      status: "open",
    }).select().single();
    if (error || !ch) throw error ?? new Error("Failed to create challenge");

    if (entryCents > 0) {
      const r = await supabaseAdmin.rpc("escrow_debit", {
        _user_id: context.userId,
        _amount_cents: entryCents,
        _tournament_id: undefined,
        _challenge_id: ch.id,
        _description: `Challenge stake: ${data.game_slug}`,
      });
      if (r.error) {
        await supabaseAdmin.from("challenges").delete().eq("id", ch.id);
        throw new Error(r.error.message);
      }
    }
    return { ok: true, challenge_id: ch.id };
  });

/** Opponent accepts an open challenge: debit + escrow their stake, mark active. */
export const acceptChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ challenge_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ch } = await supabaseAdmin.from("challenges").select("*").eq("id", data.challenge_id).single();
    if (!ch) throw new Error("Challenge not found");
    if (ch.status !== "open") throw new Error("Challenge is no longer open");
    if (ch.creator_id === context.userId) throw new Error("Can't accept your own challenge");

    const entryCents = toCents(Number(ch.entry_amount));
    if (entryCents > 0) {
      const r = await supabaseAdmin.rpc("escrow_debit", {
        _user_id: context.userId,
        _amount_cents: entryCents,
        _tournament_id: undefined,
        _challenge_id: ch.id,
        _description: `Challenge stake: ${ch.game_slug}`,
      });
      if (r.error) throw new Error(r.error.message);
    }

    const { error: uErr } = await supabaseAdmin
      .from("challenges")
      .update({ opponent_id: context.userId, status: "active" })
      .eq("id", ch.id);
    if (uErr) throw uErr;

    return { ok: true };
  });

/** Creator cancels an open challenge: refund their escrow. */
export const cancelChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ challenge_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ch } = await supabaseAdmin.from("challenges").select("*").eq("id", data.challenge_id).single();
    if (!ch) throw new Error("Challenge not found");
    if (ch.creator_id !== context.userId) throw new Error("Not your challenge");
    if (ch.status !== "open") throw new Error("Can only cancel open challenges");

    const { data: holds } = await supabaseAdmin
      .from("escrow_holds").select("*").eq("challenge_id", ch.id).eq("status", "held");

    for (const h of holds ?? []) {
      const r = await supabaseAdmin.rpc("escrow_resolve", { _hold_id: h.id, _new_status: "refunded" });
      if (r.error) throw new Error(r.error.message);
      const c = await supabaseAdmin.rpc("wallet_credit", {
        _user_id: h.user_id,
        _amount_cents: Number(r.data),
        _type: "refund",
        _description: "Challenge cancelled",
        _tournament_id: undefined,
        _challenge_id: ch.id,
        _metadata: { escrow_hold_id: h.id },
      });
      if (c.error) throw new Error(c.error.message);
    }
    await supabaseAdmin.from("challenges").update({ status: "cancelled" }).eq("id", ch.id);
    return { ok: true };
  });

/**
 * Concede a challenge: caller declares the OPPONENT as winner.
 * Auto-pays out — no dispute possible because the loser conceded.
 * If you believe you won and the other side won't concede, open a dispute.
 */
export const concedeChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ challenge_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ch } = await supabaseAdmin.from("challenges").select("*").eq("id", data.challenge_id).single();
    if (!ch) throw new Error("Challenge not found");
    if (ch.status !== "active") throw new Error("Challenge is not active");
    if (ch.creator_id !== context.userId && ch.opponent_id !== context.userId)
      throw new Error("Not a participant");

    const winnerId = ch.creator_id === context.userId ? ch.opponent_id : ch.creator_id;
    if (!winnerId) throw new Error("No opponent");

    return settleChallenge(supabaseAdmin, ch, winnerId);
  });

/** Admin resolves a disputed challenge by picking a winner. */
export const adminResolveChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    challenge_id: z.string().uuid(),
    winner_id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");
    const { data: ch } = await supabaseAdmin.from("challenges").select("*").eq("id", data.challenge_id).single();
    if (!ch) throw new Error("Challenge not found");
    if (ch.status === "completed") throw new Error("Already settled");
    if (![ch.creator_id, ch.opponent_id].includes(data.winner_id))
      throw new Error("Winner must be a participant");
    return settleChallenge(supabaseAdmin, ch, data.winner_id);
  });

// shared payout core
async function settleChallenge(supabaseAdmin: any, ch: any, winnerId: string) {
  const { data: holds } = await supabaseAdmin
    .from("escrow_holds").select("*").eq("challenge_id", ch.id).eq("status", "held");

  let poolCents = 0;
  for (const h of holds ?? []) {
    const r = await supabaseAdmin.rpc("escrow_resolve", { _hold_id: h.id, _new_status: "released" });
    if (r.error) throw new Error(r.error.message);
    poolCents += Number(r.data);
  }

  const fee = calculateChallengeFee(Number(ch.entry_amount));
  // Recompute against actual pool to be safe:
  const actual = calculateFee(poolCents / 100);
  const feeCents = Math.round(actual.serviceFee * 100);
  const netCents = poolCents - feeCents;

  if (netCents > 0) {
    const c = await supabaseAdmin.rpc("wallet_credit", {
      _user_id: winnerId,
      _amount_cents: netCents,
      _type: "prize_payout",
      _description: `Challenge win: ${ch.game_slug}`,
      _tournament_id: undefined,
      _challenge_id: ch.id,
      _metadata: { pool_cents: poolCents, fee_cents: feeCents, fee_rate: actual.rate, fee_preview: fee },
    });
    if (c.error) throw new Error(c.error.message);
  }

  if (feeCents > 0) {
    await supabaseAdmin.rpc("record_platform_fee", {
      _source: "challenge_fee",
      _amount_cents: feeCents,
      _user_id: winnerId,
      _reference_id: ch.id,
      _gross_cents: poolCents,
      _net_cents: netCents,
      _metadata: { fee_rate: actual.rate, game_slug: ch.game_slug },
    });
  }

  await supabaseAdmin.from("challenges")
    .update({ status: "completed", winner_id: winnerId })
    .eq("id", ch.id);

  return { ok: true, winner_id: winnerId, pool_cents: poolCents, fee_cents: feeCents, net_cents: netCents };
}
