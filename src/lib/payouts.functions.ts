import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateWithdrawalFee } from "./fees";

const MethodSchema = z.enum(["paypal", "cashapp"]);
const SpeedSchema = z.enum(["standard", "instant"]);

const SaveHandleSchema = z.object({
  method: MethodSchema,
  handle: z.string().trim().min(2).max(120),
});

const RequestPayoutSchema = z.object({
  method: MethodSchema,
  speed: SpeedSchema.default("standard"),
  amount_cents: z.number().int().min(100).max(500_000), // $1 – $5,000
  handle: z.string().trim().min(2).max(120),
});

function validateHandle(method: "paypal" | "cashapp", handle: string) {
  if (method === "paypal") {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handle);
    if (!ok) throw new Error("Enter a valid PayPal email address.");
  } else {
    const v = handle.startsWith("$") ? handle.slice(1) : handle;
    const ok = /^[a-zA-Z][a-zA-Z0-9_]{0,19}$/.test(v);
    if (!ok) throw new Error("Enter a valid Cash App $cashtag.");
  }
}

/** Save the user's PayPal email or Cash App $cashtag to their profile. */
export const savePayoutHandle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SaveHandleSchema.parse(d))
  .handler(async ({ data, context }) => {
    validateHandle(data.method, data.handle);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch =
      data.method === "paypal"
        ? { paypal_email: data.handle }
        : { cashapp_tag: data.handle.startsWith("$") ? data.handle : `$${data.handle}` };
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/** Create a manual payout request, debiting the wallet immediately. Admin fulfils in 2–24h. */
export const requestManualPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RequestPayoutSchema.parse(d))
  .handler(async ({ data, context }) => {
    validateHandle(data.method, data.handle);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const normalizedHandle =
      data.method === "cashapp" && !data.handle.startsWith("$")
        ? `$${data.handle}`
        : data.handle;

    // Ensure wallet + read balance
    await supabaseAdmin.rpc("ensure_wallet", { _user_id: context.userId });
    const { data: wallet, error: wErr } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", context.userId)
      .single();
    if (wErr || !wallet) throw new Error("Wallet not found.");
    if (wallet.balance_cents < data.amount_cents) throw new Error("Insufficient wallet balance.");

    const fee = feeCents(data.amount_cents);
    const net = data.amount_cents - fee;
    const newBalance = wallet.balance_cents - data.amount_cents;

    // Debit wallet
    const { error: balErr } = await supabaseAdmin
      .from("wallets")
      .update({ balance_cents: newBalance })
      .eq("id", wallet.id);
    if (balErr) throw balErr;

    // Ledger row
    const { data: tx, error: txErr } = await supabaseAdmin
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        user_id: context.userId,
        type: "withdrawal",
        status: "pending",
        amount_cents: -data.amount_cents,
        balance_after_cents: newBalance,
        currency: wallet.currency,
        description: `Manual payout via ${data.method === "paypal" ? "PayPal" : "Cash App"} → ${normalizedHandle}`,
        metadata: {
          payout_method: data.method,
          handle: normalizedHandle,
          fee_cents: fee,
          net_cents: net,
        },
      })
      .select("id")
      .single();
    if (txErr) {
      await supabaseAdmin.from("wallets").update({ balance_cents: wallet.balance_cents }).eq("id", wallet.id);
      throw txErr;
    }

    // Payout request
    const { data: req, error: reqErr } = await supabaseAdmin
      .from("manual_payout_requests")
      .insert({
        user_id: context.userId,
        method: data.method,
        handle: normalizedHandle,
        amount_cents: data.amount_cents,
        fee_cents: fee,
        net_cents: net,
        status: "pending",
        wallet_tx_id: tx.id,
      })
      .select("*")
      .single();
    if (reqErr) {
      await supabaseAdmin.from("wallets").update({ balance_cents: wallet.balance_cents }).eq("id", wallet.id);
      await supabaseAdmin.from("wallet_transactions").delete().eq("id", tx.id);
      throw reqErr;
    }

    // Save handle for next time
    const patch =
      data.method === "paypal"
        ? { paypal_email: normalizedHandle }
        : { cashapp_tag: normalizedHandle };
    await supabaseAdmin.from("profiles").update(patch).eq("id", context.userId);

    return { ok: true, request: req };
  });

/** List the user's recent manual payout requests. */
export const listMyPayoutRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("manual_payout_requests")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(25);
    return data ?? [];
  });
