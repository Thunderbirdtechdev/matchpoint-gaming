import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateChallengeFee, calculateTournamentFee, calculateFee } from "./fees";
import { can, requireCapability } from "@/lib/authz";

const toCents = (usd: number) => Math.round(Number(usd || 0) * 100);

// ─────────────────────────────────────────────────────────────────────────────
// TOURNAMENTS
// ─────────────────────────────────────────────────────────────────────────────

const PayoutPlaceSchema = z.object({
  place: z.number().int().min(1).max(20),
  percent: z.number().min(0).max(100).optional(),
  amount_cents: z.number().int().min(0).optional(),
});

const CreateTournamentSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000).optional().default(""),
    game_slug: z.string().min(1),
    platform: z.string().trim().min(1).max(100),
    max_players: z.number().int().min(2).max(256),
    entry_fee: z
      .number()
      .min(0)
      .max(5000)
      .refine((v) => v === 0 || v >= 5, { message: "Entry fee must be $0 (free) or at least $5" }),
    prize_pool: z.number().min(0).max(500_000).optional().default(0),
    starts_at: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid start date" }),
    payout_type: z
      .enum(["winner_take_all", "fixed", "percentage"])
      .optional()
      .default("winner_take_all"),
    payout_structure: z.array(PayoutPlaceSchema).max(20).optional().default([]),
  })
  .superRefine((data, ctx) => {
    const places = data.payout_structure.map((p) => p.place);
    if (new Set(places).size !== places.length) {
      ctx.addIssue({
        code: "custom",
        path: ["payout_structure"],
        message: "Duplicate places in payout structure",
      });
    }
    if (data.payout_type === "percentage") {
      if (!data.payout_structure.length) {
        ctx.addIssue({
          code: "custom",
          path: ["payout_structure"],
          message: "Percentage payout requires at least one place",
        });
        return;
      }
      const total = data.payout_structure.reduce((s, p) => s + (p.percent ?? 0), 0);
      if (Math.round(total) !== 100) {
        ctx.addIssue({
          code: "custom",
          path: ["payout_structure"],
          message: `Payout percentages must add up to 100% (currently ${total}%)`,
        });
      }
    }
    if (data.payout_type === "fixed") {
      if (!data.payout_structure.length) {
        ctx.addIssue({
          code: "custom",
          path: ["payout_structure"],
          message: "Fixed payout requires at least one place",
        });
        return;
      }
      if (data.payout_structure.some((p) => p.amount_cents == null)) {
        ctx.addIssue({
          code: "custom",
          path: ["payout_structure"],
          message: "Every place needs a fixed dollar amount",
        });
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
      .from("tournaments")
      .select("*")
      .eq("id", data.tournament_id)
      .single();
    if (tErr || !t) throw new Error("Tournament not found");
    if (t.status !== "open" && t.status !== "upcoming")
      throw new Error("Tournament is not open for entry");

    const { count } = await supabaseAdmin
      .from("tournament_entries")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", t.id);
    if ((count ?? 0) >= t.max_players) throw new Error("Tournament is full");

    const { data: existing } = await supabaseAdmin
      .from("tournament_entries")
      .select("id")
      .eq("tournament_id", t.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) throw new Error("Already joined");

    const entryCents = toCents(Number(t.entry_fee));

    // Module 9 compliance gate — money at stake only. A free match is not a
    // money movement, and blocking one would punish an ineligible account for
    // something that costs it nothing.
    if (entryCents > 0) {
      const { assertMoneyEligible } = await import("@/lib/compliance.server");
      await assertMoneyEligible(context.userId);
    }

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
      .from("tournament_entries")
      .insert({ tournament_id: t.id, user_id: context.userId });
    if (eErr) throw eErr;

    try {
      const { notifyUser, usd, notifyKey } = await import("@/lib/email/notify.server");
      await notifyUser(
        context.userId,
        "tournament-update",
        {
          status: "joined",
          tournamentName: t.title,
          game: t.game_slug,
          entryFormatted: usd(entryCents),
          startsAt: t.starts_at ? new Date(t.starts_at).toUTCString() : null,
          tournamentId: t.id,
        },
        notifyKey("tournament-joined", t.id, context.userId),
      );
    } catch (e) {
      console.error("[NOTIFY-FAILED] tournament joined", e);
    }

    return { ok: true };
  });

const DeclareWinnerSchema = z.object({
  tournament_id: z.string().uuid(),
  winners: z
    .array(
      z.object({
        user_id: z.string().uuid(),
        place: z.number().int().min(1),
      }),
    )
    .min(1)
    .max(20),
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

    const { data: t } = await supabaseAdmin
      .from("tournaments")
      .select("*")
      .eq("id", data.tournament_id)
      .single();
    if (!t) throw new Error("Tournament not found");
    if (t.status === "completed") throw new Error("Already settled");

    const isStaff = await can(context, "moderation.tournaments.override");
    if (t.host_id !== context.userId && !isStaff)
      throw new Error("Only the host or an admin can declare the winner");

    const places = data.winners.map((w) => w.place);
    if (new Set(places).size !== places.length) throw new Error("Duplicate places in winners list");
    const userIds = data.winners.map((w) => w.user_id);
    if (new Set(userIds).size !== userIds.length) throw new Error("Duplicate winners");

    const { data: entries } = await supabaseAdmin
      .from("tournament_entries")
      .select("user_id")
      .eq("tournament_id", t.id)
      .in("user_id", userIds);
    const participantIds = new Set((entries ?? []).map((e: { user_id: string }) => e.user_id));
    for (const w of data.winners) {
      if (!participantIds.has(w.user_id))
        throw new Error(`One of the selected winners is not a participant`);
    }

    const { data: holds } = await supabaseAdmin
      .from("escrow_holds")
      .select("*")
      .eq("tournament_id", t.id)
      .eq("status", "held");

    let poolCents = 0;
    for (const h of holds ?? []) {
      const amt = await supabaseAdmin.rpc("escrow_resolve", {
        _hold_id: h.id,
        _new_status: "released",
      });
      if (amt.error) throw new Error(amt.error.message);
      poolCents += Number(amt.data);
    }

    const fee = calculateFee(poolCents / 100);
    const feeCents = Math.round(fee.serviceFee * 100);
    const netCents = poolCents - feeCents;

    const tExtra = t as unknown as { payout_type?: string; payout_structure?: unknown };
    const payoutType = (tExtra.payout_type ?? "winner_take_all") as
      | "winner_take_all"
      | "fixed"
      | "percentage";
    const structure = (tExtra.payout_structure ?? []) as Array<{
      place: number;
      percent?: number;
      amount_cents?: number;
    }>;

    const placeAmounts = new Map<number, number>();
    if (payoutType === "winner_take_all") {
      if (data.winners.length !== 1)
        throw new Error("Winner-take-all tournaments have exactly one winner");
      if (netCents > 0) placeAmounts.set(data.winners[0].place, netCents);
    } else if (payoutType === "percentage") {
      const sorted = [...data.winners].sort((a, b) => a.place - b.place);
      let allocated = 0;
      for (const w of sorted) {
        const entry = structure.find((s) => s.place === w.place);
        if (!entry || entry.percent == null)
          throw new Error(`No payout percentage configured for place ${w.place}`);
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
        if (!entry || entry.amount_cents == null)
          throw new Error(`No fixed payout configured for place ${w.place}`);
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
          _metadata: {
            pool_cents: poolCents,
            fee_cents: feeCents,
            fee_rate: fee.rate,
            place: w.place,
            payout_type: payoutType,
          },
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

    await supabaseAdmin.from("tournaments").update({ status: "completed" }).eq("id", t.id);

    // Module 10. Only the players who actually got paid are mailed here.
    // Mailing every entrant "the tournament ended" would be a notification
    // about someone else's win, and the players who lost already know.
    try {
      const { notifyUser, usd, notifyKey } = await import("@/lib/email/notify.server");
      for (const w of data.winners) {
        const amt = placeAmounts.get(w.place) ?? 0;
        if (amt <= 0) continue;
        await notifyUser(
          w.user_id,
          "tournament-update",
          {
            status: "placed",
            tournamentName: t.title,
            game: t.game_slug,
            place: w.place,
            amountFormatted: usd(amt),
            tournamentId: t.id,
          },
          notifyKey("tournament-placed", t.id, w.user_id),
        );
      }
    } catch (e) {
      console.error("[NOTIFY-FAILED] tournament payout", e);
    }

    return {
      ok: true,
      pool_cents: poolCents,
      fee_cents: feeCents,
      net_cents: netCents,
      payouts: Array.from(placeAmounts.entries()).map(([place, amount_cents]) => ({
        place,
        amount_cents,
      })),
    };
  });

/** Host cancels a tournament before completion: refund all escrow holds. */
export const cancelTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tournament_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin
      .from("tournaments")
      .select("*")
      .eq("id", data.tournament_id)
      .single();
    if (!t) throw new Error("Tournament not found");
    const isStaff = await can(context, "moderation.tournaments.override");
    if (t.host_id !== context.userId && !isStaff) throw new Error("Only the host can cancel");
    if (t.status === "completed") throw new Error("Already completed");

    const { data: holds } = await supabaseAdmin
      .from("escrow_holds")
      .select("*")
      .eq("tournament_id", t.id)
      .eq("status", "held");

    for (const h of holds ?? []) {
      const r = await supabaseAdmin.rpc("escrow_resolve", {
        _hold_id: h.id,
        _new_status: "refunded",
      });
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

    // Module 10. This is the one tournament email that genuinely has to go out.
    // A player who paid to enter something that then disappeared will assume
    // the worst, and the refund has already happened above — the email exists
    // to say so before they open a ticket about it.
    try {
      const { notifyUser, usd, notifyKey } = await import("@/lib/email/notify.server");
      for (const h of holds ?? []) {
        await notifyUser(
          h.user_id,
          "tournament-update",
          {
            status: "canceled",
            tournamentName: t.title,
            game: t.game_slug,
            amountFormatted: usd(Number(h.amount_cents ?? 0)),
            tournamentId: t.id,
          },
          notifyKey("tournament-canceled", t.id, h.user_id),
        );
      }
    } catch (e) {
      console.error("[NOTIFY-FAILED] tournament cancelled", e);
    }

    return { ok: true, refunded: holds?.length ?? 0 };
  });

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGES (1v1)
// ─────────────────────────────────────────────────────────────────────────────

/** Create + escrow the creator's stake. */
export const createChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        game_slug: z.string().min(1),
        platform: z.string().min(1),
        entry_amount: z
          .number()
          .min(0)
          .max(5000)
          .refine((v) => v === 0 || v >= 5, { message: "Entry must be $0 (free) or at least $5" }),
        rules: z.string().max(2000).optional().default(""),
        /*
         * Optional. A username or account email. When present the challenge is
         * private to that player: hidden from the marketplace, and only they
         * can accept it. Absent, nothing changes — it goes to the marketplace
         * exactly as before.
         */
        invite: z.string().trim().max(320).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const entryCents = toCents(data.entry_amount);

    /*
     * Resolve the invite BEFORE any money moves. If the name is wrong we want
     * to fail with "no such player" and leave the wallet untouched, not debit
     * the stake into escrow against a challenge nobody can ever accept.
     */
    let invitedUserId: string | null = null;
    if (data.invite) {
      const { data: found, error: findErr } = await supabaseAdmin.rpc(
        "find_user_by_login" as never,
        { _login: data.invite } as never,
      );
      if (findErr) {
        // PGRST202 = the function does not exist, i.e. the migration has not
        // been run. Named explicitly because "could not find the function" is
        // not something the person creating a challenge can act on.
        if (findErr.code === "PGRST202" || /find_user_by_login/.test(findErr.message)) {
          throw new Error(
            "Invites aren't enabled yet — run 20260905120000_challenge_invites.sql in the Lovable SQL editor. You can still post this challenge to the marketplace.",
          );
        }
        throw new Error(findErr.message);
      }
      invitedUserId = (found as string | null) ?? null;

      if (!invitedUserId) {
        throw new Error(
          `No player found for "${data.invite}". Check the username or the email they signed up with.`,
        );
      }
      if (invitedUserId === context.userId) {
        throw new Error("You can't challenge yourself.");
      }
    }

    // Module 9 compliance gate — money at stake only. A free match is not a
    // money movement, and blocking one would punish an ineligible account for
    // something that costs it nothing.
    if (entryCents > 0) {
      const { assertMoneyEligible } = await import("@/lib/compliance.server");
      await assertMoneyEligible(context.userId);
    }

    const { data: ch, error } = await supabaseAdmin
      .from("challenges")
      .insert({
        creator_id: context.userId,
        game_slug: data.game_slug,
        platform: data.platform,
        entry_amount: data.entry_amount,
        rules: data.rules,
        status: "open",
        invited_user_id: invitedUserId,
      })
      .select()
      .single();
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
    // Tell the invited player. Without this the invite only exists if they
    // happen to open the app and look — which for a private challenge aimed at
    // one specific person is close to not having sent it.
    if (invitedUserId) {
      try {
        const { notifyUser, displayNameFor, usd, notifyKey } =
          await import("@/lib/email/notify.server");
        await notifyUser(
          invitedUserId,
          "match-update",
          {
            status: "invited",
            opponent: await displayNameFor(supabaseAdmin, context.userId),
            game: data.game_slug,
            platform: data.platform,
            stakeFormatted: usd(entryCents),
            challengeId: ch.id,
            note: data.rules || null,
          },
          notifyKey("match-invited", ch.id),
        );
      } catch (e) {
        console.error("[NOTIFY-FAILED] challenge invite", e);
      }
    }

    return { ok: true, challenge_id: ch.id, invited_user_id: invitedUserId };
  });

/** Opponent accepts an open challenge: debit + escrow their stake, mark active. */
export const acceptChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ challenge_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ch } = await supabaseAdmin
      .from("challenges")
      .select("*")
      .eq("id", data.challenge_id)
      .single();
    if (!ch) throw new Error("Challenge not found");
    if (ch.status !== "open") throw new Error("Challenge is no longer open");
    if (ch.creator_id === context.userId) throw new Error("Can't accept your own challenge");

    /*
     * The privacy of an invited challenge is enforced HERE, not by hiding it.
     * `challenges` is public-read by design, so the marketplace filter only
     * keeps these out of sight — anyone who knows the id could still POST an
     * accept. This is the check that actually holds.
     */
    if (ch.invited_user_id && ch.invited_user_id !== context.userId) {
      throw new Error("This challenge was sent to a specific player.");
    }

    const entryCents = toCents(Number(ch.entry_amount));

    // Module 9 compliance gate — money at stake only. A free match is not a
    // money movement, and blocking one would punish an ineligible account for
    // something that costs it nothing.
    if (entryCents > 0) {
      const { assertMoneyEligible } = await import("@/lib/compliance.server");
      await assertMoneyEligible(context.userId);
    }

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

    // Module 10. Only the creator is mailed — the accepter is looking at the
    // screen that just told them it worked, and an email confirming an action
    // someone took two seconds ago is noise.
    try {
      const { notifyUser, displayNameFor, usd, notifyKey } =
        await import("@/lib/email/notify.server");
      await notifyUser(
        ch.creator_id,
        "match-update",
        {
          status: "accepted",
          opponent: await displayNameFor(supabaseAdmin, context.userId),
          game: ch.game_slug,
          platform: ch.platform,
          stakeFormatted: usd(entryCents),
          challengeId: ch.id,
        },
        notifyKey("match-accepted", ch.id),
      );
    } catch (e) {
      console.error("[NOTIFY-FAILED] challenge accepted", e);
    }

    return { ok: true };
  });

