import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCapability, requireCanManageRole, grantableRolesFor, rolesOf } from "@/lib/authz";
import { APP_ROLES, type AppRole } from "@/lib/roles";

const CreditWalletSchema = z.object({
  target: z.string().trim().min(1), // user id (uuid) or email
  amount_cents: z.number().int().min(1).max(10_000_000),
  note: z.string().trim().max(200).optional(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Credit a user's wallet directly.
 *
 * Treasury operation, not an ops one: it mints spendable balance out of nothing
 * and writes an `adjustment` ledger row. Gated on `finance.wallet_adjust`, which
 * a plain admin does not hold.
 */
export const adminCreditWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreditWalletSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireCapability(context, "finance.wallet_adjust");
    // Module 9: minting spendable balance out of nothing is the single easiest
    // way to steal from this platform, so it sits behind the second factor.
    const { assertMfaForSensitiveAction } = await import("@/lib/compliance.server");
    await assertMfaForSensitiveAction(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve target user id
    let userId = data.target;
    if (!UUID_RE.test(userId)) {
      // try email lookup via auth admin
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (listErr) throw listErr;
      const match = list.users.find((u) => u.email?.toLowerCase() === data.target.toLowerCase());
      if (!match) throw new Error(`No user found for "${data.target}"`);
      userId = match.id;
    }

    await supabaseAdmin.rpc("ensure_wallet", { _user_id: userId });
    const { data: newBalance, error } = await supabaseAdmin.rpc("wallet_credit", {
      _user_id: userId,
      _amount_cents: data.amount_cents,
      _type: "adjustment",
      _description: data.note ?? "Admin test credit",
      _metadata: { source: "admin_credit", by: context.userId },
    });
    if (error) throw error;

    const { recordAudit } = await import("@/lib/audit.server");
    const audit = await recordAudit(context.userId, {
      action: "finance.wallet_credit",
      target_type: "user",
      target_id: userId,
      amount_cents: data.amount_cents,
      summary: `Credited ${(data.amount_cents / 100).toFixed(2)} to a player wallet`,
      metadata: { note: data.note ?? null, balance_after_cents: newBalance },
    });

    return { ok: true, user_id: userId, balance_cents: newBalance, audit_failed: !audit.ok };
  });

const RoleEnum = z.enum(APP_ROLES);

async function resolveUserId(target: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (UUID_RE.test(target)) return target;
  // Try username on profiles first
  const handle = target.trim().replace(/^@/, "");
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("username", handle)
    .maybeSingle();
  if (prof?.id) return prof.id;
  // Fall back to auth email lookup
  const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const match = list.users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
  if (!match) throw new Error(`No user found for "${target}"`);
  return match.id;
}

const GrantRoleSchema = z.object({
  target: z.string().trim().min(1),
  role: RoleEnum,
  note: z.string().trim().max(300).optional(),
});

/** Append-only record of who changed whose privileges. Never blocks the change. */
async function recordRoleChange(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  entry: {
    target_user_id: string;
    role: AppRole;
    action: "grant" | "revoke";
    actor_id: string;
    note?: string;
  },
) {
  const { error } = await admin.from("role_grants").insert(entry as never);
  // A failed audit write must not silently pass. Surfaced to the caller so the
  // change is visibly incomplete rather than quietly unlogged.
  if (error) throw new Error(`Role change applied but the audit write failed: ${error.message}`);
}

/**
 * Grant a role.
 *
 * Two rules do the real work here:
 *
 *  1. `requireCanManageRole` — an admin may grant `moderator` and nothing else.
 *     Without it an admin could grant themselves `financial_admin` and walk
 *     straight into the treasury, which would make the operations/treasury
 *     split decorative.
 *
 *  2. The `super_admin ⇒ admin` invariant. Every RLS policy predating Module 7
 *     tests `has_role(uid,'admin')` exactly, so a super_admin without the admin
 *     row fails all of them — the most privileged account would be the one
 *     locked out. See §6 of the Module 7 migration.
 */
export const adminGrantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GrantRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireCanManageRole(context, data.role);

    // Module 9: granting a privileged role is how a stolen admin session
    // becomes a permanent one, so it needs the second factor. Granting
    // `moderator` does not — it carries no money capability, and gating it
    // would put the second factor in front of routine day-to-day staffing.
    if (data.role !== "moderator" && data.role !== "user") {
      const { assertMfaForSensitiveAction } = await import("@/lib/compliance.server");
      await assertMfaForSensitiveAction(context);
    }

    const userId = await resolveUserId(data.target);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const roles: AppRole[] = data.role === "super_admin" ? ["super_admin", "admin"] : [data.role];

    const { error } = await supabaseAdmin.from("user_roles").upsert(
      roles.map((role) => ({ user_id: userId, role })),
      { onConflict: "user_id,role" } as never,
    );
    if (error) throw error;

    for (const role of roles) {
      await recordRoleChange(supabaseAdmin, {
        target_user_id: userId,
        role,
        action: "grant",
        actor_id: context.userId,
        note: data.note,
      });
    }

    const { recordAudit } = await import("@/lib/audit.server");
    await recordAudit(context.userId, {
      action: "roles.grant",
      target_type: "user",
      target_id: userId,
      summary: `Granted ${roles.join(" + ")}`,
      metadata: { roles, note: data.note ?? null },
    });

    /*
     * Module 10, closing Module 7's "no email when someone is granted a staff
     * role".
     *
     * This is a security notification as much as a welcome: if the recipient
     * did not expect it, they need to hear about it through a channel an
     * attacker who just escalated their account does not control. The template
     * says as much.
     *
     * `data.role` rather than `roles` — granting super_admin also grants admin
     * to satisfy the Module 7 invariant, and naming both would describe an
     * implementation detail rather than the decision that was made.
     */
    try {
      const { notifyUser, displayNameFor, notifyKey } = await import("@/lib/email/notify.server");
      const { ROLE_LABELS, ROLE_DESCRIPTIONS } = await import("@/lib/roles");
      await notifyUser(
        userId,
        "role-granted",
        {
          roleLabel: ROLE_LABELS[data.role],
          roleDescription: ROLE_DESCRIPTIONS[data.role],
          grantedBy: await displayNameFor(supabaseAdmin, context.userId),
          // Only the roles that can actually move money get pushed toward 2FA.
          requiresMfa: data.role === "super_admin" || data.role === "financial_admin",
        },
        notifyKey("role-granted", userId, data.role),
      );
    } catch (e) {
      console.error("[NOTIFY-FAILED] role granted", e);
    }

    return { ok: true, user_id: userId, roles };
  });

