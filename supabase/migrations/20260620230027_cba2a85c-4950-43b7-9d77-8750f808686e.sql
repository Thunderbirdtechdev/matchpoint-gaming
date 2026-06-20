
CREATE TABLE public.company_wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  balance_cents bigint NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  lifetime_revenue_cents bigint NOT NULL DEFAULT 0,
  lifetime_withdrawn_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.company_wallet TO authenticated;
GRANT ALL ON public.company_wallet TO service_role;

ALTER TABLE public.company_wallet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view company wallet"
  ON public.company_wallet FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER company_wallet_touch
  BEFORE UPDATE ON public.company_wallet
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed singleton row
INSERT INTO public.company_wallet (balance_cents) VALUES (0);

-- Add withdrawal tracking table (admin records of sweeping company funds out)
CREATE TABLE public.company_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'usd',
  destination text NOT NULL,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.company_withdrawals TO authenticated;
GRANT ALL ON public.company_withdrawals TO service_role;

ALTER TABLE public.company_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view company withdrawals"
  ON public.company_withdrawals FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Record a platform fee: writes to platform_fees ledger and credits company_wallet
CREATE OR REPLACE FUNCTION public.record_platform_fee(
  _source text,
  _amount_cents bigint,
  _user_id uuid DEFAULT NULL,
  _reference_id uuid DEFAULT NULL,
  _gross_cents bigint DEFAULT NULL,
  _net_cents bigint DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fee_id uuid;
BEGIN
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.platform_fees(source, user_id, amount_cents, gross_cents, net_cents, reference_id, metadata)
  VALUES (_source, _user_id, _amount_cents, _gross_cents, _net_cents, _reference_id, COALESCE(_metadata,'{}'::jsonb))
  RETURNING id INTO fee_id;

  UPDATE public.company_wallet
    SET balance_cents = balance_cents + _amount_cents,
        lifetime_revenue_cents = lifetime_revenue_cents + _amount_cents,
        updated_at = now();

  RETURN fee_id;
END $$;

-- Admin records a sweep / withdrawal of company funds to an external destination
CREATE OR REPLACE FUNCTION public.company_wallet_withdraw(
  _amount_cents bigint,
  _destination text,
  _note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bal bigint;
  wid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be > 0';
  END IF;

  SELECT balance_cents INTO bal FROM public.company_wallet FOR UPDATE LIMIT 1;
  IF bal < _amount_cents THEN
    RAISE EXCEPTION 'Insufficient company balance';
  END IF;

  UPDATE public.company_wallet
    SET balance_cents = balance_cents - _amount_cents,
        lifetime_withdrawn_cents = lifetime_withdrawn_cents + _amount_cents,
        updated_at = now();

  INSERT INTO public.company_withdrawals(amount_cents, destination, note, created_by)
  VALUES (_amount_cents, _destination, _note, auth.uid())
  RETURNING id INTO wid;

  RETURN wid;
END $$;