/** Creator cancels an open challenge: refund their escrow. */
export const cancelChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ challenge_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ch } = await supabaseAdmin
      .from("challenges")
      .select("*")
      .eq("id", data.challenge_id)
      .single();
    if (!ch) throw new Error("Challenge not found");
    if (ch.creator_id !== context.userId) throw new Error("Not your challenge");
    if (ch.status !== "open") throw new Error("Can only cancel open challenges");

    const { data: holds } = await supabaseAdmin
      .from("escrow_holds")
      .select("*")
      .eq("challenge_id", ch.id)
      .eq("status", "held");

    for (const h of holds ?? []) {
      const r = await supabaseAdmin.rpc("escrow_resolve", {
        _hold_id: h.id,
        _new_status: "refunded",
      });
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
    const { data: ch } = await supabaseAdmin
      .from("challenges")
      .select("*")
      .eq("id", data.challenge_id)
      .single();
    if (!ch) throw new Error("Challenge not found");
    if (ch.status !== "active") throw new Error("Challenge is not active");
    if (ch.creator_id !== context.userId && ch.opponent_id !== context.userId)
      throw new Error("Not a participant");

    const winnerId = ch.creator_id === context.userId ? ch.opponent_id : ch.creator_id;
    if (!winnerId) throw new Error("No opponent");

    return settleChallenge(supabaseAdmin, ch, winnerId, "conceded");
  });

