import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!isAdmin) throw new Error("Forbidden");
}

/** Redeem a promo code — validates, records, and credits the wallet atomically. */
export const redeemPromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().trim().min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: creditedCents, error } = await supabaseAdmin.rpc("redeem_promo_code" as never, {
      _code: data.code,
      _user_id: context.userId,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true, credited_cents: creditedCents as unknown as number };
  });

/**
 * Links a new signup to the referrer whose username was passed in the
 * `?ref=` link. Silently no-ops on bad/self/duplicate referral rather than
 * blocking signup over a marketing link issue.
 */
export const linkReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ referrer_username: z.string().trim().min(1).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: referrer } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", data.referrer_username)
      .maybeSingle();
    if (!referrer || referrer.id === context.userId) return { ok: false };

    const { error } = await db
      .from("referrals")
      .insert({ referrer_id: referrer.id, referred_id: context.userId });
    // Ignore unique-violation (already referred) rather than surfacing an error.
    if (error && error.code !== "23505") throw error;
    return { ok: !error };
  });

/** Returns the user's own referral link handle, plus how many referrals have paid out. */
export const getMyReferralInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: referrals } = await db
      .from("referrals")
      .select("bonus_paid, bonus_cents")
      .eq("referrer_id", context.userId);
    const rows = (referrals ?? []) as { bonus_paid: boolean; bonus_cents: number }[];
    return {
      username: profile?.username ?? null,
      referral_count: rows.length,
      paid_count: rows.filter((r) => r.bonus_paid).length,
      total_earned_cents: rows.filter((r) => r.bonus_paid).reduce((s, r) => s + r.bonus_cents, 0),
    };
  });

// ────────────────────────────── ADMIN ──────────────────────────────

const AdminCreatePromoSchema = z.object({
  code: z.string().trim().min(3).max(50),
  amount_cents: z.number().int().min(1).max(500_000),
  max_redemptions: z.number().int().min(1).optional(),
  expires_at: z.string().optional(),
});

/** Admin-only: create a new promo code. */
export const adminCreatePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AdminCreatePromoSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: row, error } = await db
      .from("promo_codes")
      .insert({
        code: data.code.toUpperCase(),
        amount_cents: data.amount_cents,
        max_redemptions: data.max_redemptions ?? null,
        expires_at: data.expires_at ?? null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, promo: row };
  });

/** Admin-only: list all promo codes with redemption counts. */
export const adminListPromoCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      code: string;
      amount_cents: number;
      max_redemptions: number | null;
      redemption_count: number;
      active: boolean;
      expires_at: string | null;
      created_at: string;
    }>;
  });

/** Admin-only: activate/deactivate a promo code. */
export const adminTogglePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { error } = await db
      .from("promo_codes")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
