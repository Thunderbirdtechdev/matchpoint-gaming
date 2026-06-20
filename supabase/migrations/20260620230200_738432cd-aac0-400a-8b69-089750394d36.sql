
DROP FUNCTION IF EXISTS public.company_wallet_withdraw(bigint, text, text);

CREATE OR REPLACE FUNCTION public.company_wallet_withdraw(
  _amount_cents bigint,
  _destination text,
  _note text DEFAULT NULL,
  _created_by uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bal bigint;
  wid uuid;
BEGIN
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
  VALUES (_amount_cents, _destination, _note, _created_by)
  RETURNING id INTO wid;

  RETURN wid;
END $$;

REVOKE ALL ON FUNCTION public.company_wallet_withdraw(bigint, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_wallet_withdraw(bigint, text, text, uuid) TO service_role;
