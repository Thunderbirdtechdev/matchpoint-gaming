import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DepositSchema = z.object({
  amount_cents: z.number().int().min(500).max(500_000), // $5 – $5,000
});

const CashoutSchema = z.object({
  amount_cents: z.number().int().min(1_000).max(500_000), // $10 – $5,000
  speed: z.enum(["standard", "same_day"]).default("standard"),
});

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

    return {
      wallet,
      transactions: transactions ?? [],
      connect: connect ?? null,
      paypal_email: payout?.paypal_email ?? null,
      cashapp_tag: payout?.cashapp_tag ?? null,
    };
  });

/** Creates a Stripe Checkout session to top up the wallet. Returns the URL. */
export const createDepositCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => DepositSchema.parse(d))
  .handler(async ({ data, context }) => {
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
          .insert({ user_id: context.userId, stripe_account_id: stripeAccountId, country: acct.country ?? null })
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
          new Intl.NumberFormat("en-US", { style: "currency", currency: (wallet.currency ?? "usd").toUpperCase() }).format(cents / 100);
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
