/**
 * Module 10 — the notification helpers.
 *
 * Every call site needs the same three things: turn a user id into an email
 * address, render and enqueue a template, and — most importantly — never let
 * any of that break the thing it is describing.
 *
 * ⚠️ NOTHING HERE THROWS. That is the whole point.
 *
 * These are called at the end of settlements, payouts and refunds. If looking
 * up an address fails, or the queue insert fails, the money has already moved;
 * throwing would surface "settle match" as an error to a moderator who would
 * then reasonably try again, and the second attempt would settle an already
 * settled match. A missing email is a bad day. A double payout is a real loss.
 *
 * Failures are logged with a greppable `[NOTIFY-FAILED]` prefix — same
 * reasoning as the audit writer in Module 9.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Deterministic idempotency keys.
 *
 * The queue is at-least-once, and these helpers get called from paths that can
 * themselves be retried. A key derived from the event and the recipient means a
 * second attempt collapses onto the first instead of telling a player twice
 * that they won.
 */
export function notifyKey(event: string, ...parts: (string | number | null | undefined)[]): string {
  return [event, ...parts.filter((p) => p !== null && p !== undefined)].join("-");
}

async function emailFor(admin: any, userId: string): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

/** Display name for a user, for use inside a template. Falls back to null. */
export async function displayNameFor(admin: any, userId: string): Promise<string | null> {
  try {
    const { data } = await admin
      .from("profiles")
      .select("username, display_name")
      .eq("id", userId)
      .maybeSingle();
    return data?.display_name || data?.username || null;
  } catch {
    return null;
  }
}

/**
 * Send one template to one user. Resolves the address itself.
 * Returns whether it was enqueued, for callers that want to report it.
 */
export async function notifyUser(
  userId: string,
  templateName: string,
  templateData: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const recipient = await emailFor(supabaseAdmin, userId);
    if (!recipient) {
      console.error(`[NOTIFY-FAILED] ${templateName}: no email address for user ${userId}`);
      return false;
    }

    const { enqueueAppEmail } = await import("@/lib/email/send-app-email.server");
    const res = await enqueueAppEmail({
      templateName,
      recipientEmail: recipient,
      templateData,
      idempotencyKey,
    });

    if (!res.ok) {
      // `recipient_suppressed` is an expected outcome, not a fault — the player
      // unsubscribed or previously bounced. Logging it as a failure would train
      // whoever reads these logs to ignore them.
      if (res.error !== "recipient_suppressed") {
        console.error(`[NOTIFY-FAILED] ${templateName} → ${userId}: ${res.error}`);
      }
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[NOTIFY-FAILED] ${templateName} → ${userId}:`, e);
    return false;
  }
}

/**
 * Send one template to every staff account holding a capability.
 *
 * Used for the security alert. Resolving recipients by CAPABILITY rather than
 * by role means the alert list stays correct when roles change — a new role
 * that can review flags starts receiving them without anyone remembering to
 * update a list here.
 */
export async function notifyStaffWithCapability(
  capability: string,
  templateName: string,
  templateData: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<number> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: caps } = await supabaseAdmin
      .from("role_capabilities")
      .select("role")
      .eq("capability", capability);
    const roles = Array.from(new Set(((caps ?? []) as any[]).map((c) => c.role)));
    if (!roles.length) return 0;

    const { data: holders } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", roles as any);
    const userIds = Array.from(new Set(((holders ?? []) as any[]).map((r) => r.user_id)));
    if (!userIds.length) return 0;

    let sent = 0;
    for (const userId of userIds) {
      // The key includes the recipient so each staff member gets their own
      // copy — a shared key would let the queue dedupe all but the first.
      const ok = await notifyUser(
        userId,
        templateName,
        templateData,
        idempotencyKey ? `${idempotencyKey}-${userId}` : undefined,
      );
      if (ok) sent += 1;
    }
    return sent;
  } catch (e) {
    console.error(`[NOTIFY-FAILED] staff broadcast ${templateName}:`, e);
    return 0;
  }
}

/** Money formatter shared by every template call site, so "$5" never ships as "5". */
export function usd(cents: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    (cents ?? 0) / 100,
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
