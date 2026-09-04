/**
 * Module 8 — Financial dashboard data.
 *
 * All read-only. Nothing here moves money: the treasury paths (Stripe sweep,
 * company withdrawal, payout processing) stay in admin.functions.ts and
 * payouts.functions.ts where they already are, gated on `finance.treasury` /
 * `finance.payouts`.
 *
 * Everything below asks only for `finance.view`, which admin, financial_admin
 * and super_admin all hold — reporting is deliberately the widest finance
 * capability, because seeing the numbers is not the same as being able to act
 * on them.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCapability } from "@/lib/authz";

/**
 * A date range, as plain YYYY-MM-DD strings.
 *
 * Dates rather than timestamps because the SQL side buckets by UTC day, and
 * passing a timestamp would imply a precision the report does not have. Both
 * bounds are inclusive.
 */
const RangeSchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD"),
  })
  .refine((r) => r.from <= r.to, { message: "from must not be after to" })
  .refine(
    // Bounds the work a single request can ask for. The daily series
    // gap-fills one row per day, so an unbounded range would let a caller
    // request a series of arbitrary length.
    (r) => (Date.parse(r.to) - Date.parse(r.from)) / 86_400_000 <= 1100,
    { message: "Range is too long, 3 years maximum." },
  );

export type RevenueDayRow = { day: string; total_cents: number; event_count: number };
export type RevenueSourceRow = { source: string; total_cents: number; event_count: number };

/** Gap-filled daily fee revenue for the range, plus its total. */
export const getRevenueDaily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireCapability(context, "finance.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin.rpc(
      "admin_revenue_daily" as never,
      {
        _from: data.from,
        _to: data.to,
      } as never,
    );
    if (error) throw new Error(error.message);

    const series = ((rows ?? []) as RevenueDayRow[]).map((r) => ({
      day: String(r.day),
      total_cents: Number(r.total_cents),
      event_count: Number(r.event_count),
    }));

    return {
      series,
      total_cents: series.reduce((sum, r) => sum + r.total_cents, 0),
      event_count: series.reduce((sum, r) => sum + r.event_count, 0),
    };
  });

/** Fee revenue split by source, over the same range as the chart. */
export const getRevenueBySourceRange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireCapability(context, "finance.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin.rpc(
      "admin_revenue_by_source_range" as never,
      { _from: data.from, _to: data.to } as never,
    );
    if (error) throw new Error(error.message);

    return ((rows ?? []) as RevenueSourceRow[]).map((r) => ({
      source: String(r.source),
      total_cents: Number(r.total_cents),
      event_count: Number(r.event_count),
    }));
  });

/**
 * What the platform owes vs what it holds.
 *
 * The DB knows about player wallets, escrow and pending payouts. It does not
 * know the Stripe balance, which is why that half is fetched from Stripe here
 * and merged. A Stripe failure degrades rather than throws: the obligations are
 * still worth showing, and losing the whole panel because an API call timed out
 * would be the wrong trade.
 */
export const getPlatformLiabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireCapability(context, "finance.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin.rpc("admin_platform_liabilities" as never);
    if (error) throw new Error(error.message);

    const row = (Array.isArray(data) ? data[0] : data) as Record<string, number> | null;
    const n = (k: string) => Number(row?.[k] ?? 0);

    const player_balance_cents = n("player_balance_cents");
    const escrow_held_cents = n("escrow_held_cents");
    const pending_payout_cents = n("pending_payout_cents");
    const company_balance_cents = n("company_balance_cents");

    // Disjoint by construction — see the comment on admin_platform_liabilities.
    const obligations_cents = player_balance_cents + escrow_held_cents + pending_payout_cents;

    let stripe_available_cents: number | null = null;
    let stripe_pending_cents: number | null = null;
    let stripe_error: string | null = null;
    try {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
      const res = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${key}` },
      });
      const json = (await res.json()) as {
        available?: { amount: number; currency: string }[];
        pending?: { amount: number; currency: string }[];
        error?: { message?: string };
      };
      if (!res.ok) throw new Error(json?.error?.message || `Stripe ${res.status}`);
      stripe_available_cents =
        (json.available ?? []).find((b) => b.currency === "usd")?.amount ?? 0;
      stripe_pending_cents = (json.pending ?? []).find((b) => b.currency === "usd")?.amount ?? 0;
    } catch (e) {
      stripe_error = e instanceof Error ? e.message : "Stripe balance unavailable";
    }

    // Only counts settled Stripe funds. Pending Stripe money is real but not yet
    // usable, so treating it as coverage would overstate the platform's ability
    // to pay out today — which is the entire question this panel answers.
    const held_cents = stripe_available_cents ?? 0;
    const coverage_ratio = obligations_cents > 0 ? held_cents / obligations_cents : null;

    return {
      player_balance_cents,
      escrow_held_cents,
      pending_payout_cents,
      company_balance_cents,
      obligations_cents,
      funded_wallet_count: n("funded_wallet_count"),
      open_escrow_count: n("open_escrow_count"),
      pending_payout_count: n("pending_payout_count"),
      stripe_available_cents,
      stripe_pending_cents,
      stripe_error,
      /** null when Stripe could not be read, or when nothing is owed. */
      coverage_ratio: stripe_error ? null : coverage_ratio,
    };
  });

const ExportSchema = RangeSchema.and(
  z.object({ dataset: z.enum(["fees", "payouts", "withdrawals"]) }),
);

/**
 * Rows for a CSV export. The file itself is assembled in the browser
 * (`src/lib/csv.ts`) so the server stays a plain data source and the column
 * layout lives next to the table that displays it.
 *
 * Capped at 5000 rows. A silent truncation in a financial export would be
 * genuinely dangerous — someone reconciles against it and the missing rows look
 * like missing money — so the cap is reported back and the UI says so.
 */
export const getFinanceExportRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ExportSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireCapability(context, "finance.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const LIMIT = 5000;
    const fromTs = `${data.from}T00:00:00.000Z`;
    // Exclusive upper bound one day past `to`, so the end date is fully included.
    const toTs = new Date(`${data.to}T00:00:00.000Z`);
    toTs.setUTCDate(toTs.getUTCDate() + 1);
    const toIso = toTs.toISOString();

    const table =
      data.dataset === "fees"
        ? "platform_fees"
        : data.dataset === "payouts"
          ? "manual_payout_requests"
          : "company_withdrawals";

    const {
      data: rows,
      error,
      count,
    } = await supabaseAdmin
      .from(table)
      .select("*", { count: "exact" })
      .gte("created_at", fromTs)
      .lt("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as Record<string, unknown>[];

    // Payout and fee rows carry a user_id but no name, and a CSV of bare uuids
    // is not something anyone can reconcile against.
    const userIds = Array.from(
      new Set(list.map((r) => r.user_id).filter((v): v is string => typeof v === "string")),
    );
    const profiles = userIds.length
      ? ((
          await supabaseAdmin
            .from("profiles")
            .select("id, username, display_name")
            .in("id", userIds)
        ).data ?? [])
      : [];
    const byId = new Map(
      (profiles as { id: string; username: string | null; display_name: string | null }[]).map(
        (p) => [p.id, p],
      ),
    );

    return {
      rows: list.map((r) => ({
        ...r,
        _username:
          typeof r.user_id === "string"
            ? (byId.get(r.user_id)?.username ?? byId.get(r.user_id)?.display_name ?? null)
            : null,
      })),
      total_count: count ?? list.length,
      truncated: (count ?? 0) > LIMIT,
      limit: LIMIT,
    };
  });