/**
 * Each player reports who they think won. If both reports agree, the match
 * auto-settles immediately. If they disagree, the challenge is marked
 * 'disputed' - escrow stays held, funds are locked, and the fair play team
 * reviews via adminResolveChallenge. No payout happens on disagreement.
 */
export const reportChallengeResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        challenge_id: z.string().uuid(),
        reported_winner_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: chRow } = await supabaseAdmin
      .from("challenges")
      .select("*")
      .eq("id", data.challenge_id)
      .single();
    if (!chRow) throw new Error("Challenge not found");
    const ch = chRow as unknown as {
      id: string;
      creator_id: string;
      opponent_id: string | null;
      status: string;
      creator_reported_winner_id: string | null;
      opponent_reported_winner_id: string | null;
      // Module 10 reads these for the dispute email. The select is already
      // `*`; only this local narrowing had to widen.
      entry_amount: number;
      game_slug: string;
      platform: string;
    };
    if (ch.status !== "active") throw new Error("Challenge is not active");
    if (ch.creator_id !== context.userId && ch.opponent_id !== context.userId)
      throw new Error("Not a participant");
    if (![ch.creator_id, ch.opponent_id].includes(data.reported_winner_id)) {
      throw new Error("Reported winner must be a participant");
    }

    const isCreator = ch.creator_id === context.userId;
    const myColumn = isCreator ? "creator_reported_winner_id" : "opponent_reported_winner_id";
    const otherReport = isCreator ? ch.opponent_reported_winner_id : ch.creator_reported_winner_id;

    const { error: uErr } = await supabaseAdmin
      .from("challenges")
      .update({ [myColumn]: data.reported_winner_id } as never)
      .eq("id", ch.id);
    if (uErr) throw uErr;

    if (!otherReport) {
      return { ok: true, status: "waiting" as const };
    }

    if (otherReport === data.reported_winner_id) {
      const result = await settleChallenge(supabaseAdmin, ch, data.reported_winner_id);
      return { status: "settled" as const, ...result };
    }

    await supabaseAdmin
      .from("challenges")
      .update({ status: "disputed" } as never)
      .eq("id", ch.id);
    await supabaseAdmin.from("disputes").insert({
      challenge_id: ch.id,
      opened_by: context.userId,
      reason: "Players reported different match winners",
      status: "open",
    } as never);

    // Module 10. BOTH players are told, including the one who did not trigger
    // the mismatch. Their stake is frozen either way, and finding that out by
    // noticing a missing balance is how a dispute becomes a support ticket.
    try {
      const { notifyUser, displayNameFor, usd, notifyKey } =
        await import("@/lib/email/notify.server");
      const stake = usd(toCents(Number(ch.entry_amount)));
      for (const [uid, otherId] of [
        [ch.creator_id, ch.opponent_id],
        [ch.opponent_id, ch.creator_id],
      ] as [string, string][]) {
        if (!uid) continue;
        await notifyUser(
          uid,
          "match-update",
          {
            status: "disputed",
            opponent: otherId ? await displayNameFor(supabaseAdmin, otherId) : null,
            game: ch.game_slug,
            platform: ch.platform,
            stakeFormatted: stake,
            challengeId: ch.id,
          },
          notifyKey("match-disputed", ch.id, uid),
        );
      }
    } catch (e) {
      console.error("[NOTIFY-FAILED] match disputed", e);
    }

    return { ok: true, status: "disputed" as const };
  });