/**
 * Revoke a role.
 *
 * Three things are refused outright, all of them ways to lock the platform out
 * of its own administration:
 *   - dropping your own privileged role (self-lockout, and the usual way an
 *     account gets stranded mid-session);
 *   - removing the last super_admin, after which no privileged role could ever
 *     be granted again by anyone;
 *   - stripping `admin` from an account that still holds `super_admin`, which
 *     would break the invariant above and fail every legacy RLS policy.
 */
export const adminRevokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GrantRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireCanManageRole(context, data.role);
    const userId = await resolveUserId(data.target);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (userId === context.userId && data.role !== "user") {
      throw new Error(
        `You can't revoke your own ${data.role} role. Ask another super admin to do it.`,
      );
    }

    const targetRoles = await rolesOf(supabaseAdmin, userId);

    if (data.role === "admin" && targetRoles.includes("super_admin")) {
      throw new Error(
        "This account is a super admin, which requires the admin role to function. Revoke super admin first.",
      );
    }

    if (data.role === "super_admin") {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "super_admin");
      if ((count ?? 0) <= 1) {
        throw new Error(
          "This is the last super admin. Grant super admin to someone else before revoking this one, otherwise no privileged role could ever be granted again.",
        );
      }
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", data.role);
    if (error) throw error;

    await recordRoleChange(supabaseAdmin, {
      target_user_id: userId,
      role: data.role,
      action: "revoke",
      actor_id: context.userId,
      note: data.note,
    });

    const { recordAudit } = await import("@/lib/audit.server");
    await recordAudit(context.userId, {
      action: "roles.revoke",
      target_type: "user",
      target_id: userId,
      summary: `Revoked ${data.role}`,
      metadata: { role: data.role, note: data.note ?? null },
    });

    return { ok: true, user_id: userId, role: data.role };
  });

