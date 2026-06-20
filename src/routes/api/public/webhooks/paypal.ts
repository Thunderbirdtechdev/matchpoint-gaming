import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/paypal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const { verifyPaypalWebhook } = await import("@/lib/paypal.server");
        const ok = await verifyPaypalWebhook({ headers: request.headers, rawBody });
        if (!ok) return new Response("Invalid signature", { status: 401 });

        const event = JSON.parse(rawBody) as {
          event_type: string;
          resource?: Record<string, unknown>;
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const resource = (event.resource ?? {}) as Record<string, unknown>;
        const batchHeader = resource.batch_header as { payout_batch_id?: string } | undefined;
        const payoutItemId = (resource.payout_item_id as string | undefined) ?? null;
        const batchId =
          (resource.payout_batch_id as string | undefined) ??
          batchHeader?.payout_batch_id ??
          ((resource.payout_item as { payout_batch_id?: string } | undefined)?.payout_batch_id);
        const senderItemId =
          (resource.sender_item_id as string | undefined) ??
          ((resource.payout_item as { sender_item_id?: string } | undefined)?.sender_item_id);

        if (!batchId && !senderItemId) return new Response("ok");

        // Look up payout row by sender_item_id (our id) or batch id
        const { data: payout } = senderItemId
          ? await supabaseAdmin.from("paypal_payouts").select("*").eq("id", senderItemId).maybeSingle()
          : await supabaseAdmin
              .from("paypal_payouts")
              .select("*")
              .eq("payout_batch_id", batchId!)
              .maybeSingle();

        if (!payout) return new Response("ok");

        let newStatus = payout.status;
        let refund = false;
        switch (event.event_type) {
          case "PAYMENT.PAYOUTS-ITEM.SUCCEEDED":
          case "PAYMENT.PAYOUTSBATCH.SUCCESS":
            newStatus = "success";
            break;
          case "PAYMENT.PAYOUTS-ITEM.FAILED":
          case "PAYMENT.PAYOUTS-ITEM.DENIED":
          case "PAYMENT.PAYOUTS-ITEM.RETURNED":
          case "PAYMENT.PAYOUTS-ITEM.BLOCKED":
          case "PAYMENT.PAYOUTS-ITEM.REFUNDED":
          case "PAYMENT.PAYOUTSBATCH.DENIED":
            newStatus = "failed";
            refund = true;
            break;
          case "PAYMENT.PAYOUTS-ITEM.UNCLAIMED":
            newStatus = "unclaimed";
            break;
          case "PAYMENT.PAYOUTSBATCH.PROCESSING":
            newStatus = "processing";
            break;
        }

        await supabaseAdmin
          .from("paypal_payouts")
          .update({
            status: newStatus,
            payout_item_id: payoutItemId ?? payout.payout_item_id,
            payout_batch_id: batchId ?? payout.payout_batch_id,
            metadata: { ...(payout.metadata as object ?? {}), last_event: event.event_type },
          })
          .eq("id", payout.id);

        if (newStatus === "success" && payout.wallet_tx_id) {
          await supabaseAdmin
            .from("wallet_transactions")
            .update({ status: "completed" })
            .eq("id", payout.wallet_tx_id);
        }

        if (refund) {
          // Credit the gross back to the wallet and mark tx failed
          const { data: wallet } = await supabaseAdmin
            .from("wallets")
            .select("*")
            .eq("user_id", payout.user_id)
            .single();
          if (wallet) {
            const restored = wallet.balance_cents + payout.gross_amount_cents;
            await supabaseAdmin.from("wallets").update({ balance_cents: restored }).eq("id", wallet.id);
            await supabaseAdmin.from("wallet_transactions").insert({
              wallet_id: wallet.id,
              user_id: payout.user_id,
              type: "refund",
              status: "completed",
              amount_cents: payout.gross_amount_cents,
              balance_after_cents: restored,
              currency: wallet.currency,
              description: `PayPal payout refunded (${event.event_type})`,
              metadata: { paypal_payout_id: payout.id, batch_id: batchId },
            });
          }
          if (payout.wallet_tx_id) {
            await supabaseAdmin
              .from("wallet_transactions")
              .update({ status: "failed" })
              .eq("id", payout.wallet_tx_id);
          }
        }

        return new Response("ok");
      },
    },
  },
});
