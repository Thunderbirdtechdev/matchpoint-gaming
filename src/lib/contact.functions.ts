/**
 * The contact form's missing back half.
 *
 * The page and its fields were built; the submit button was attached to
 * nothing. Everything below is what was never there.
 *
 * Stored first, emailed second. The row is the record and the email is a
 * notification about it, which is the right way round for something Kevin wants
 * to receive sales leads through — a bounced notification then costs a delay
 * rather than the enquiry itself.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireCapability } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Not in the generated types yet.
 *
 * `src/integrations/supabase/types.ts` is generated from the DEPLOYED schema,
 * so it cannot know `contact_messages` until this migration has been applied
 * and the types regenerated. Confined to one alias rather than hand-editing a
 * generated file, which the next regeneration would undo. Delete it — and this
 * comment — once the types have caught up; the call sites already use the real
 * column names.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDb = any;

export const CONTACT_TOPICS = ["general", "partnership", "support", "press"] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const TOPIC_LABELS: Record<ContactTopic, string> = {
  general: "General enquiry",
  partnership: "Run tournaments with MatchPoint",
  support: "Help with my account",
  press: "Press or media",
};

const ContactSchema = z.object({
  topic: z.enum(CONTACT_TOPICS).default("general"),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  organisation: z.string().trim().max(200).optional(),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
});

/** Enquiries accepted from one address in the window. */
const RATE_LIMIT = 3;
const RATE_WINDOW_MINUTES = 10;

/**
 * Submit an enquiry. Deliberately NOT behind auth — most people asking about
 * white-labelling the bracket software will not have a player account, and
 * requiring one would filter out exactly the enquiries this exists to catch.
 */
export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => ContactSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as UntypedDb;
    const email = data.email.toLowerCase();

    // Rate limit per address. Crude, and enough: an open form on the public
    // internet gets found, and the alternative to some throttle is a table
    // nobody can read.
    const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await db
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", since);

    if ((count ?? 0) >= RATE_LIMIT) {
      throw new Error("You've sent a few messages already. Give us a little time to reply.");
    }

    const { data: row, error } = await db
      .from("contact_messages")
      .insert({
        topic: data.topic,
        name: data.name,
        email,
        organisation: data.organisation || null,
        subject: data.subject,
        message: data.message,
      } as never)
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    /*
     * Tell staff, but never let that failure reach the sender.
     *
     * The enquiry is already saved. Someone who has just written in should not
     * be shown an error — and be lost as a lead — because a notification could
     * not be sent about a row that exists. Same reasoning as notify.server.ts.
     */
    try {
      const { notifyStaffWithCapability } = await import("@/lib/email/notify.server");
      await notifyStaffWithCapability(
        "moderation.tickets",
        "contact-message",
        {
          topic: TOPIC_LABELS[data.topic],
          name: data.name,
          email,
          organisation: data.organisation ?? null,
          subject: data.subject,
          message: data.message,
        },
        `contact-${(row as { id: string }).id}`,
      );
    } catch (e) {
      console.error("[NOTIFY-FAILED] contact message", e);
    }

    return { ok: true as const };
  });

/** Staff inbox. Same capability as support tickets — same people, same job. */
export const listContactMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        status: z.enum(["new", "read", "replied", "closed"]).optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireCapability(context, "moderation.tickets");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as UntypedDb;

    let q = db
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Move an enquiry through the queue. */
export const updateContactMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "read", "replied", "closed"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireCapability(context, "moderation.tickets");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as UntypedDb;

    const { error } = await db
      .from("contact_messages")
      .update({
        status: data.status,
        handled_by: context.userId,
        handled_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