/** Admin resolves a disputed (or active) challenge by picking a winner. Also closes any linked dispute. */
export const adminResolveChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        challenge_id: z.string().uuid(),
        winner_id: z.string().uuid(),
        resolution_note: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireCapability(context, "moderation.disputes.approve");
    const { data: ch } = await supabaseAdmin
      .from("challenges")
      .select("*")
      .eq("id", data.challenge_id)
      .single();
    if (!ch) throw new Error("Challenge not found");
    if (ch.status === "completed") throw new Error("Already settled");
    if (![ch.creator_id, ch.opponent_id].includes(data.winner_id))
      throw new Error("Winner must be a participant");
    const result = await settleChallenge(supabaseAdmin, ch, data.winner_id, "override");
    await supabaseAdmin
      .from("disputes")
      .update({
        status: "resolved",
        resolution: data.resolution_note ?? `Resolved - winner: ${data.winner_id}`,
      } as never)
      .eq("challenge_id", ch.id)
      .eq("status", "open");

    // Module 9. This path is the deliberate break-glass override: it settles a
    // match and releases escrow on ONE person's say-so, bypassing the
    // two-person rule the dispute flow exists to enforce. Module 6 kept it on
    // purpose and asked for exactly this — a record of every use, so the
    // exception stays visible instead of becoming the normal way to resolve.
    const { recordAudit } = await import("@/lib/audit.server");
    await recordAudit(context.userId, {
      action: "moderation.challenge_override",
      target_type: "challenge",
      target_id: ch.id,
      amount_cents: Math.round(Number(ch.entry_amount ?? 0) * 100) * 2,
      summary: `Override: settled a disputed match directly, bypassing the two-person rule`,
      metadata: {
        winner_id: data.winner_id,
        loser_id: ch.creator_id === data.winner_id ? ch.opponent_id : ch.creator_id,
        note: data.resolution_note ?? null,
        bypassed_two_person_rule: true,
      },
    });

    return result;
  });

