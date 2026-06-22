
-- 1) New owner-only table for payout handles
CREATE TABLE IF NOT EXISTS public.user_payout_methods (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  paypal_email text,
  cashapp_tag text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_payout_methods TO authenticated;
GRANT ALL ON public.user_payout_methods TO service_role;
ALTER TABLE public.user_payout_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own payout methods read"
  ON public.user_payout_methods FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "own payout methods insert"
  ON public.user_payout_methods FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "own payout methods update"
  ON public.user_payout_methods FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own payout methods delete"
  ON public.user_payout_methods FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER user_payout_methods_touch
  BEFORE UPDATE ON public.user_payout_methods
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Migrate any existing data off profiles
INSERT INTO public.user_payout_methods (user_id, paypal_email, cashapp_tag)
SELECT id, paypal_email, cashapp_tag
FROM public.profiles
WHERE paypal_email IS NOT NULL OR cashapp_tag IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
  SET paypal_email = EXCLUDED.paypal_email,
      cashapp_tag = EXCLUDED.cashapp_tag;

-- 3) Drop the sensitive columns from the public-readable profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS paypal_email;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS cashapp_tag;

-- 4) Tighten waitlist insert — basic email shape required
DROP POLICY IF EXISTS "Anyone can join the waitlist" ON public.waitlist_signups;
CREATE POLICY "Anyone can join the waitlist"
  ON public.waitlist_signups FOR INSERT TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 5 AND 254
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  );

-- 5) Pin search_path on remaining SECURITY DEFINER helpers
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pg_temp;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pg_temp;

-- 6) Revoke anon EXECUTE on privileged helpers (admin / wallet / email queue)
REVOKE EXECUTE ON FUNCTION public.company_wallet_withdraw(bigint, text, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.escrow_debit(uuid, bigint, uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.escrow_resolve(uuid, escrow_status) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_platform_fee(text, bigint, uuid, uuid, bigint, bigint, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wallet_credit(uuid, bigint, wallet_tx_type, text, uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_wallet(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon;
