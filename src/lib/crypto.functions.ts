import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
// Bitcoin: legacy/p2sh (1.., 3..) or bech32 (bc1..)
const BTC_RE = /^(bc1[a-z0-9]{8,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;

const SaveAddressSchema = z.object({
  currency: z.enum(["USDC", "BTC"]),
  address: z.string().trim().min(10).max(120),
  label: z.string().trim().max(64).optional(),
});

const RequestPayoutSchema = z.object({
  currency: z.enum(["USDC", "BTC"]),
  amount_cents: z.number().int().min(500), // $5 minimum
});

function networkFor(currency: "USDC" | "BTC"): "base" | "bitcoin" {
  return currency === "USDC" ? "base" : "bitcoin";
}

function validateAddress(currency: "USDC" | "BTC", address: string) {
  if (currency === "USDC") {
    if (!EVM_RE.test(address)) throw new Error("Invalid Base/EVM address. Must start with 0x and be 42 chars.");
  } else {
    if (!BTC_RE.test(address)) throw new Error("Invalid Bitcoin address.");
  }
}

/** Save / update a user's payout address for a given coin. */
export const saveCryptoAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SaveAddressSchema.parse(d))
  .handler(async ({ data, context }) => {
    validateAddress(data.currency, data.address);
    const network = networkFor(data.currency);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("crypto_payout_addresses")
      .upsert(
        {
          user_id: context.userId,
          currency: data.currency,
          network,
          address: data.address,
          label: data.label ?? null,
        },
        { onConflict: "user_id,currency,network" },
      );
    if (error) throw error;
    return { ok: true };
  });

/** List saved addresses for the current user. */
export const listCryptoAddresses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("crypto_payout_addresses")
      .select("*")
      .eq("user_id", context.userId);
    if (error) throw error;
    return data ?? [];
  });

/** Admin-only: hot wallet address + on-chain USDC/ETH balances + recent payouts. */
export const getHotWalletStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw roleErr;
    if (!isAdmin) throw new Error("Forbidden");

    const { getHotWalletInfo, getHotWalletBalances } = await import("./crypto.server");
    const info = getHotWalletInfo();
    if (!info.configured || !info.address) {
      return {
        configured: false as const,
        address: null,
        usdc: null,
        eth: null,
        explorerUrl: null,
        recentPayouts: [],
      };
    }

    const balances = await getHotWalletBalances().catch((e: unknown) => ({
      error: e instanceof Error ? e.message : String(e),
      usdc: null as number | null,
      eth: null as number | null,
    }));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: recent } = await supabaseAdmin
      .from("crypto_payouts")
      .select("*")
      .eq("network", "base")
      .order("created_at", { ascending: false })
      .limit(25);

    return {
      configured: true as const,
      address: info.address,
      usdc: balances.usdc,
      eth: balances.eth,
      error: "error" in balances ? balances.error : null,
      explorerUrl: `https://basescan.org/address/${info.address}`,
      recentPayouts: recent ?? [],
    };
  });

/** List recent crypto payouts for the current user. */
export const listCryptoPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("crypto_payouts")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw error;
    return data ?? [];
  });

/**
 * Request a crypto cash-out. USDC on Base is auto-broadcast.
 * BTC creates a pending record for manual fulfillment (self-custody on edge
 * runtime is not safe to automate yet).
 */
export const requestCryptoPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RequestPayoutSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const network = networkFor(data.currency);

    // Saved address
    const { data: addr } = await supabaseAdmin
      .from("crypto_payout_addresses")
      .select("*")
      .eq("user_id", context.userId)
      .eq("currency", data.currency)
      .eq("network", network)
      .maybeSingle();

    if (!addr) throw new Error(`Save your ${data.currency} address first.`);

    // Wallet + balance check
    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", context.userId)
      .single();

    if (!wallet || wallet.balance_cents < data.amount_cents) {
      throw new Error("Insufficient wallet balance.");
    }

    // 1% platform fee for crypto payouts (covers gas / risk)
    const fee_cents = Math.max(25, Math.round(data.amount_cents * 0.01));
    if (fee_cents >= data.amount_cents) throw new Error("Amount too small after fee.");
    const net_cents = data.amount_cents - fee_cents;

    // Debit wallet
    const newBalance = wallet.balance_cents - data.amount_cents;
    const { error: balErr } = await supabaseAdmin
      .from("wallets")
      .update({ balance_cents: newBalance })
      .eq("id", wallet.id);
    if (balErr) throw balErr;

    // Insert payout record
    const { data: payout, error: insErr } = await supabaseAdmin
      .from("crypto_payouts")
      .insert({
        user_id: context.userId,
        wallet_id: wallet.id,
        currency: data.currency,
        network,
        to_address: addr.address,
        amount_cents: net_cents,
        fee_cents,
        status: data.currency === "USDC" ? "sending" : "pending",
      })
      .select()
      .single();
    if (insErr || !payout) {
      // refund
      await supabaseAdmin.from("wallets").update({ balance_cents: wallet.balance_cents }).eq("id", wallet.id);
      throw insErr ?? new Error("Failed to create payout record");
    }

    // Ledger entries
    await supabaseAdmin.from("wallet_transactions").insert([
      {
        wallet_id: wallet.id,
        user_id: context.userId,
        type: "withdrawal",
        status: "completed",
        amount_cents: -data.amount_cents,
        balance_after_cents: newBalance,
        currency: wallet.currency,
        description: `Crypto cash-out (${data.currency})`,
        metadata: { crypto_payout_id: payout.id, fee_cents, network },
      },
    ]);
    if (fee_cents > 0) {
      await supabaseAdmin.from("platform_fees").insert({
        user_id: context.userId,
        amount_cents: fee_cents,
        currency: wallet.currency,
        source: "crypto_payout",
        metadata: { crypto_payout_id: payout.id },
      } as never);
    }

    // For USDC, fire-and-broadcast on-chain
    if (data.currency === "USDC") {
      try {
        const { sendUsdcOnBase } = await import("./crypto.server");
        const { txHash, amountCrypto } = await sendUsdcOnBase({
          to: addr.address as `0x${string}`,
          amountCents: net_cents,
        });
        await supabaseAdmin
          .from("crypto_payouts")
          .update({ status: "sent", tx_hash: txHash, amount_crypto: amountCrypto })
          .eq("id", payout.id);
        return { ok: true, status: "sent", txHash, payoutId: payout.id };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Refund on broadcast failure
        await supabaseAdmin
          .from("wallets")
          .update({ balance_cents: wallet.balance_cents })
          .eq("id", wallet.id);
        await supabaseAdmin
          .from("crypto_payouts")
          .update({ status: "failed", error: msg })
          .eq("id", payout.id);
        await supabaseAdmin.from("wallet_transactions").insert({
          wallet_id: wallet.id,
          user_id: context.userId,
          type: "refund",
          status: "completed",
          amount_cents: data.amount_cents,
          balance_after_cents: wallet.balance_cents,
          currency: wallet.currency,
          description: `Refund: USDC payout failed`,
          metadata: { crypto_payout_id: payout.id },
        });
        throw new Error(`USDC send failed: ${msg}`);
      }
    }

    // BTC: leave as pending for manual fulfillment
    return { ok: true, status: "pending", payoutId: payout.id };
  });