/** How a match came to be settled. Shown to the players as a note. */
type SettledVia = "reported" | "conceded" | "dispute" | "override";

const SETTLED_NOTE: Record<SettledVia, string | null> = {
  reported: null, // both players agreed; nothing to explain
  conceded: "Your opponent conceded the match.",
  dispute: "Settled by our review team after a dispute.",
  override: "Settled directly by our review team.",
};

// shared payout core
async function settleChallenge(
  supabaseAdmin: any,
  ch: any,
  winnerId: string,
  settledVia: SettledVia = "reported",
) {
  const { data: holds } = await supabaseAdmin
    .from("escrow_holds")
    .select("*")
    .eq("challenge_id", ch.id)
    .eq("status", "held");

  let poolCents = 0;
  for (const h of holds ?? []) {
    const r = await supabaseAdmin.rpc("escrow_resolve", {
      _hold_id: h.id,
      _new_status: "released",
    });
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
      _metadata: {
        pool_cents: poolCents,
        fee_cents: feeCents,
        fee_rate: actual.rate,
        fee_preview: fee,
      },
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

  await supabaseAdmin
    .from("challenges")
    .update({ status: "completed", winner_id: winnerId })
    .eq("id", ch.id);

  /*
   * Module 10. Every settlement path funnels through here — both players
   * agreeing, a concession, a dispute approval and the admin override — so
   * hooking this one function is what makes "you won / match settled" arrive
   * reliably instead of on three of the four routes.
   *
   * After the money has moved, and unable to throw: see notify.server.ts.
   */
  const loserId = ch.creator_id === winnerId ? ch.opponent_id : ch.creator_id;
  try {
    const { notifyUser, displayNameFor, usd, notifyKey } =
      await import("@/lib/email/notify.server");
    const [winnerName, loserName] = await Promise.all([
      displayNameFor(supabaseAdmin, winnerId),
      loserId ? displayNameFor(supabaseAdmin, loserId) : Promise.resolve(null),
    ]);
    const note = SETTLED_NOTE[settledVia];
    const stake = usd(Math.round(Number(ch.entry_amount ?? 0) * 100));

    await notifyUser(
      winnerId,
      "match-update",
      {
        status: "settled_won",
        opponent: loserName,
        game: ch.game_slug,
        platform: ch.platform,
        stakeFormatted: stake,
        payoutFormatted: usd(netCents),
        challengeId: ch.id,
        note,
      },
      notifyKey("match-settled", ch.id, winnerId),
    );

    if (loserId) {
      await notifyUser(
        loserId,
        "match-update",
        {
          status: "settled_lost",
          opponent: winnerName,
          game: ch.game_slug,
          platform: ch.platform,
          stakeFormatted: stake,
          challengeId: ch.id,
          note,
        },
        notifyKey("match-settled", ch.id, loserId),
      );
    }
  } catch (e) {
    console.error("[NOTIFY-FAILED] match settlement", e);
  }

  return {
    ok: true,
    winner_id: winnerId,
    pool_cents: poolCents,
    fee_cents: feeCents,
    net_cents: netCents,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPUTE REVIEW — two-person rule
//
// Resolving a dispute releases escrow and is irreversible, so the decision and
// the payout are deliberately split across two people: a moderator records a
// recommended winner, an admin confirms it, and only then does money move.
//
// These live here rather than in their own module so they can reuse the private
// `settleChallenge` helper without exporting money-handling internals.
// ─────────────────────────────────────────────────────────────────────────────

/** Moderator records who they believe won. Moves no money. */
export const recommendDisputeResolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        dispute_id: z.string().uuid(),
        recommended_winner_id: z.string().uuid(),
        review_note: z.string().trim().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await requireCapability(context, "moderation.disputes.review");

    const { data: dispute } = await supabaseAdmin
      .from("disputes")
      .select("id, challenge_id, status")
      .eq("id", data.dispute_id)
      .maybeSingle();
    if (!dispute) throw new Error("Dispute not found.");
    if (dispute.status === "resolved") throw new Error("That dispute is already resolved.");

    const { data: ch } = await supabaseAdmin
      .from("challenges")
      .select("creator_id, opponent_id")
      .eq("id", dispute.challenge_id!)
      .maybeSingle();
    if (!ch) throw new Error("Challenge not found.");
    if (![ch.creator_id, ch.opponent_id].includes(data.recommended_winner_id)) {
      throw new Error("The winner must be one of the two players.");
    }

    const { error } = await supabaseAdmin
      .from("disputes")
      .update({
        recommended_winner_id: data.recommended_winner_id,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        review_note: data.review_note ?? null,
        status: "awaiting_approval",
      } as never)
      .eq("id", data.dispute_id);
    if (error) throw new Error(error.message);

    const { recordAudit } = await import("@/lib/audit.server");
    await recordAudit(context.userId, {
      action: "moderation.dispute_recommend",
      target_type: "dispute",
      target_id: data.dispute_id,
      summary: "Recommended a dispute winner for approval",
      metadata: {
        recommended_winner_id: data.recommended_winner_id,
        challenge_id: dispute.challenge_id,
        note: data.review_note ?? null,
      },
    });

    return { ok: true as const };
  });

/** Admin confirms the recommendation. THIS is the step that releases escrow. */
export const approveDisputeResolution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ dispute_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await requireCapability(context, "moderation.disputes.approve");

    const { data: dispute } = await supabaseAdmin
      .from("disputes")
      .select("id, challenge_id, status, recommended_winner_id, reviewed_by")
      .eq("id", data.dispute_id)
      .maybeSingle();
    if (!dispute) throw new Error("Dispute not found.");
    if (dispute.status === "resolved") throw new Error("That dispute is already resolved.");
    if (!dispute.recommended_winner_id) {
      throw new Error("A moderator must recommend a winner before this can be approved.");
    }
    // The whole point of the split is that two different people sign off.
    if (dispute.reviewed_by === context.userId) {
      throw new Error("A different admin must approve a resolution you reviewed.");
    }

    const { data: ch } = await supabaseAdmin
      .from("challenges")
      .select("*")
      .eq("id", dispute.challenge_id!)
      .single();
    if (!ch) throw new Error("Challenge not found.");
    if (ch.status === "settled") throw new Error("That match is already settled.");

    const result = await settleChallenge(
      supabaseAdmin,
      ch,
      dispute.recommended_winner_id,
      "dispute",
    );

    await supabaseAdmin
      .from("disputes")
      .update({
        status: "resolved",
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
        resolution: `Resolved — winner ${dispute.recommended_winner_id}`,
      } as never)
      .eq("id", data.dispute_id);

    // Both halves of the two-person rule are recorded on the entry, so the log
    // shows on its face that two different people signed off.
    const { recordAudit } = await import("@/lib/audit.server");
    await recordAudit(context.userId, {
      action: "moderation.dispute_approve",
      target_type: "dispute",
      target_id: data.dispute_id,
      summary: "Approved a dispute resolution and released escrow",
      metadata: {
        winner_id: dispute.recommended_winner_id,
        reviewed_by: dispute.reviewed_by,
        challenge_id: dispute.challenge_id,
      },
    });

    return result;
  });

