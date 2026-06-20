import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateChallengeFee, calculateTournamentFee, calculateFee } from "./fees";

const toCents = (usd: number) => Math.round(Number(usd || 0) * 100);

// ─────────────────────────────────────────────────────────────────────────────
// TOURNAMENTS
// ─────────────────────────────────────────────────────────────────────────────

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

/** Host (or admin) declares a tournament winner. Releases escrow, pays out, charges platform fee. */
export const declareTournamentWinner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    tournament_id: z.string().uuid(),
    winner_id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: t } = await supabaseAdmin.from("tournaments").select("*").eq("id", data.tournament_id).single();
    if (!t) throw new Error("Tournament not found");
    if (t.status === "completed") throw new Error("Already settled");

    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (t.host_id !== context.userId && !isAdmin) throw new Error("Only the host or an admin can declare the winner");

    const { data: winnerEntry } = await supabaseAdmin
      .from("tournament_entries").select("id")
      .eq("tournament_id", t.id).eq("user_id", data.winner_id).maybeSingle();
    if (!winnerEntry) throw new Error("Winner is not a participant");

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

    if (netCents > 0) {
      const { error } = await supabaseAdmin.rpc("wallet_credit", {
        _user_id: data.winner_id,
        _amount_cents: netCents,
        _type: "prize_payout",
        _description: `Prize: ${t.title}`,
        _tournament_id: t.id,
        _challenge_id: undefined,
        _metadata: { pool_cents: poolCents, fee_cents: feeCents, fee_rate: fee.rate },
      });
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("tournaments")
      .update({ status: "completed" })
      .eq("id", t.id);

    return { ok: true, pool_cents: poolCents, fee_cents: feeCents, net_cents: netCents };
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
    entry_amount: z.number().min(0).max(5000),
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

  await supabaseAdmin.from("challenges")
    .update({ status: "completed", winner_id: winnerId })
    .eq("id", ch.id);

  return { ok: true, winner_id: winnerId, pool_cents: poolCents, fee_cents: feeCents, net_cents: netCents };
}
