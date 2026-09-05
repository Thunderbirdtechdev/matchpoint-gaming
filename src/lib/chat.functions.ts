/**
 * Chat: sending, reading, reporting and moderating.
 *
 * Every write is a server function rather than a client insert, because three
 * things have to be true before a row exists and none of them is a row
 * predicate RLS could express: the author is not muted, they are inside the
 * rate limit, and the text has been scanned for off-platform payment offers.
 * Reads stay on RLS, because realtime delivery depends on the policy.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCapability } from "@/lib/authz";
import { scanForOffPlatform } from "@/lib/chat/scan";

/**
 * The chat tables are not in the generated types yet.
 *
 * `src/integrations/supabase/types.ts` is generated from the DEPLOYED schema,
 * so it cannot know about `chat_messages`, `chat_mutes` or `chat_reports` until
 * this migration has been applied and the types regenerated. Hand-editing a
 * generated file would be undone by the next regeneration and would hide the
 * fact that the schema is ahead of the types.
 *
 * So the untyped view is confined to this one helper. Delete it — and this
 * comment — once the types have been regenerated; every call site is already
 * written against the real column names.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

/** Messages per author per window. */
const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 30;

const ScopeSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("global") }),
  z.object({ scope: z.literal("match"), match_id: z.string().uuid() }),
]);

/**
 * Is this user allowed in this room?
 *
 * The global room is open to anyone signed in. A match room is the two players
 * and nobody else — checked here on the write path for the same reason
 * `acceptChallenge` checks its invite here rather than trusting the marketplace
 * filter: hiding a room is not the same as closing it.
 */
async function assertRoomAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
  scope: "global" | "match",
  matchId?: string,
): Promise<void> {
  if (scope === "global") return;

  const { data: ch } = await admin
    .from("challenges")
    .select("creator_id, opponent_id, status")
    .eq("id", matchId)
    .maybeSingle();

  if (!ch) throw new Error("Match not found.");
  if (ch.creator_id !== userId && ch.opponent_id !== userId) {
    throw new Error("This chat belongs to a match you are not in.");
  }
  // A room opens when the challenge is accepted, which is the moment there is
  // a second player to talk to. Before that there is nobody on the other side.
  if (!ch.opponent_id) {
    throw new Error("This match has not been accepted yet.");
  }
}

/** Send one message. */
export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ body: z.string().trim().min(1).max(2000) })
      .and(ScopeSchema)
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as UntypedDb;
    const matchId = data.scope === "match" ? data.match_id : undefined;

    await assertRoomAccess(supabaseAdmin, context.userId, data.scope, matchId);

    // Mute. An expired mute is treated as lifted rather than deleted on read —
    // cleaning up is the moderator's business, not the sender's.
    const { data: mute } = await db
      .from("chat_mutes")
      .select("until, reason")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (mute && (!mute.until || new Date(mute.until) > new Date())) {
      const until = mute.until ? ` until ${new Date(mute.until).toLocaleString()}` : "";
      throw new Error(
        `You can't post in chat${until}.${mute.reason ? ` Reason: ${mute.reason}` : ""}`,
      );
    }

    // Rate limit. Counts across both rooms deliberately: someone flooding is
    // flooding, and letting them alternate rooms to double their allowance
    // would make the limit a formality.
    const since = new Date(Date.now() - RATE_WINDOW_SECONDS * 1000).toISOString();
    const { count } = await db
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("author_id", context.userId)
      .gte("created_at", since);

    if ((count ?? 0) >= RATE_LIMIT) {
      throw new Error("You're sending messages too quickly. Wait a few seconds.");
    }

    // Scanned, not blocked — see the note in chat/scan.ts. The row carries what
    // matched so the moderator queue can find it later.
    const flagged = scanForOffPlatform(data.body);

    const { data: row, error } = await db
      .from("chat_messages")
      .insert({
        scope: data.scope,
        match_id: matchId ?? null,
        author_id: context.userId,
        body: data.body.trim(),
        flagged,
      } as never)
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { ok: true, id: (row as { id: string }).id, flagged };
  });

/**
 * Recent history for a room.
 *
 * Realtime carries new messages; this is only what was said before the client
 * arrived. Ascending so the newest is at the bottom, which is where a chat
 * reader expects it.
 */
export const listChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ limit: z.number().int().min(1).max(200).optional().default(60) })
      .and(ScopeSchema)
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as UntypedDb;
    const matchId = data.scope === "match" ? data.match_id : undefined;
    await assertRoomAccess(supabaseAdmin, context.userId, data.scope, matchId);

    let q = db
      .from("chat_messages")
      .select("id, author_id, body, flagged, created_at")
      .is("deleted_at", null)
      .eq("scope", data.scope)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    q = data.scope === "match" ? q.eq("match_id", matchId) : q.is("match_id", null);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = ((rows ?? []) as any[]).slice().reverse();
    const authorIds = Array.from(new Set(list.map((m) => m.author_id)));

    const { data: profiles } = authorIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", authorIds)
      : { data: [] };

    const byId = new Map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((profiles ?? []) as any[]).map((p) => [p.id, p]),
    );

    return list.map((m) => ({
      id: m.id as string,
      body: m.body as string,
      flagged: (m.flagged ?? []) as string[],
      created_at: m.created_at as string,
      author_id: m.author_id as string,
      author_name:
        byId.get(m.author_id)?.display_name || byId.get(m.author_id)?.username || "Player",
      author_avatar: (byId.get(m.author_id)?.avatar_url as string | null) ?? null,
      mine: m.author_id === context.userId,
    }));
  });

