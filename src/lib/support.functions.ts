import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { can } from "@/lib/authz";

/**
 * Support tickets.
 *
 * Everything that decides how a message is *presented* or where a ticket sits
 * in the queue is stamped server-side. `is_staff` in particular: it drives the
 * "MatchPoint Support" styling on a message, so a player able to set it could
 * impersonate support inside their own thread.
 */

const SIGNED_URL_TTL_SECONDS = 300;

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/**
 * Module 7: this was a hardcoded `.in("role", ["moderator", "admin"])`, which
 * silently excluded super_admin — the most privileged account on the platform
 * could not answer a support ticket. Asking for the capability instead means a
 * new staff role is picked up here without touching this file.
 */
type AuthCtx = Parameters<typeof can>[0];
async function isStaff(ctx: AuthCtx): Promise<boolean> {
  return can(ctx, "moderation.tickets");
}

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        category: z.enum(["payout", "deposit", "match", "account", "bug", "other"]),
        subject: z.string().trim().min(4).max(150),
        body: z.string().trim().min(10).max(4000),
        challenge_id: z.string().uuid().optional(),
        tournament_id: z.string().uuid().optional(),
        attachment_path: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.attachment_path && !data.attachment_path.startsWith(`${context.userId}/`)) {
      throw new Error("That file does not belong to you.");
    }

    const { data: ticket, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id: context.userId,
        category: data.category,
        subject: data.subject,
        challenge_id: data.challenge_id ?? null,
        tournament_id: data.tournament_id ?? null,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: msgError } = await supabaseAdmin.from("support_messages").insert({
      ticket_id: ticket.id,
      author_id: context.userId,
      body: data.body,
      is_staff: false,
      attachment_path: data.attachment_path ?? null,
    } as never);
    if (msgError) throw new Error(msgError.message);

    return { ok: true as const, ticket_id: ticket.id as string };
  });

export const replyToTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        ticket_id: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
        attachment_path: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ticket } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, status, subject")
      .eq("id", data.ticket_id)
      .maybeSingle();
    if (!ticket) throw new Error("Ticket not found.");

    const staff = await isStaff(context);
    if (ticket.user_id !== context.userId && !staff) {
      throw new Error("You can only reply to your own tickets.");
    }
    if (ticket.status === "closed") throw new Error("That ticket is closed.");

    if (data.attachment_path && !data.attachment_path.startsWith(`${context.userId}/`)) {
      throw new Error("That file does not belong to you.");
    }

    const { error } = await supabaseAdmin.from("support_messages").insert({
      ticket_id: data.ticket_id,
      author_id: context.userId,
      body: data.body,
      is_staff: staff,
      attachment_path: data.attachment_path ?? null,
    } as never);
    if (error) throw new Error(error.message);

    // A staff reply awaits the player; a player reply puts it back in the queue.
    await supabaseAdmin
      .from("support_tickets")
      .update({ status: staff ? "pending" : "open", updated_at: new Date().toISOString() })
      .eq("id", data.ticket_id);

    /*
     * Module 10, closing Module 6's "no email when staff reply".
     *
     * Only STAFF replies are mailed, and only to the ticket owner. Mailing
     * staff on a player reply would need a recipient list this function has no
     * business owning — the queue on /moderator is where that belongs — and
     * mailing the player their own reply back is pure noise.
     *
     * The idempotency key includes a timestamp rather than just the ticket id,
     * because unlike a settlement a ticket gets many replies and they must not
     * collapse onto one another.
     */
    if (staff) {
      try {
        const { notifyUser, displayNameFor, notifyKey } = await import("@/lib/email/notify.server");
        await notifyUser(
          ticket.user_id,
          "support-reply",
          {
            ticketSubject: (ticket as { subject?: string }).subject ?? null,
            staffName: await displayNameFor(supabaseAdmin, context.userId),
            // Truncated on purpose — the email is a nudge to come back and
            // read the thread, not a mirror of it. See support-reply.tsx.
            replyPreview:
              data.body.length > 300 ? `${data.body.slice(0, 300).trimEnd()}…` : data.body,
            ticketId: ticket.id,
            status: "pending",
          },
          notifyKey("support-reply", ticket.id, Date.now()),
        );
      } catch (e) {
        console.error("[NOTIFY-FAILED] support reply", e);
      }
    }

    return { ok: true as const };
  });

export const updateTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        ticket_id: z.string().uuid(),
        status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        assign_to_me: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!(await isStaff(context))) {
      throw new Error("Support staff only.");
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.status) {
      patch.status = data.status;
      if (data.status === "resolved") patch.resolved_at = new Date().toISOString();
    }
    if (data.priority) patch.priority = data.priority;
    if (data.assign_to_me) patch.assigned_to = context.userId;

    const { error } = await supabaseAdmin
      .from("support_tickets")
      .update(patch as never)
      .eq("id", data.ticket_id);
    if (error) throw new Error(error.message);

    // Only status changes are audited, not assignment churn. A ticket picked up
    // and handed on three times is workflow noise; closing one is a decision
    // someone may later need to account for.
    if (data.status) {
      const { recordAudit } = await import("@/lib/audit.server");
      await recordAudit(context.userId, {
        action: "moderation.ticket_update",
        target_type: "ticket",
        target_id: data.ticket_id,
        summary: `Set a support ticket to ${data.status}`,
        metadata: { status: data.status, priority: data.priority ?? null },
      });
    }

    return { ok: true as const };
  });

/** One ticket with its thread. Attachments come back as short-lived signed URLs. */
export const getTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticket_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ticket } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("id", data.ticket_id)
      .maybeSingle();
    if (!ticket) throw new Error("Ticket not found.");

    const staff = await isStaff(context);
    if (ticket.user_id !== context.userId && !staff) {
      throw new Error("You can only view your own tickets.");
    }

    const { data: rows } = await supabaseAdmin
      .from("support_messages")
      .select("*")
      .eq("ticket_id", data.ticket_id)
      .order("created_at", { ascending: true });

    const messages = await Promise.all(
      (rows ?? []).map(async (m) => {
        let url: string | null = null;
        if (m.attachment_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("support-attachments")
            .createSignedUrl(m.attachment_path, SIGNED_URL_TTL_SECONDS);
          url = signed?.signedUrl ?? null;
        }
        return {
          id: m.id,
          author_id: m.author_id,
          body: m.body,
          is_staff: m.is_staff,
          created_at: m.created_at,
          attachment_url: url,
        };
      }),
    );

    return { ticket, messages, viewer_is_staff: staff };
  });
