import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SavePaypalEmailSchema = z.object({
  paypal_email: z.string().trim().email().max(254),
});

const PaypalPayoutSchema = z.object({
  amount_cents: z.number().int().min(100).max(500_000),
});

/** Save the user's PayPal email on their profile. */
export const savePaypalEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SavePaypalEmailSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ paypal_email: data.paypal_email })
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/** Cash out wallet balance to the user's PayPal email via PayPal Payouts. */
export const createPaypalCashout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PaypalPayoutSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { calcPaypalFeeCents, createPaypalPayout } = await import("@/lib/paypal.server");

    // Resolve recipient email
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("paypal_email")
      .eq("id", context.userId)
      .single();

    const recipient = profile?.paypal_email?.trim();
    if (!recipient) throw new Error("Add your PayPal email before cashing out.");

    // Check balance
    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", context.userId)
      .single();

    if (!wallet) throw new Error("Wallet not found.");
    if (wallet.balance_cents < data.amount_cents) {
      throw new Error("Insufficient wallet balance.");
    }

    const gross = data.amount_cents;
    const fee = calcPaypalFeeCents(gross);
    if (fee >= gross) throw new Error("Amount too small after fee.");
    const net = gross - fee;
    const currency = (wallet.currency || "USD").toUpperCase();

    // Debit wallet for the gross amount first
    const newBalance = wallet.balance_cents - gross;
    const { error: balErr } = await supabaseAdmin
      .from("wallets")
      .update({ balance_cents: newBalance })
      .eq("id", wallet.id);
    if (balErr) throw balErr;

    // Record withdrawal + platform fee transactions
    const { data: withdrawalTx, error: wErr } = await supabaseAdmin
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        user_id: context.userId,
        type: "withdrawal",
        status: "pending",
        amount_cents: -gross,
        balance_after_cents: newBalance,
        currency: wallet.currency,
        description: `PayPal payout to ${recipient}`,
        metadata: { provider: "paypal", recipient_email: recipient, fee_cents: fee, net_cents: net },
      })
      .select()
      .single();
    if (wErr) throw wErr;

    const { data: feeTx } = await supabaseAdmin
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        user_id: context.userId,
        type: "platform_fee",
        status: "completed",
        amount_cents: 0, // accounted for inside the withdrawal; tracked for reporting
        balance_after_cents: newBalance,
        currency: wallet.currency,
        description: "PayPal payout platform fee",
        metadata: { provider: "paypal", fee_cents: fee, gross_cents: gross, net_cents: net },
      })
      .select()
      .single();

    // Insert payout row (pending)
    const { data: payoutRow, error: pErr } = await supabaseAdmin
      .from("paypal_payouts")
      .insert({
        user_id: context.userId,
        wallet_tx_id: withdrawalTx?.id ?? null,
        fee_tx_id: feeTx?.id ?? null,
        recipient_email: recipient,
        gross_amount_cents: gross,
        fee_cents: fee,
        net_amount_cents: net,
        currency,
        status: "pending",
      })
      .select()
      .single();
    if (pErr || !payoutRow) {
      // refund and throw
      await supabaseAdmin.from("wallets").update({ balance_cents: wallet.balance_cents }).eq("id", wallet.id);
      throw pErr ?? new Error("Failed to create payout record");
    }

    // Record collected platform fee in the platform_fees ledger
    await supabaseAdmin.from("platform_fees").insert({
      source: "paypal_payout",
      user_id: context.userId,
      amount_cents: fee,
      currency,
      gross_cents: gross,
      net_cents: net,
      reference_id: payoutRow.id,
      metadata: {
        recipient_email: recipient,
        wallet_tx_id: withdrawalTx?.id ?? null,
        fee_rate: 0.05,
      },
    });


    // Call PayPal
    try {
      const resp = await createPaypalPayout({
        recipientEmail: recipient,
        amountCents: net,
        currency,
        senderItemId: payoutRow.id,
        note: "MatchPoint wallet cash-out",
      });
      await supabaseAdmin
        .from("paypal_payouts")
        .update({
          status: resp.batch_header.batch_status?.toLowerCase() ?? "processing",
          payout_batch_id: resp.batch_header.payout_batch_id,
          metadata: { batch_status: resp.batch_header.batch_status },
        })
        .eq("id", payoutRow.id);
      return { ok: true, payout_id: payoutRow.id, batch_id: resp.batch_header.payout_batch_id };
    } catch (err) {
      // refund wallet on hard failure
      await supabaseAdmin
        .from("wallets")
        .update({ balance_cents: wallet.balance_cents })
        .eq("id", wallet.id);
      await supabaseAdmin
        .from("paypal_payouts")
        .update({ status: "failed", error_message: (err as Error).message })
        .eq("id", payoutRow.id);
      if (withdrawalTx?.id) {
        await supabaseAdmin
          .from("wallet_transactions")
          .update({ status: "failed" })
          .eq("id", withdrawalTx.id);
      }
      throw err;
    }
  });