/** Report a message to the moderators. */
export const reportChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ message_id: z.string().uuid(), reason: z.string().trim().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as UntypedDb;

    // Upsert on the unique pair rather than insert: reporting twice is a
    // person pressing a button again, not an error worth showing them.
    const { error } = await db.from("chat_reports").upsert(
      {
        message_id: data.message_id,
        reporter_id: context.userId,
        reason: data.reason.trim(),
      } as never,
      { onConflict: "message_id,reporter_id" } as never,
    );

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** The moderator queue: reported messages, and anything the scanner flagged. */
export const listChatModerationQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ limit: z.number().int().min(1).max(100).optional().default(50) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireCapability(context, "chat.moderate");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as UntypedDb;

    const { data: reports } = await db
      .from("chat_reports")
      .select("id, message_id, reporter_id, reason, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    const { data: flagged } = await db
      .from("chat_messages")
      .select("id, scope, match_id, author_id, body, flagged, created_at, deleted_at")
      .not("flagged", "eq", "{}")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reportRows = (reports ?? []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flaggedRows = (flagged ?? []) as any[];

    const messageIds = Array.from(new Set(reportRows.map((r) => r.message_id)));
    const { data: reported } = messageIds.length
      ? await db
          .from("chat_messages")
          .select("id, scope, match_id, author_id, body, flagged, created_at, deleted_at")
          .in("id", messageIds)
      : { data: [] };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reportedRows = (reported ?? []) as any[];
    const all = [...reportedRows, ...flaggedRows];
    const authorIds = Array.from(new Set(all.map((m) => m.author_id)));

    const { data: profiles } = authorIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, username, display_name")
          .in("id", authorIds)
      : { data: [] };

    const nameById = new Map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((profiles ?? []) as any[]).map((p) => [p.id, p.display_name || p.username || "Player"]),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msgById = new Map(all.map((m: any) => [m.id, m]));

    return {
      reports: reportRows.map((r) => {
        const m = msgById.get(r.message_id);
        return {
          report_id: r.id as string,
          reason: r.reason as string,
          reported_at: r.created_at as string,
          message_id: r.message_id as string,
          body: (m?.body as string) ?? "(message removed)",
          author_id: (m?.author_id as string) ?? null,
          author_name: m ? (nameById.get(m.author_id) ?? "Player") : "Unknown",
          scope: (m?.scope as string) ?? null,
          match_id: (m?.match_id as string) ?? null,
          created_at: (m?.created_at as string) ?? null,
          deleted: Boolean(m?.deleted_at),
        };
      }),
      flagged: flaggedRows.map((m) => ({
        message_id: m.id as string,
        body: m.body as string,
        flagged: (m.flagged ?? []) as string[],
        author_id: m.author_id as string,
        author_name: nameById.get(m.author_id) ?? "Player",
        scope: m.scope as string,
        match_id: (m.match_id as string) ?? null,
        created_at: m.created_at as string,
      })),
    };
  });

/**
 * Hide a message from players.
 *
 * Soft, always. A match room is the record of what two people agreed while
 * money sat in escrow, and a moderator who can destroy that record makes the
 * dispute that follows unresolvable.
 */
export const moderateDeleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ message_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireCapability(context, "chat.moderate");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as UntypedDb;

    const { error } = await db
      .from("chat_messages")
      .update({ deleted_at: new Date().toISOString(), deleted_by: context.userId } as never)
      .eq("id", data.message_id);
    if (error) throw new Error(error.message);

    await db
      .from("chat_reports")
      .update({
        status: "actioned",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      } as never)
      .eq("message_id", data.message_id)
      .eq("status", "open");

    const { recordAudit } = await import("@/lib/audit.server");
    await recordAudit(context.userId, {
      action: "chat.message_deleted",
      target_type: "chat_message",
      target_id: data.message_id,
      summary: "Deleted a chat message",
    });

    return { ok: true };
  });

/** Dismiss a report without touching the message. */
export const moderateDismissReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ report_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireCapability(context, "chat.moderate");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as UntypedDb;

    const { error } = await db
      .from("chat_reports")
      .update({
        status: "dismissed",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      } as never)
      .eq("id", data.report_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Mute or unmute an author. `minutes` omitted means indefinite. */
export const moderateMuteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        minutes: z
          .number()
          .int()
          .min(1)
          .max(60 * 24 * 30)
          .optional(),
        reason: z.string().trim().max(500).optional(),
        unmute: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireCapability(context, "chat.moderate");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as UntypedDb;
    const { recordAudit } = await import("@/lib/audit.server");

    if (data.unmute) {
      const { error } = await db.from("chat_mutes").delete().eq("user_id", data.user_id);
      if (error) throw new Error(error.message);
      await recordAudit(context.userId, {
        action: "chat.unmuted",
        target_type: "user",
        target_id: data.user_id,
        summary: "Lifted a chat mute",
      });
      return { ok: true, muted: false };
    }

    const until = data.minutes ? new Date(Date.now() + data.minutes * 60_000).toISOString() : null;

    const { error } = await db.from("chat_mutes").upsert(
      {
        user_id: data.user_id,
        until,
        reason: data.reason ?? null,
        created_by: context.userId,
      } as never,
      { onConflict: "user_id" } as never,
    );
    if (error) throw new Error(error.message);

    await recordAudit(context.userId, {
      action: "chat.muted",
      target_type: "user",
      target_id: data.user_id,
      summary: until ? `Muted from chat until ${until}` : "Muted from chat indefinitely",
      metadata: { until, reason: data.reason ?? null },
    });

    return { ok: true, muted: true };
  });
