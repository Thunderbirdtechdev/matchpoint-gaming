import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DepositSchema = z.object({
  amount_cents: z.number().int().min(1_000).max(500_000), // $10 – $5,000
});

const CashoutSchema = z.object({
  amount_cents: z.number().int().min(1_000).max(500_000), // $10 – $5,000
  speed: z.enum(["standard", "same_day"]).default("standard"),
});

// Basic anti-fraud velocity limits for withdrawals, since they're now fully
// automatic with no admin review. Conservative starting defaults — tune once
// real volume/patterns are known.
const WITHDRAWAL_VELOCITY_WINDOW_HOURS = 24;
const WITHDRAWAL_VELOCITY_MAX_COUNT = 3;
const WITHDRAWAL_VELOCITY_MAX_CENTS = 200_000; // $2,000 / rolling 24h

function origin() {
  const host = getRequestHost();
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

/** Returns the user's wallet + recent ledger. Creates wallet if missing. */
export const getMyWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("ensure_wallet", { _user_id: context.userId });

    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", context.userId)
      .single();

    const { data: transactions } = await supabaseAdmin
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(25);

    const { data: connect } = await supabaseAdmin
      .from("stripe_connect_accounts")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    const { data: payout } = await supabaseAdmin
      .from("user_payout_methods")
      .select("paypal_email, cashapp_tag")
      .eq("user_id", context.userId)
      .maybeSingle();

    // `escrow_debit` already subtracts the stake from wallets.balance_cents, so
    // that column IS the available balance — money staked in a live match exists
    // only as a held row here. Surfacing it separately is the difference between
    // "your balance dropped" and "your money is in a match".
    const { data: holds } = await supabaseAdmin
      .from("escrow_holds")
      .select("id, amount_cents, challenge_id, tournament_id, created_at")
      .eq("user_id", context.userId)
      .eq("status", "held")
      .order("created_at", { ascending: false });

    const escrowCents = (holds ?? []).reduce((sum, h) => sum + Number(h.amount_cents ?? 0), 0);

    // Deposits that Stripe has not confirmed yet: real money in flight, but not
    // spendable, so it must not be folded into either of the other two numbers.
    const { data: pendingRows } = await supabaseAdmin
      .from("wallet_transactions")
      .select("amount_cents")
      .eq("user_id", context.userId)
      .eq("status", "pending");

    const pendingCents = (pendingRows ?? []).reduce(
      (sum, t) => sum + Math.max(0, Number(t.amount_cents ?? 0)),
      0,
    );

    const availableCents = Number(wallet?.balance_cents ?? 0);

    return {
      wallet,
      transactions: transactions ?? [],
      connect: connect ?? null,
      paypal_email: payout?.paypal_email ?? null,
      cashapp_tag: payout?.cashapp_tag ?? null,
      balances: {
        available_cents: availableCents,
        escrow_cents: escrowCents,
        pending_cents: pendingCents,
        /** Available + escrow. Excludes pending, which isn't yours until it clears. */
        total_cents: availableCents + escrowCents,
      },
      escrow_holds: holds ?? [],
    };
  });

const LEDGER_TYPES = [
  "deposit",
  "withdrawal",
  "entry_fee",
  "prize_payout",
  "platform_fee",
  "refund",
  "escrow_hold",
  "escrow_release",
  "adjustment",
] as const;

/**
 * Paginated, filterable ledger.
 *
 * Separate from `getMyWallet` because the summary is cheap and cached while the
 * ledger changes with every page/filter interaction — bundling them would refetch
 * balances on each page turn.
 */
export const getWalletLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        page: z.number().int().min(0).default(0),
        page_size: z.number().int().min(5).max(100).default(20),
        type: z.enum([...LEDGER_TYPES, "all"]).default("all"),
        status: z.enum(["all", "pending", "completed", "failed", "reversed"]).default("all"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("wallet_transactions")
      .select("*", { count: "exact" })
      .eq("user_id", context.userId);

    if (data.type !== "all") query = query.eq("type", data.type);
    if (data.status !== "all") query = query.eq("status", data.status);

    const from = data.page * data.page_size;
    const {
      data: rows,
      count,
      error,
    } = await query
      .order("created_at", { ascending: false })
      .range(from, from + data.page_size - 1);

    if (error) throw new Error(error.message);

    const total = count ?? 0;
    return {
      items: rows ?? [],
      total,
      page: data.page,
      page_size: data.page_size,
      total_pages: Math.max(1, Math.ceil(total / data.page_size)),
    };
  });

