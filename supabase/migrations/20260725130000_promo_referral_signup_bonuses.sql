-- Promotional credits, referral bonuses, and signup bonuses, per spec's
-- "promotional credits, coupons, referral bonuses, and sign-up bonuses"
-- requirement.

CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  max_redemptions int,
  redemption_count int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo codes readable by authenticated"
  ON public.promo_codes FOR SELECT TO authenticated USING (true);

CREATE TABLE public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(promo_code_id, user_id)
);
GRANT SELECT ON public.promo_redemptions TO authenticated;
GRANT ALL ON public.promo_redemptions TO service_role;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own redemptions"
  ON public.promo_redemptions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  bonus_cents bigint NOT NULL DEFAULT 1000,
  bonus_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referrer_id <> referred_id)
);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

-- Atomic promo code redemption: validates, records, and credits in one transaction.
CREATE OR REPLACE FUNCTION public.redeem_promo_code(_code text, _user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  promo public.promo_codes;
BEGIN
  SELECT * INTO promo FROM public.promo_codes WHERE upper(code) = upper(trim(_code)) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid promo code';
  END IF;
  IF NOT promo.active THEN
    RAISE EXCEPTION 'This promo code is no longer active';
  END IF;
  IF promo.expires_at IS NOT NULL AND promo.expires_at < now() THEN
    RAISE EXCEPTION 'This promo code has expired';
  END IF;
  IF promo.max_redemptions IS NOT NULL AND promo.redemption_count >= promo.max_redemptions THEN
    RAISE EXCEPTION 'This promo code has reached its redemption limit';
  END IF;
  IF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE promo_code_id = promo.id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'You have already redeemed this code';
  END IF;

  INSERT INTO public.promo_redemptions(promo_code_id, user_id, amount_cents)
  VALUES (promo.id, _user_id, promo.amount_cents);

  UPDATE public.promo_codes SET redemption_count = redemption_count + 1 WHERE id = promo.id;

  PERFORM public.wallet_credit(
    _user_id => _user_id,
    _amount_cents => promo.amount_cents,
    _type => 'adjustment',
    _description => 'Promo code: ' || promo.code,
    _metadata => jsonb_build_object('promo_code_id', promo.id, 'source', 'promo_code')
  );

  RETURN promo.amount_cents;
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_promo_code(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_promo_code(text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text, uuid) TO service_role;

-- Pays a pending referral bonus to both parties once the referred user's
-- first deposit actually completes (abuse-resistant trigger point).
CREATE OR REPLACE FUNCTION public.pay_referral_bonus_if_eligible(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref public.referrals;
  deposit_count int;
BEGIN
  SELECT * INTO ref FROM public.referrals WHERE referred_id = _user_id AND bonus_paid = false FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO deposit_count
  FROM public.wallet_transactions
  WHERE user_id = _user_id AND type = 'deposit' AND status = 'completed';
  IF deposit_count <> 1 THEN
    RETURN false;
  END IF;

  UPDATE public.referrals SET bonus_paid = true WHERE id = ref.id;

  PERFORM public.wallet_credit(
    _user_id => ref.referrer_id,
    _amount_cents => ref.bonus_cents,
    _type => 'adjustment',
    _description => 'Referral bonus - you referred a new player',
    _metadata => jsonb_build_object('referral_id', ref.id, 'source', 'referral_referrer')
  );
  PERFORM public.wallet_credit(
    _user_id => ref.referred_id,
    _amount_cents => ref.bonus_cents,
    _type => 'adjustment',
    _description => 'Referral bonus - welcome!',
    _metadata => jsonb_build_object('referral_id', ref.id, 'source', 'referral_referred')
  );

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.pay_referral_bonus_if_eligible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pay_referral_bonus_if_eligible(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_referral_bonus_if_eligible(uuid) TO service_role;

-- One-time signup bonus: extend ensure_wallet to credit a welcome bonus only
-- the first time a wallet is actually created for a user (not on repeat calls).
CREATE OR REPLACE FUNCTION public.ensure_wallet(_user_id uuid)
RETURNS public.wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.wallets;
  inserted_id uuid;
BEGIN
  INSERT INTO public.wallets(user_id) VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NOT NULL THEN
    PERFORM public.wallet_credit(
      _user_id => _user_id,
      _amount_cents => 500,
      _type => 'adjustment',
      _description => 'Welcome bonus',
      _metadata => jsonb_build_object('source', 'signup_bonus')
    );
  END IF;

  SELECT * INTO w FROM public.wallets WHERE user_id = _user_id;
  RETURN w;
END $$;
