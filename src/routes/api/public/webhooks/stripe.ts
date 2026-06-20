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
            case "checkout.session.completed": {
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
            payload: event as unknown as Record<string, unknown>,
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

  await supabaseAdmin.rpc("ensure_wallet", { _user_id: args.userId });
  const { data: wallet, error: wErr } = await supabaseAdmin
    .from("wallets")
    .select("*")
    .eq("user_id", args.userId)
    .single();
  if (wErr || !wallet) throw wErr ?? new Error("wallet missing");

  const newBalance = wallet.balance_cents + args.amountCents;
  const { error: uErr } = await supabaseAdmin
    .from("wallets")
    .update({ balance_cents: newBalance })
    .eq("id", wallet.id);
  if (uErr) throw uErr;

  await supabaseAdmin.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: args.userId,
    type: "deposit",
    status: "completed",
    amount_cents: args.amountCents,
    balance_after_cents: newBalance,
    currency: wallet.currency,
    description: "Wallet deposit",
    stripe_checkout_session_id: args.sessionId,
    stripe_payment_intent_id: args.paymentIntentId,
  });
}
