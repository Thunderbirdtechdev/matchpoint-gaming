/**
 * Module 9 — the audit writer.
 *
 * Module 7 audited role changes into `role_grants` because that one event had
 * to survive from day one: a granted admin can rewrite almost anything else
 * afterwards. This is the general trail it deferred — every privileged action
 * that moves money, overrides an outcome, or changes what the platform enforces.
 *
 * `.server.ts` and never imported at the top level of a `*.functions.ts` file:
 * those ship to the client bundle, and this module reaches the service-role
 * client. Load it the way the rest of the project loads server-only code:
 *
 *     const { recordAudit } = await import("@/lib/audit.server");
 */

import { getRequest } from "@tanstack/react-start/server";

/**
 * The catalogue of audited actions.
 *
 * A union rather than a free string so a typo becomes a compile error instead
 * of a row nobody's filter will ever match. The dotted prefix is the lane the
 * action belongs to, which is what the log viewer groups by.
 */
export type AuditAction =
  // treasury — real money leaving or entering platform control
  | "finance.stripe_sweep"
  | "finance.company_withdrawal"
  | "finance.wallet_credit"
  | "finance.payout_decision"
  // moderation — outcomes and escrow
  | "moderation.dispute_recommend"
  | "moderation.dispute_approve"
  | "moderation.dispute_reject"
  | "moderation.challenge_override"
  | "moderation.ticket_update"
  // platform
  | "promo.create"
  | "promo.toggle"
  // roles (also written to role_grants, see below)
  | "roles.grant"
  | "roles.revoke"
  // security
  | "security.setting_change"
  | "security.mfa_reset"
  | "security.scan_run"
  | "security.flag_triage";

export type AuditEntry = {
  action: AuditAction;
  /** One human sentence. This is the column a person actually reads. */
  summary: string;
  target_type?:
    | "user"
    | "challenge"
    | "dispute"
    | "payout"
    | "ticket"
    | "promo"
    | "setting"
    | "flag";
  target_id?: string | null;
  target_label?: string | null;
  /** Money involved, positive regardless of direction. Lets one query total what staff moved. */
  amount_cents?: number | null;
  metadata?: Record<string, unknown>;
};

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Who the actor was AT THE TIME, frozen into the row.
 *
 * The alternative — joining `user_roles` when the log is read — answers a
 * different question than the one an audit asks. An admin demoted after the
 * fact would have their past treasury moves rendered as if a plain player had
 * made them, and a deleted account's actions would lose their attribution
 * entirely. Two extra reads on an action that happens a few times a day is a
 * cheap price for a log that stays true.
 */
async function snapshotActor(
  admin: any,
  userId: string,
): Promise<{ label: string | null; roles: string[] | null }> {
  try {
    const [profile, roles] = await Promise.all([
      admin.from("profiles").select("username, display_name").eq("id", userId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const p = profile?.data as { username?: string | null; display_name?: string | null } | null;
    return {
      label: p?.display_name ?? p?.username ?? null,
      roles: ((roles?.data ?? []) as { role: string }[]).map((r) => r.role).sort(),
    };
  } catch {
    // A missing profile must not cost us the audit row — the ids are the part
    // that matters, the labels are a convenience for whoever reads it.
    return { label: null, roles: null };
  }
}

/** Request metadata, when there is a request. Absent in a background call. */
function requestContext(): { ip: string | null; user_agent: string | null } {
  try {
    const req = getRequest();
    const h = req?.headers;
    if (!h) return { ip: null, user_agent: null };
    // x-forwarded-for is a client-controlled header and can be spoofed. It is
    // recorded as a hint for an investigator, never used to authorize anything.
    const forwarded = h.get("x-forwarded-for");
    return {
      ip: forwarded ? forwarded.split(",")[0].trim() : null,
      user_agent: h.get("user-agent"),
    };
  } catch {
    return { ip: null, user_agent: null };
  }
}

/**
 * Append one entry. Returns whether it landed.
 *
 * ⚠️ THIS DELIBERATELY DOES NOT THROW, and that is a reversal of the rule
 * Module 7 set for `role_grants`.
 *
 * The reason is ordering. An audit entry is written AFTER its action succeeds —
 * writing it first would log sweeps that never happened. So by the time this
 * runs, the money has already moved. Throwing here would report "failed" for an
 * action that in fact completed, and the operator's natural response to a failed
 * treasury move is to try it again. Losing an audit line is bad; a double
 * payout because the audit line was lost is worse.
 *
 * Failures are loud in the server log and returned to the caller, so a handler
 * can pass `audit_failed` back to the UI rather than pretending everything is
 * fine.
 */
export async function recordAudit(
  actorId: string | null,
  entry: AuditEntry,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const actor = actorId
      ? await snapshotActor(supabaseAdmin, actorId)
      : { label: null, roles: null };
    const { ip, user_agent } = requestContext();

    const { error } = await supabaseAdmin.from("audit_log").insert({
      actor_id: actorId,
      actor_label: actor.label,
      actor_roles: actor.roles,
      action: entry.action,
      target_type: entry.target_type ?? null,
      target_id: entry.target_id ?? null,
      target_label: entry.target_label ?? null,
      summary: entry.summary,
      amount_cents: entry.amount_cents ?? null,
      metadata: (entry.metadata ?? {}) as never,
      ip,
      user_agent,
    } as never);

    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Distinctive prefix so this is greppable in the hosting provider's logs —
    // an action that happened with no record of it is the one failure here that
    // must never be quiet.
    console.error(`[AUDIT-WRITE-FAILED] ${entry.action}: ${message}`, entry);
    return { ok: false, error: message };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