/** Every account holding a staff role, with the roles collapsed onto one row each. */
export const adminListStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireCapability(context, "roles.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const staffRoles = APP_ROLES.filter((r) => r !== "user");
    const { data: roleRows, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, created_at")
      .in("role", staffRoles)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const ids = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
    if (!ids.length) return { staff: [], grantable: await grantableRolesFor(context) };

    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", ids);
    const byId = new Map((profs ?? []).map((p) => [p.id, p]));

    // One row per person, not per role — an account with three roles was
    // previously three separate rows in the table, each offering its own
    // Revoke button with no indication they were the same human.
    type StaffProfile = {
      id: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
    };
    const byUser = new Map<
      string,
      { user_id: string; roles: AppRole[]; granted_at: string; profile: StaffProfile | null }
    >();
    for (const r of roleRows ?? []) {
      const existing = byUser.get(r.user_id);
      if (existing) {
        existing.roles.push(r.role as AppRole);
        if (r.created_at < existing.granted_at) existing.granted_at = r.created_at;
      } else {
        byUser.set(r.user_id, {
          user_id: r.user_id,
          roles: [r.role as AppRole],
          granted_at: r.created_at,
          profile: (byId.get(r.user_id) as StaffProfile | undefined) ?? null,
        });
      }
    }

    const rank: Record<string, number> = {
      super_admin: 0,
      admin: 1,
      financial_admin: 2,
      moderator: 3,
    };
    const staff = [...byUser.values()]
      .map((s) => ({ ...s, roles: s.roles.sort((a, b) => rank[a] - rank[b]) }))
      .sort(
        (a, b) => rank[a.roles[0]] - rank[b.roles[0]] || a.granted_at.localeCompare(b.granted_at),
      );

    return { staff, grantable: await grantableRolesFor(context) };
  });

/** The privilege-change audit trail. */
export const adminListRoleAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireCapability(context, "roles.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("role_grants")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw error;

    type AuditRow = {
      target_user_id: string;
      actor_id: string | null;
      role: string;
      action: string;
      note: string | null;
      created_at: string;
      id: string;
    };
    const auditRows = (rows ?? []) as AuditRow[];

    const ids = Array.from(
      new Set(auditRows.flatMap((r) => [r.target_user_id, r.actor_id].filter(Boolean) as string[])),
    );
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, username, display_name").in("id", ids)
      : { data: [] };
    const byId = new Map((profs ?? []).map((p) => [p.id, p]));

    return auditRows.map((r) => ({
      ...r,
      target: byId.get(r.target_user_id) ?? null,
      actor: r.actor_id ? (byId.get(r.actor_id) ?? null) : null,
    }));
  });


// ────────────────────── Company Wallet / Revenue ──────────────────────

/** Admin-only: read the company wallet (running fee balance + lifetime totals). */
export const getCompanyWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireCapability(context, "finance.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("company_wallet")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ?? { balance_cents: 0, lifetime_revenue_cents: 0, lifetime_withdrawn_cents: 0, currency: "usd" };
  });

/** Admin-only: list recent platform-fee events (revenue ledger). */
export const listCompanyRevenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await requireCapability(context, "finance.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("platform_fees")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw error;
    return rows ?? [];
  });

