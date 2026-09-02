import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Single-elimination bracket.
 *
 * Rounds are 1-based and `slot` is 0-based within a round, so the winner of
 * (round, slot) always feeds (round + 1, floor(slot / 2)) — into player1 when
 * the slot is even, player2 when it is odd. That arithmetic is the whole
 * advancement rule; nothing else needs to know the bracket shape.
 *
 * Payout is deliberately NOT handled here. `declareTournamentWinner` already
 * owns escrow release, fee capture and status, so the final match just surfaces
 * the champion and the host settles through that existing, tested path.
 */

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Move a winner into the next round, marking that match ready once both seats are filled. */
async function advanceWinner(
  admin: Admin,
  tournamentId: string,
  round: number,
  slot: number,
  winnerId: string,
  totalRounds: number,
): Promise<void> {
  if (round >= totalRounds) return; // final match — nothing above it

  const nextRound = round + 1;
  const nextSlot = Math.floor(slot / 2);

  // Even slots feed the upper seat of the next match, odd slots the lower one.
  const seatUpdate =
    slot % 2 === 0
      ? { player1_id: winnerId, updated_at: new Date().toISOString() }
      : { player2_id: winnerId, updated_at: new Date().toISOString() };

  await admin
    .from("tournament_matches")
    .update(seatUpdate)
    .eq("tournament_id", tournamentId)
    .eq("round", nextRound)
    .eq("slot", nextSlot);

  const { data: next } = await admin
    .from("tournament_matches")
    .select("id, player1_id, player2_id, status")
    .eq("tournament_id", tournamentId)
    .eq("round", nextRound)
    .eq("slot", nextSlot)
    .maybeSingle();

  if (next?.player1_id && next.player2_id && next.status === "pending") {
    await admin.from("tournament_matches").update({ status: "ready" }).eq("id", next.id);
  }
}

/**
 * Seed round 1 from the entrant list and lay out every later round empty.
 *
 * Seeding is by join order rather than a random draw so a bracket can be
 * re-derived and audited after the fact if a result is challenged.
 */
export const generateBracket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tournament_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: t } = await supabaseAdmin
      .from("tournaments")
      .select("id, host_id, status")
      .eq("id", data.tournament_id)
      .single();
    if (!t) throw new Error("Tournament not found.");
    if (t.host_id !== context.userId) throw new Error("Only the host can generate the bracket.");
    if (t.status === "cancelled" || t.status === "completed") {
      throw new Error("This tournament is already closed.");
    }

    const { data: existing } = await supabaseAdmin
      .from("tournament_matches")
      .select("id")
      .eq("tournament_id", t.id)
      .limit(1);
    if (existing?.length) throw new Error("The bracket has already been generated.");

    const { data: entries } = await supabaseAdmin
      .from("tournament_entries")
      .select("user_id, created_at")
      .eq("tournament_id", t.id)
      .order("created_at", { ascending: true });

    const players = (entries ?? []).map((e) => e.user_id);
    if (players.length < 2)
      throw new Error("At least 2 entrants are needed to generate a bracket.");

    const size = nextPowerOfTwo(players.length);
    const totalRounds = Math.round(Math.log2(size));

    const rows: Record<string, unknown>[] = [];

    // Round 1 — pairs in join order. A slot that receives only one player is a
    // bye: it settles immediately and that entrant advances without playing.
    for (let slot = 0; slot < size / 2; slot += 1) {
      const p1 = players[slot * 2] ?? null;
      const p2 = players[slot * 2 + 1] ?? null;
      const isBye = !!p1 && !p2;
      rows.push({
        tournament_id: t.id,
        round: 1,
        slot,
        player1_id: p1,
        player2_id: p2,
        winner_id: isBye ? p1 : null,
        status: isBye ? "bye" : p1 && p2 ? "ready" : "pending",
      });
    }

    // Later rounds, empty, waiting to be filled by advancement.
    for (let round = 2; round <= totalRounds; round += 1) {
      for (let slot = 0; slot < size / 2 ** round; slot += 1) {
        rows.push({ tournament_id: t.id, round, slot, status: "pending" });
      }
    }

    const { error } = await supabaseAdmin.from("tournament_matches").insert(rows as never);
    if (error) throw new Error(error.message);

    // Byes have already been decided, so push them up before anyone looks.
    for (const row of rows) {
      if (row.status === "bye" && row.round === 1) {
        await advanceWinner(
          supabaseAdmin,
          t.id,
          1,
          row.slot as number,
          row.winner_id as string,
          totalRounds,
        );
      }
    }

    await supabaseAdmin.from("tournaments").update({ status: "active" }).eq("id", t.id);

    return { ok: true as const, rounds: totalRounds, matches: rows.length };
  });

/** Host reports one match; the winner advances. Returns the champion on the final. */
export const reportMatchResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ match_id: z.string().uuid(), winner_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: match } = await supabaseAdmin
      .from("tournament_matches")
      .select("id, tournament_id, round, slot, player1_id, player2_id, status")
      .eq("id", data.match_id)
      .single();
    if (!match) throw new Error("Match not found.");

    const { data: t } = await supabaseAdmin
      .from("tournaments")
      .select("id, host_id")
      .eq("id", match.tournament_id)
      .single();
    if (!t) throw new Error("Tournament not found.");
    if (t.host_id !== context.userId) throw new Error("Only the host can report results.");

    if (match.status === "settled") throw new Error("That match is already settled.");
    if (data.winner_id !== match.player1_id && data.winner_id !== match.player2_id) {
      throw new Error("The winner must be one of the two players in the match.");
    }

    // Read the depth off the bracket itself rather than inferring it from the
    // match count, so a removed row can't silently shift where the final is.
    const { data: deepest } = await supabaseAdmin
      .from("tournament_matches")
      .select("round")
      .eq("tournament_id", match.tournament_id)
      .order("round", { ascending: false })
      .limit(1)
      .maybeSingle();
    const totalRounds = deepest?.round ?? match.round;

    await supabaseAdmin
      .from("tournament_matches")
      .update({
        winner_id: data.winner_id,
        status: "settled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id);

    await advanceWinner(
      supabaseAdmin,
      match.tournament_id,
      match.round,
      match.slot,
      data.winner_id,
      totalRounds,
    );

    const isFinal = match.round >= totalRounds;
    return {
      ok: true as const,
      is_final: isFinal,
      champion_id: isFinal ? data.winner_id : null,
    };
  });
