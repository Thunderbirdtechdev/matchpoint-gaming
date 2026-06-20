import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreditWalletSchema = z.object({
  target: z.string().trim().min(1), // user id (uuid) or email
  amount_cents: z.number().int().min(1).max(10_000_000),
  note: z.string().trim().max(200).optional(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admin-only: credit a test user's wallet (for sandbox payout testing). */
export const adminCreditWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreditWalletSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw roleErr;
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve target user id
    let userId = data.target;
    if (!UUID_RE.test(userId)) {
      // try email lookup via auth admin
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (listErr) throw listErr;
      const match = list.users.find((u) => u.email?.toLowerCase() === data.target.toLowerCase());
      if (!match) throw new Error(`No user found for "${data.target}"`);
      userId = match.id;
    }

    await supabaseAdmin.rpc("ensure_wallet", { _user_id: userId });
    const { data: newBalance, error } = await supabaseAdmin.rpc("wallet_credit", {
      _user_id: userId,
      _amount_cents: data.amount_cents,
      _type: "adjustment",
      _description: data.note ?? "Admin test credit",
      _metadata: { source: "admin_credit", by: context.userId },
    });
    if (error) throw error;

    return { ok: true, user_id: userId, balance_cents: newBalance };
  });