/** Creates a Stripe Checkout session to top up the wallet. Returns the URL. */
export const createDepositCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => DepositSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Module 9 compliance gate. Ships as a no-op unless an operator has switched
    // enforcement on in /security — see src/lib/compliance.server.ts.
    const { assertMoneyEligible } = await import("@/lib/compliance.server");
    await assertMoneyEligible(context.userId);

    const { getStripe } = await import("@/lib/stripe.server");
    const stripe = getStripe();
    const base = origin();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: data.amount_cents,
            product_data: {
              name: "MatchPoint wallet deposit",
              description: `Add $${(data.amount_cents / 100).toFixed(2)} to your wallet balance`,
            },
          },
        },
      ],
      metadata: {
        kind: "wallet_deposit",
        user_id: context.userId,
        amount_cents: String(data.amount_cents),
      },
      payment_intent_data: {
        metadata: {
          kind: "wallet_deposit",
          user_id: context.userId,
          amount_cents: String(data.amount_cents),
        },
      },
      success_url: `${base}/wallet?deposit=success`,
      cancel_url: `${base}/wallet?deposit=cancel`,
    });

    return { url: session.url };
  });

/** Creates (if needed) a Stripe Connect Express account and returns an onboarding link. */
export const createConnectOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getStripe } = await import("@/lib/stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const stripe = getStripe();

    let { data: row } = await supabaseAdmin
      .from("stripe_connect_accounts")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    let stripeAccountId = row?.stripe_account_id;

    if (!stripeAccountId) {
      try {
        const acct = await stripe.accounts.create({
          type: "express",
          capabilities: {
            transfers: { requested: true },
          },
          metadata: { user_id: context.userId },
        });
        stripeAccountId = acct.id;
        const { data: inserted } = await supabaseAdmin
          .from("stripe_connect_accounts")
          .insert({
            user_id: context.userId,
            stripe_account_id: stripeAccountId,
            country: acct.country ?? null,
          })
          .select()
          .single();
        row = inserted;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/signed up for Connect/i.test(msg)) {
          throw new Error(
            "Bank payouts aren't available yet — Stripe Connect isn't enabled on this platform. Use the PayPal cash-out below, or contact support.",
          );
        }
        throw new Error(`Couldn't start payout onboarding: ${msg}`);
      }
    }

    const base = origin();
    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${base}/wallet?connect=refresh`,
      return_url: `${base}/wallet?connect=return`,
      type: "account_onboarding",
    });

    return { url: link.url };
  });

/**
 * Cash out wallet balance to the user's Stripe Connect account, fully
 * automatically — no admin approval. Applies the same-day/standard fee
 * schedule and transfers the net amount; the fee is recorded on the
 * platform revenue ledger via record_platform_fee.
 */
export const createCashout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CashoutSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Module 9 compliance gate. Ships as a no-op unless an operator has switched
    // enforcement on in /security — see src/lib/compliance.server.ts.
    const { assertMoneyEligible } = await import("@/lib/compliance.server");
    await assertMoneyEligible(context.userId);

    const { getStripe } = await import("@/lib/stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { calculateWithdrawalFee } = await import("./fees");
    const stripe = getStripe();

    const { data: connect } = await supabaseAdmin
      .from("stripe_connect_accounts")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!connect?.stripe_account_id || !connect.payouts_enabled) {
      throw new Error("Set up your payout account before cashing out.");
    }

    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", context.userId)
      .single();

    if (!wallet || wallet.balance_cents < data.amount_cents) {
      throw new Error("Insufficient wallet balance.");
    }

    // Velocity check: cap count and total amount of withdrawals per rolling
    // window, since these now process automatically with no admin review.
    const since = new Date(
      Date.now() - WITHDRAWAL_VELOCITY_WINDOW_HOURS * 60 * 60 * 1000,
    ).toISOString();
    const { data: recentWithdrawals, error: velErr } = await supabaseAdmin
      .from("wallet_transactions")
      .select("amount_cents")
      .eq("user_id", context.userId)
      .eq("type", "withdrawal")
      .eq("status", "completed")
      .gte("created_at", since);
    if (velErr) throw velErr;

    const priorCount = recentWithdrawals?.length ?? 0;
    const priorTotalCents = (recentWithdrawals ?? []).reduce(
      (sum: number, r: { amount_cents: number }) => sum + Math.abs(r.amount_cents),
      0,
    );

    if (priorCount + 1 > WITHDRAWAL_VELOCITY_MAX_COUNT) {
      throw new Error(
        `For your security, you can only make ${WITHDRAWAL_VELOCITY_MAX_COUNT} withdrawals per ${WITHDRAWAL_VELOCITY_WINDOW_HOURS} hours. Please try again later or contact support.`,
      );
    }
    if (priorTotalCents + data.amount_cents > WITHDRAWAL_VELOCITY_MAX_CENTS) {
      throw new Error(
        `For your security, withdrawals are capped at $${(WITHDRAWAL_VELOCITY_MAX_CENTS / 100).toFixed(0)} per ${WITHDRAWAL_VELOCITY_WINDOW_HOURS} hours. Please try again later or contact support.`,
      );
    }

    const breakdown = calculateWithdrawalFee(data.amount_cents, data.speed);
    const fee = breakdown.feeCents;
    const net = breakdown.netCents;
    const newBalance = wallet.balance_cents - data.amount_cents;

    // Debit wallet first
    const { error: balErr } = await supabaseAdmin
      .from("wallets")
      .update({ balance_cents: newBalance })
      .eq("id", wallet.id);
    if (balErr) throw balErr;

    // Transfer the NET amount (after fee) to the connected account
    let transferId: string | null = null;
    try {
      const transfer = await stripe.transfers.create({
        amount: net,
        currency: wallet.currency,
        destination: connect.stripe_account_id,
        metadata: { kind: "wallet_cashout", user_id: context.userId, speed: data.speed },
      });
      transferId = transfer.id;
    } catch (err) {
      // Refund the wallet if transfer fails
      await supabaseAdmin
        .from("wallets")
        .update({ balance_cents: wallet.balance_cents })
        .eq("id", wallet.id);
      throw err;
    }

    const speedLabel = data.speed === "same_day" ? "Same-day" : "Standard";
    const { data: tx, error: txErr } = await supabaseAdmin
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        user_id: context.userId,
        type: "withdrawal",
        status: "completed",
        amount_cents: -data.amount_cents,
        balance_after_cents: newBalance,
        currency: wallet.currency,
        description: `${speedLabel} withdrawal to bank (Stripe)`,
        stripe_transfer_id: transferId,
        metadata: { speed: data.speed, fee_cents: fee, net_cents: net },
      })
      .select("id")
      .single();
    if (txErr) throw txErr;

    let fee_warning: string | null = null;
    if (fee > 0) {
      const { error: feeErr } = await supabaseAdmin.rpc("record_platform_fee", {
        _source: data.speed === "same_day" ? "withdrawal_fee_same_day" : "withdrawal_fee_standard",
        _amount_cents: fee,
        _user_id: context.userId,
        _reference_id: tx?.id,
        _gross_cents: data.amount_cents,
        _net_cents: net,
        _metadata: { method: "stripe", speed: data.speed },
      });
      if (feeErr) {
        console.error("[wallet] record_platform_fee failed for stripe cashout", {
          user_id: context.userId,
          transferId,
          error: feeErr,
        });
        fee_warning = feeErr.message;
      }
    }

    try {
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const recipient = userRes?.user?.email;
      if (recipient) {
        const fmtUsd = (cents: number) =>
          new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: (wallet.currency ?? "usd").toUpperCase(),
          }).format(cents / 100);
        const { enqueueAppEmail } = await import("@/lib/email/send-app-email.server");
        await enqueueAppEmail({
          templateName: "user-payout-update",
          recipientEmail: recipient,
          idempotencyKey: `stripe-cashout-${tx.id}`,
          templateData: {
            status: "paid",
            method: "stripe",
            speed: data.speed,
            grossFormatted: fmtUsd(data.amount_cents),
            feeFormatted: fmtUsd(fee),
            netFormatted: fmtUsd(net),
            requestId: tx.id,
          },
        });
      }
    } catch (e) {
      console.error("[wallet] cashout confirmation email failed", e);
    }

    return { ok: true, transferId, fee_cents: fee, net_cents: net, fee_warning };
  });
