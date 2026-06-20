import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getStripe, getWebhookSecret } = await import("@/lib/stripe.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 400 });

        const raw = await request.text();
        const stripe = getStripe();

        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(raw, sig, getWebhookSecret());
        } catch (err) {
          console.error("[stripe-webhook] signature verification failed", err);
          return new Response("Invalid signature", { status: 400 });
        }

        // Idempotency: skip if already processed
        const { data: existing } = await supabaseAdmin
          .from("stripe_events")
          .select("id")
          .eq("id", event.id)
          .maybeSingle();
        if (existing) return new Response("ok", { status: 200 });

        try {
          switch (event.type) {
            case "checkout.session.completed":
            case "checkout.session.async_payment_succeeded": {
              const session = event.data.object as Stripe.Checkout.Session;
              if (
                session.metadata?.kind === "wallet_deposit" &&
                session.payment_status === "paid" &&
                session.metadata.user_id
              ) {
                await creditDeposit({
                  userId: session.metadata.user_id,
                  amountCents: Number(session.metadata.amount_cents ?? session.amount_total ?? 0),
                  sessionId: session.id,
                  paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
                });
              }
              break;
            }
            case "charge.refunded": {
              const charge = event.data.object as Stripe.Charge;
              const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
              if (piId) {
                await refundDeposit({
                  paymentIntentId: piId,
                  refundedCents: charge.amount_refunded ?? 0,
                  chargeId: charge.id,
                });
              }
              break;
            }
            case "transfer.reversed": {
              const transfer = event.data.object as Stripe.Transfer;
              await reverseCashout({ transferId: transfer.id });
              break;
            }
            case "payout.paid":
            case "payout.failed": {
              // Connected-account payout to the user's bank. We don't change
              // wallet state here (the cashout is already reflected); we just
              // record the event so it's visible in stripe_events for audit.
              break;
            }
            case "account.updated": {
              const acct = event.data.object as Stripe.Account;
              await supabaseAdmin
                .from("stripe_connect_accounts")
                .update({
                  charges_enabled: acct.charges_enabled ?? false,
                  payouts_enabled: acct.payouts_enabled ?? false,
                  details_submitted: acct.details_submitted ?? false,
                  country: acct.country ?? null,
                })
                .eq("stripe_account_id", acct.id);
              break;
            }
            default:
              break;
          }

          await supabaseAdmin.from("stripe_events").insert({
            id: event.id,
            type: event.type,
            payload: JSON.parse(JSON.stringify(event)),
          });

          return new Response("ok", { status: 200 });
        } catch (err) {
          console.error("[stripe-webhook] handler error", event.type, err);
          return new Response("handler error", { status: 500 });
        }
      },
    },
  },
});

async function creditDeposit(args: {
  userId: string;
  amountCents: number;
  sessionId: string;
  paymentIntentId: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (args.amountCents <= 0) return;

  // Idempotency on the session id (in case the event id check is bypassed by a retry)
  const { data: dup } = await supabaseAdmin
    .from("wallet_transactions")
    .select("id")
    .eq("stripe_checkout_session_id", args.sessionId)
    .eq("type", "deposit")
    .maybeSingle();
  if (dup) return;

  await supabaseAdmin.rpc("wallet_credit", {
    _user_id: args.userId,
    _amount_cents: args.amountCents,
    _type: "deposit",
    _description: "Wallet deposit",
    _metadata: {
      stripe_checkout_session_id: args.sessionId,
      stripe_payment_intent_id: args.paymentIntentId,
    },
  });

  // Stamp the Stripe ids on the transaction we just created
  await supabaseAdmin
    .from("wallet_transactions")
    .update({
      stripe_checkout_session_id: args.sessionId,
      stripe_payment_intent_id: args.paymentIntentId,
    })
    .eq("user_id", args.userId)
    .eq("type", "deposit")
    .eq("amount_cents", args.amountCents)
    .is("stripe_checkout_session_id", null);
}

async function refundDeposit(args: {
  paymentIntentId: string;
  refundedCents: number;
  chargeId: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (args.refundedCents <= 0) return;

  const { data: tx } = await supabaseAdmin
    .from("wallet_transactions")
    .select("id, user_id, wallet_id, currency")
    .eq("stripe_payment_intent_id", args.paymentIntentId)
    .eq("type", "deposit")
    .maybeSingle();
  if (!tx) return;

  // Prevent double-refund
  const { data: existing } = await supabaseAdmin
    .from("wallet_transactions")
    .select("id")
    .eq("type", "refund")
    .eq("stripe_payment_intent_id", args.paymentIntentId)
    .maybeSingle();
  if (existing) return;

  const { data: wallet } = await supabaseAdmin
    .from("wallets")
    .select("*")
    .eq("id", tx.wallet_id)
    .single();
  if (!wallet) return;

  const newBalance = wallet.balance_cents - args.refundedCents;
  await supabaseAdmin
    .from("wallets")
    .update({ balance_cents: Math.max(0, newBalance) })
    .eq("id", wallet.id);

  await supabaseAdmin.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: tx.user_id,
    type: "refund",
    status: "completed",
    amount_cents: -args.refundedCents,
    balance_after_cents: Math.max(0, newBalance),
    currency: wallet.currency,
    description: "Deposit refunded",
    stripe_payment_intent_id: args.paymentIntentId,
    metadata: { stripe_charge_id: args.chargeId },
  });
}

async function reverseCashout(args: { transferId: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: tx } = await supabaseAdmin
    .from("wallet_transactions")
    .select("*")
    .eq("stripe_transfer_id", args.transferId)
    .eq("type", "withdrawal")
    .maybeSingle();
  if (!tx) return;

  // Prevent double-reversal
  const { data: existing } = await supabaseAdmin
    .from("wallet_transactions")
    .select("id")
    .eq("type", "refund")
    .eq("stripe_transfer_id", args.transferId)
    .maybeSingle();
  if (existing) return;

  const refundAmount = Math.abs(tx.amount_cents);
  const { data: wallet } = await supabaseAdmin
    .from("wallets")
    .select("*")
    .eq("id", tx.wallet_id)
    .single();
  if (!wallet) return;

  const newBalance = wallet.balance_cents + refundAmount;
  await supabaseAdmin
    .from("wallets")
    .update({ balance_cents: newBalance })
    .eq("id", wallet.id);

  await supabaseAdmin.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: tx.user_id,
    type: "refund",
    status: "completed",
    amount_cents: refundAmount,
    balance_after_cents: newBalance,
    currency: wallet.currency,
    description: "Cashout reversed",
    stripe_transfer_id: args.transferId,
  });
}

