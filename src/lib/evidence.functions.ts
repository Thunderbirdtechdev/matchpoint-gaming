import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Match evidence — screenshots and clips backing a reported result.
 *
 * The bucket is private. Storage policies can express "your own folder" but not
 * "the other player in this match", so cross-participant viewing goes through
 * `listEvidence`, which checks participation here and then mints short-lived
 * signed URLs. Nothing about evidence is publicly readable.
 */

const SIGNED_URL_TTL_SECONDS = 300;

const TargetSchema = z
  .object({
    challenge_id: z.string().uuid().optional(),
    tournament_match_id: z.string().uuid().optional(),
  })
  .refine((d) => !!d.challenge_id !== !!d.tournament_match_id, {
    message: "Provide exactly one of challenge_id or tournament_match_id.",
  });

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Is this user a participant in the contest, or staff? */
async function assertCanAccess(
  admin: Admin,
  userId: string,
  target: { challenge_id?: string; tournament_match_id?: string },
): Promise<void> {
  if (target.challenge_id) {
    const { data: c } = await admin
      .from("challenges")
      .select("creator_id, opponent_id")
      .eq("id", target.challenge_id)
      .maybeSingle();
    if (!c) throw new Error("Challenge not found.");
    if (c.creator_id === userId || c.opponent_id === userId) return;
  } else if (target.tournament_match_id) {
    const { data: m } = await admin
      .from("tournament_matches")
      .select("player1_id, player2_id")
      .eq("id", target.tournament_match_id)
      .maybeSingle();
    if (!m) throw new Error("Match not found.");
    if (m.player1_id === userId || m.player2_id === userId) return;
  }

  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["moderator", "admin"]);
  if (roles?.length) return;

  throw new Error("You can only view evidence for your own matches.");
}

/**
 * Record an already-uploaded file against a contest.
 *
 * The browser uploads straight to storage (its own folder, enforced by policy)
 * and then calls this so participation is checked before the row is written —
 * the table's own INSERT policy can only prove the uploader is who they claim,
 * not that they were in the match.
 */
export const attachEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    TargetSchema.and(
      z.object({
        file_path: z.string().min(1).max(500),
        kind: z.enum(["screenshot", "clip", "other"]).default("screenshot"),
        note: z.string().trim().max(300).optional(),
      }),
    ).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The file must live under the caller's own prefix — mirrors the storage policy.
    if (!data.file_path.startsWith(`${context.userId}/`)) {
      throw new Error("That file does not belong to you.");
    }

    await assertCanAccess(supabaseAdmin, context.userId, data);

    const { error } = await supabaseAdmin.from("match_evidence").insert({
      challenge_id: data.challenge_id ?? null,
      tournament_match_id: data.tournament_match_id ?? null,
      user_id: context.userId,
      file_path: data.file_path,
      kind: data.kind,
      note: data.note ?? null,
    } as never);
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });

/** Evidence for a contest, with short-lived signed URLs. Participants and staff only. */
export const listEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => TargetSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await assertCanAccess(supabaseAdmin, context.userId, data);

    const query = supabaseAdmin
      .from("match_evidence")
      .select("id, user_id, file_path, kind, note, created_at")
      .order("created_at", { ascending: true });

    const { data: rows, error } = data.challenge_id
      ? await query.eq("challenge_id", data.challenge_id)
      : await query.eq("tournament_match_id", data.tournament_match_id!);
    if (error) throw new Error(error.message);

    const items = await Promise.all(
      (rows ?? []).map(async (r) => {
        const { data: signed } = await supabaseAdmin.storage
          .from("match-evidence")
          .createSignedUrl(r.file_path, SIGNED_URL_TTL_SECONDS);
        return {
          id: r.id,
          user_id: r.user_id,
          kind: r.kind,
          note: r.note,
          created_at: r.created_at,
          url: signed?.signedUrl ?? null,
        };
      }),
    );

    return { items };
  });