/** Admin sends a recommendation back for another look. Moves no money. */
export const rejectDisputeRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ dispute_id: z.string().uuid(), note: z.string().trim().max(1000).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Sending a recommendation back is the mirror of approving it, so it takes
    // the same capability — otherwise a moderator could bounce their own
    // colleague's review and re-record it, defeating the two-person rule.
    await requireCapability(context, "moderation.disputes.approve");

    const { error } = await supabaseAdmin
      .from("disputes")
      .update({
        status: "open",
        recommended_winner_id: null,
        review_note: data.note ?? null,
      } as never)
      .eq("id", data.dispute_id);
    if (error) throw new Error(error.message);

    const { recordAudit } = await import("@/lib/audit.server");
    await recordAudit(context.userId, {
      action: "moderation.dispute_reject",
      target_type: "dispute",
      target_id: data.dispute_id,
      summary: "Sent a dispute recommendation back for another look",
      metadata: { note: data.note ?? null },
    });

    return { ok: true as const };
  });

/** Full dispute context for the review queue, including signed evidence URLs. */
export const getDisputeDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ dispute_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const isModerator = await can(context, "moderation.disputes.review");
    const isAdmin = await can(context, "moderation.disputes.approve");
    if (!isModerator) throw new Error("Moderators only.");

    const { data: dispute } = await supabaseAdmin
      .from("disputes")
      .select("*")
      .eq("id", data.dispute_id)
      .maybeSingle();
    if (!dispute) throw new Error("Dispute not found.");

    const { data: challenge } = await supabaseAdmin
      .from("challenges")
      .select("*")
      .eq("id", dispute.challenge_id!)
      .maybeSingle();

    const ids = [challenge?.creator_id, challenge?.opponent_id].filter(Boolean) as string[];
    const { data: players } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    // Evidence lives in a private bucket, so hand back short-lived signed URLs.
    const { data: evidenceRows } = await supabaseAdmin
      .from("match_evidence")
      .select("id, user_id, file_path, kind, note, created_at")
      .eq("challenge_id", dispute.challenge_id!)
      .order("created_at", { ascending: true });

    const evidence = await Promise.all(
      (evidenceRows ?? []).map(async (e) => {
        const { data: signed } = await supabaseAdmin.storage
          .from("match-evidence")
          .createSignedUrl(e.file_path, 300);
        return { ...e, url: signed?.signedUrl ?? null };
      }),
    );

    return { dispute, challenge, players: players ?? [], evidence, isAdmin };
  });
