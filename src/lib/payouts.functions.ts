import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateWithdrawalFee } from "./fees";

const MethodSchema = z.enum(["paypal", "cashapp"]);
const SpeedSchema = z.enum(["standard", "same_day"]);

const SaveHandleSchema = z.object({
  method: MethodSchema,
  handle: z.string().trim().min(2).max(120),
});

const RequestPayoutSchema = z.object({
  method: MethodSchema,
  speed: SpeedSchema.default("standard"),
  amount_cents: z.number().int().min(1_000).max(500_000), // $10 – $5,000
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
        ? { paypal_email: data.handle, cashapp_tag: null }
        : { cashapp_tag: data.handle.startsWith("$") ? data.handle : `$${data.handle}`, paypal_email: null };
    const { error } = await supabaseAdmin
      .from("user_payout_methods")
      .upsert({ user_id: context.userId, ...patch }, { onConflict: "user_id" });
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

    const breakdown = calculateWithdrawalFee(data.amount_cents, data.speed);
    const fee = breakdown.feeCents;
    const net = breakdown.netCents;
    const newBalance = wallet.balance_cents - data.amount_cents;

    // Debit wallet
    const { error: balErr } = await supabaseAdmin
      .from("wallets")
      .update({ balance_cents: newBalance })
      .eq("id", wallet.id);
    if (balErr) throw balErr;

    const speedLabel = data.speed === "same_day" ? "Same-day" : "Standard";

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
        description: `${speedLabel} payout via ${data.method === "paypal" ? "PayPal" : "Cash App"} → ${normalizedHandle}`,
        metadata: {
          payout_method: data.method,
          payout_speed: data.speed,
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
        speed: data.speed,
        handle: normalizedHandle,
        amount_cents: data.amount_cents,
        fee_cents: fee,
        net_cents: net,
        status: "pending",
        wallet_tx_id: tx.id,
      } as never)
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
    await supabaseAdmin
      .from("user_payout_methods")
      .upsert({ user_id: context.userId, ...patch }, { onConflict: "user_id" });

    // Send confirmation email
    try {
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const recipient = userRes?.user?.email;
      if (recipient) {
        const currency = (wallet.currency ?? "usd").toUpperCase();
        const fmt = (cents: number) =>
          new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
        const { enqueueAppEmail } = await import("@/lib/email/send-app-email.server");
        await enqueueAppEmail({
          templateName: "user-payout-update",
          recipientEmail: recipient,
          idempotencyKey: `payout-requested-${req.id}`,
          templateData: {
            status: "requested",
            method: data.method,
            speed: data.speed,
            handle: normalizedHandle,
            grossFormatted: fmt(data.amount_cents),
            feeFormatted: fmt(fee),
            netFormatted: fmt(net),
            requestId: req.id,
          },
        });
      }
    } catch (e) {
      console.error("[payouts] request email failed", e);
    }

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

// ────────────────────────────── ADMIN ──────────────────────────────

async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!isAdmin) throw new Error("Forbidden");
}

const AdminListSchema = z.object({
  speed: SpeedSchema.optional(),
  status: z.enum(["pending", "processing", "paid", "failed", "canceled"]).optional(),
  limit: z.number().int().min(1).max(200).default(100),
});

/** Admin-only: list payout requests, optionally filtered by speed/status. */
export const adminListPayoutRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AdminListSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("manual_payout_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.speed) q = q.eq("speed", data.speed);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    const list = rows ?? [];
    if (!list.length) return [] as any[];
    const userIds = Array.from(new Set(list.map((r) => r.user_id)));
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds);
    const byId = new Map((profs ?? []).map((p) => [p.id, p]));
    return list.map((r) => ({ ...r, profiles: byId.get(r.user_id) ?? null }));
  });

const AdminUpdateSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["mark_processing", "mark_paid", "reject"]),
  admin_note: z.string().trim().max(500).optional(),
});

/**
 * Admin-only: update a payout request status.
 *  - mark_processing: status → processing (no wallet change)
 *  - mark_paid:       status → paid, ledger tx → completed
 *  - reject:          status → canceled, refund wallet, ledger tx → failed
 */
