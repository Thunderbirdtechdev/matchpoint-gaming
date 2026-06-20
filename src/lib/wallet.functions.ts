import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DepositSchema = z.object({
  amount_cents: z.number().int().min(500).max(500_000), // $5 – $5,000
});

const CashoutSchema = z.object({
  amount_cents: z.number().int().min(100),
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

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("paypal_email, cashapp_tag")
      .eq("id", context.userId)
      .maybeSingle();

    return {
      wallet,
      transactions: transactions ?? [],
      connect: connect ?? null,
      paypal_email: profile?.paypal_email ?? null,
      cashapp_tag: profile?.cashapp_tag ?? null,
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

/** Cash out wallet balance to the user's Connect account via Stripe Transfer. */
export const createCashout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CashoutSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { getStripe } = await import("@/lib/stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

    const newBalance = wallet.balance_cents - data.amount_cents;

    // Debit wallet first
    const { error: balErr } = await supabaseAdmin
      .from("wallets")
      .update({ balance_cents: newBalance })
      .eq("id", wallet.id);
    if (balErr) throw balErr;

    // Transfer to connected account
    let transferId: string | null = null;
    try {
      const transfer = await stripe.transfers.create({
        amount: data.amount_cents,
        currency: wallet.currency,
        destination: connect.stripe_account_id,
        metadata: { kind: "wallet_cashout", user_id: context.userId },
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

    await supabaseAdmin.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      user_id: context.userId,
      type: "withdrawal",
      status: "completed",
      amount_cents: -data.amount_cents,
      balance_after_cents: newBalance,
      currency: wallet.currency,
      description: "Cash out to bank",
      stripe_transfer_id: transferId,
    });

    return { ok: true, transferId };
  });