/** Treasury: record a sweep of company funds out to a bank/PayPal/etc. */
export const withdrawCompanyFunds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    amount_cents: z.number().int().min(1),
    destination: z.string().trim().min(2).max(200),
    note: z.string().trim().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireCapability(context, "finance.treasury");
    const { assertMfaForSensitiveAction } = await import("@/lib/compliance.server");
    await assertMfaForSensitiveAction(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: wid, error } = await supabaseAdmin.rpc("company_wallet_withdraw", {
      _amount_cents: data.amount_cents,
      _destination: data.destination,
      _note: data.note ?? undefined,
      _created_by: context.userId,
    } as never);
    if (error) throw new Error(error.message);

    const { recordAudit } = await import("@/lib/audit.server");
    const audit = await recordAudit(context.userId, {
      action: "finance.company_withdrawal",
      target_type: "payout",
      target_id: String(wid ?? ""),
      amount_cents: data.amount_cents,
      summary: `Withdrew ${(data.amount_cents / 100).toFixed(2)} of company funds to ${data.destination}`,
      metadata: { destination: data.destination, note: data.note ?? null },
    });

    return { ok: true, withdrawal_id: wid, audit_failed: !audit.ok };
  });

/** Admin-only: list recent company-fund withdrawals. */
export const listCompanyWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireCapability(context, "finance.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("company_withdrawals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });

/** Admin-only: today / week / month / year / lifetime platform revenue. */
export const getRevenueSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireCapability(context, "finance.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("admin_revenue_summary" as never);
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as
      | { today_cents: number; week_cents: number; month_cents: number; year_cents: number; lifetime_cents: number }
      | null;
    return row ?? { today_cents: 0, week_cents: 0, month_cents: 0, year_cents: 0, lifetime_cents: 0 };
  });

/** Admin-only: platform revenue broken down by fee source. */
export const getRevenueBySource = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireCapability(context, "finance.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("admin_revenue_by_source" as never);
    if (error) throw error;
    return (data ?? []) as { source: string; total_cents: number; event_count: number }[];
  });

/** Admin-only: platform-wide totals — deposits, withdrawals, competitions, tournaments. */
export const getPlatformTotals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireCapability(context, "finance.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [walletRes, challengesRes, tournamentsRes] = await Promise.all([
      supabaseAdmin.rpc("admin_wallet_totals" as never),
      supabaseAdmin.from("challenges").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("tournaments").select("*", { count: "exact", head: true }),
    ]);
    if (walletRes.error) throw walletRes.error;

    const wallet = (Array.isArray(walletRes.data) ? walletRes.data[0] : walletRes.data) as
      | {
          total_deposits_cents: number;
          deposit_count: number;
          total_withdrawals_cents: number;
          withdrawal_count: number;
        }
      | null;

    return {
      total_deposits_cents: wallet?.total_deposits_cents ?? 0,
      deposit_count: wallet?.deposit_count ?? 0,
      total_withdrawals_cents: wallet?.total_withdrawals_cents ?? 0,
      withdrawal_count: wallet?.withdrawal_count ?? 0,
      total_competitions: challengesRes.count ?? 0,
      total_tournaments: tournamentsRes.count ?? 0,
    };
  });

// ────────────────────── Stripe Payouts (cash out to bank) ──────────────────────

async function stripeFetch(path: string, init: { method?: string; body?: Record<string, string> } = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  const body = init.body ? new URLSearchParams(init.body).toString() : undefined;
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `Stripe ${res.status}`);
  return json;
}

/** Admin-only: read Stripe platform balance (available + pending). */
export const getStripeBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireCapability(context, "finance.view");
    const bal = await stripeFetch("/balance");
    const pick = (arr: any[]) =>
      (arr ?? []).map((b: any) => ({ amount: b.amount as number, currency: b.currency as string }));
    return {
      available: pick(bal.available),
      pending: pick(bal.pending),
      livemode: !!bal.livemode,
    };
  });