export const adminUpdatePayoutRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AdminUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error: rErr } = await supabaseAdmin
      .from("manual_payout_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (rErr || !req) throw new Error("Payout request not found.");
    if (req.status === "paid" || req.status === "canceled") {
      throw new Error(`Payout already ${req.status}.`);
    }

    const now = new Date().toISOString();

    const sendUserStatusEmail = async (status: "processing" | "paid" | "rejected", note?: string | null) => {
      try {
        const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(req.user_id);
        const recipient = userRes?.user?.email;
        if (!recipient) return;
        const currency = "USD";
        const fmt = (cents: number) =>
          new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents ?? 0) / 100);
        const { enqueueAppEmail } = await import("@/lib/email/send-app-email.server");
        await enqueueAppEmail({
          templateName: "user-payout-update",
          recipientEmail: recipient,
          idempotencyKey: `payout-${status}-${req.id}`,
          templateData: {
            status,
            method: req.method,
            speed: req.speed,
            handle: req.handle,
            grossFormatted: fmt(req.amount_cents),
            feeFormatted: fmt(req.fee_cents ?? 0),
            netFormatted: fmt(req.net_cents ?? req.amount_cents),
            requestId: req.id,
            adminNote: note ?? null,
          },
        });
      } catch (e) {
        console.error("[payouts] status email failed", e);
      }
    };


    if (data.action === "mark_processing") {
      const { error } = await supabaseAdmin
        .from("manual_payout_requests")
        .update({
          status: "processing",
          admin_note: data.admin_note ?? req.admin_note,
          processed_by: context.userId,
          updated_at: now,
        } as never)
        .eq("id", req.id);
      if (error) throw error;
      await sendUserStatusEmail("processing", data.admin_note ?? null);
      return { ok: true, status: "processing" };
    }


    if (data.action === "mark_paid") {
      const { error: uErr } = await supabaseAdmin
        .from("manual_payout_requests")
        .update({
          status: "paid",
          admin_note: data.admin_note ?? req.admin_note,
          processed_by: context.userId,
          processed_at: now,
          updated_at: now,
        } as never)
        .eq("id", req.id);
      if (uErr) throw uErr;
      if (req.wallet_tx_id) {
        await supabaseAdmin
          .from("wallet_transactions")
          .update({ status: "completed" })
          .eq("id", req.wallet_tx_id);
      }
      if (req.fee_cents && req.fee_cents > 0) {
        await supabaseAdmin.rpc("record_platform_fee", {
          _source: req.speed === "same_day" ? "withdrawal_fee_same_day" : "withdrawal_fee_standard",
          _amount_cents: req.fee_cents,
          _user_id: req.user_id,
          _reference_id: req.id,
          _gross_cents: req.amount_cents,
          _net_cents: req.net_cents,
          _metadata: { method: req.method, speed: req.speed },
        });
      }
      await sendUserStatusEmail("paid", data.admin_note ?? null);
      return { ok: true, status: "paid" };
    }


    // reject → refund wallet
    const { data: wallet, error: wErr } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", req.user_id)
      .single();
    if (wErr || !wallet) throw new Error("Wallet not found for refund.");

    const refunded = wallet.balance_cents + req.amount_cents;
    const { error: balErr } = await supabaseAdmin
      .from("wallets")
      .update({ balance_cents: refunded, updated_at: now })
      .eq("id", wallet.id);
    if (balErr) throw balErr;

    await supabaseAdmin.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      user_id: req.user_id,
      type: "refund",
      status: "completed",
      amount_cents: req.amount_cents,
      balance_after_cents: refunded,
      currency: wallet.currency,
      description: `Payout rejected — refund${data.admin_note ? `: ${data.admin_note}` : ""}`,
      metadata: { payout_request_id: req.id, rejected_by: context.userId },
    } as never);

    if (req.wallet_tx_id) {
      await supabaseAdmin
        .from("wallet_transactions")
        .update({ status: "failed" })
        .eq("id", req.wallet_tx_id);
    }

    const { error: uErr } = await supabaseAdmin
      .from("manual_payout_requests")
      .update({
        status: "canceled",
        admin_note: data.admin_note ?? req.admin_note,
        processed_by: context.userId,
        processed_at: now,
        updated_at: now,
      } as never)
      .eq("id", req.id);
    if (uErr) throw uErr;

    return { ok: true, status: "canceled", refunded_cents: req.amount_cents };
  });
