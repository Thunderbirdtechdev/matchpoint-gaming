import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreditWalletSchema = z.object({
  target: z.string().trim().min(1), // user id (uuid) or email
  amount_cents: z.number().int().min(1).max(10_000_000),
  note: z.string().trim().max(200).optional(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admin-only: credit a test user's wallet (for sandbox payout testing). */
export const adminCreditWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreditWalletSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw roleErr;
    if (!isAdmin) throw new Error("Forbidden");

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

    return { ok: true, user_id: userId, balance_cents: newBalance };
  });

const RoleEnum = z.enum(["admin", "moderator", "user"]);

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

async function assertCallerIsAdmin(ctx: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!isAdmin) throw new Error("Forbidden");
}

const GrantRoleSchema = z.object({
  target: z.string().trim().min(1),
  role: RoleEnum,
});

/** Admin-only: grant a role to a user (by uuid, username, or email). */
export const adminGrantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GrantRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context);
    const userId = await resolveUserId(data.target);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role" } as never);
    if (error) throw error;
    return { ok: true, user_id: userId, role: data.role };
  });

/** Admin-only: revoke a role from a user. Cannot revoke your own admin. */
export const adminRevokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GrantRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context);
    const userId = await resolveUserId(data.target);
    if (data.role === "admin" && userId === context.userId) {
      throw new Error("You can't revoke your own admin role.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", data.role);
    if (error) throw error;
    return { ok: true, user_id: userId, role: data.role };
  });

/** Admin-only: list all users with admin or moderator role. */
export const adminListStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCallerIsAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, created_at")
      .in("role", ["admin", "moderator"])
      .order("created_at", { ascending: false });
    if (error) throw error;
    const ids = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
    if (!ids.length) return [];
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", ids);
    const byId = new Map((profs ?? []).map((p) => [p.id, p]));
    return (roleRows ?? []).map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
  });


// ────────────────────── Company Wallet / Revenue ──────────────────────

async function assertAdminAdmin(ctx: any) {
  const { data: isAdmin, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!isAdmin) throw new Error("Forbidden");
}

/** Admin-only: read the company wallet (running fee balance + lifetime totals). */
export const getCompanyWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminAdmin(context);
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
    await assertAdminAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("platform_fees")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw error;
    return rows ?? [];
  });

/** Admin-only: record a sweep of company funds out to a bank/PayPal/etc. */
export const withdrawCompanyFunds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    amount_cents: z.number().int().min(1),
    destination: z.string().trim().min(2).max(200),
    note: z.string().trim().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: wid, error } = await supabaseAdmin.rpc("company_wallet_withdraw", {
      _amount_cents: data.amount_cents,
      _destination: data.destination,
      _note: data.note ?? undefined,
      _created_by: context.userId,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true, withdrawal_id: wid };
  });

/** Admin-only: list recent company-fund withdrawals. */
export const listCompanyWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminAdmin(context);
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
    await assertAdminAdmin(context);
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
    await assertAdminAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("admin_revenue_by_source" as never);
    if (error) throw error;
    return (data ?? []) as { source: string; total_cents: number; event_count: number }[];
  });

/** Admin-only: platform-wide totals — deposits, withdrawals, competitions, tournaments. */
export const getPlatformTotals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminAdmin(context);
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
    await assertAdminAdmin(context);
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
    await assertAdminAdmin(context);
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