/**
 * Admin-only: trigger a real Stripe payout from the platform balance to the
 * default external bank account configured on the Stripe account.
 * If amount_cents is omitted, sweeps the full available balance for the currency.
 */
export const stripePayoutToBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        amount_cents: z.number().int().min(1).optional(),
        currency: z.string().trim().length(3).default("usd"),
        note: z.string().trim().max(500).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireCapability(context, "finance.treasury");
    const { assertMfaForSensitiveAction } = await import("@/lib/compliance.server");
    await assertMfaForSensitiveAction(context);

    const currency = data.currency.toLowerCase();

    let amount = data.amount_cents ?? 0;
    if (!amount) {
      const bal = await stripeFetch("/balance");
      const row = (bal.available ?? []).find((b: any) => b.currency === currency);
      amount = row?.amount ?? 0;
      if (!amount || amount <= 0) {
        throw new Error(`No available ${currency.toUpperCase()} balance to pay out.`);
      }
    }

    const payout = await stripeFetch("/payouts", {
      method: "POST",
      body: {
        amount: String(amount),
        currency,
        "metadata[source]": "admin_sweep",
        "metadata[note]": data.note ?? "",
        "metadata[initiated_by]": context.userId,
      },
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const destination = `Stripe payout → bank (${payout.destination ?? "default"})`;
    const note = [data.note, `stripe_payout_id=${payout.id}`].filter(Boolean).join(" · ");
    const { error: rpcErr } = await supabaseAdmin.rpc("company_wallet_withdraw", {
      _amount_cents: amount,
      _destination: destination,
      _note: note,
      _created_by: context.userId,
    } as never);
    const ledger_warning = rpcErr ? rpcErr.message : null;

    // Audited after the Stripe call, not before: an entry written first would
    // record sweeps that never happened if Stripe refused. `ledger_warning`
    // rides along so the log shows a sweep that left the bank but never made it
    // into the company ledger — the discrepancy someone would otherwise chase
    // for hours during a reconciliation.
    const { recordAudit } = await import("@/lib/audit.server");
    await recordAudit(context.userId, {
      action: "finance.stripe_sweep",
      target_type: "payout",
      target_id: String(payout.id ?? ""),
      amount_cents: amount,
      summary: `Swept ${(amount / 100).toFixed(2)} ${currency.toUpperCase()} from Stripe to the bank`,
      metadata: {
        stripe_payout_id: payout.id ?? null,
        currency,
        note: data.note ?? null,
        ledger_warning,
      },
    });

    // Send "initiated" notification to the admin who triggered the payout.
    let email_warning: string | null = null;
    try {
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const recipient = userRes?.user?.email ?? null;
      if (recipient) {
        const { enqueueAppEmail } = await import("@/lib/email/send-app-email.server");
        const fmt = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currency.toUpperCase(),
        }).format(amount / 100);
        const arrival = payout.arrival_date
          ? new Date(payout.arrival_date * 1000).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : null;
        const res = await enqueueAppEmail({
          templateName: "payout-status",
          recipientEmail: recipient,
          idempotencyKey: `payout-initiated-${payout.id}`,
          templateData: {
            status: "initiated",
            amountFormatted: fmt,
            currency,
            payoutId: payout.id,
            initiatedBy: recipient,
            arrivalDate: arrival,
            note: data.note ?? null,
          },
        });
        if (!res.ok) email_warning = res.error;
      } else {
        email_warning = "no admin email on file";
      }
    } catch (e: any) {
      email_warning = e?.message ?? "email send failed";
    }

    return {
      ok: true,
      payout_id: payout.id as string,
      amount_cents: amount,
      currency,
      arrival_date: payout.arrival_date as number | null,
      status: payout.status as string,
      ledger_warning,
      email_warning,
    };
  });

