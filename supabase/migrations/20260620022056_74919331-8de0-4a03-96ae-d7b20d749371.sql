
-- 1) Drop public-exposed financial field on profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS wallet_balance;

-- 2) Lock down SECURITY DEFINER wallet RPCs (callable only by service_role from server fns)
REVOKE EXECUTE ON FUNCTION public.escrow_debit(uuid, bigint, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_credit(uuid, bigint, wallet_tx_type, text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.escrow_resolve(uuid, escrow_status) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_wallet(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.escrow_debit(uuid, bigint, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_credit(uuid, bigint, wallet_tx_type, text, uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.escrow_resolve(uuid, escrow_status) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_wallet(uuid) TO service_role;

-- 3) Explicit admin-only policies for stripe_events
CREATE POLICY "admins read stripe events" ON public.stripe_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) Explicit admin-only INSERT/DELETE/UPDATE policies on user_roles
CREATE POLICY "admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
