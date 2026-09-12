-- Give the company_wallet updates a WHERE clause.
--
-- Supabase runs the API roles with the safeupdate extension, which refuses any
-- UPDATE that has no WHERE clause (SQLSTATE 21000, "UPDATE requires a WHERE
-- clause"). Both functions that write to company_wallet updated it bare:
--
--   UPDATE public.company_wallet SET balance_cents = balance_cents + _amount_cents, ...
--
-- company_wallet is a singleton, so the missing WHERE looked harmless. It is
-- not: every call from the application was rejected.
--
-- record_platform_fee is on every revenue path — challenge fees, tournament
-- fees, both withdrawal fee types, PayPal fees, unclaimed prizes — so the
-- platform could not record a single fee it had charged. The money reached
-- Stripe; the ledger never heard about it. createCashout treats the failure as
-- a warning rather than an error, which is why the withdrawal still completed
-- and the player still got paid.
--
-- company_wallet_withdraw had the same shape, so the treasury sweep would have
-- failed the first time anyone moved revenue to a bank.
--
-- It runs fine from the SQL editor, because safeupdate is applied per-role and
-- postgres is not one of them. That is exactly why this survived to production.
--
-- Both now take the singleton's id under FOR UPDATE and target it, which also
-- gives record_platform_fee the row lock it never had — two fees landing at
-- once could previously read the same balance and lose one of the increments.

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
  wallet_id uuid;
BEGIN
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.platform_fees(
    source, user_id, amount_cents, gross_cents, net_cents, reference_id, metadata
  )
  VALUES (
    _source, _user_id, _amount_cents, _gross_cents, _net_cents, _reference_id,
    COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO fee_id;

  SELECT id INTO wallet_id FROM public.company_wallet ORDER BY created_at LIMIT 1 FOR UPDATE;

  IF wallet_id IS NOT NULL THEN
    UPDATE public.company_wallet
       SET balance_cents = balance_cents + _amount_cents,
           lifetime_revenue_cents = lifetime_revenue_cents + _amount_cents,
           updated_at = now()
     WHERE id = wallet_id;
  END IF;

  RETURN fee_id;
END $$;

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
  wallet_id uuid;
BEGIN
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be > 0';
  END IF;

  SELECT id, balance_cents INTO wallet_id, bal
    FROM public.company_wallet ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF wallet_id IS NULL THEN
    RAISE EXCEPTION 'No company wallet';
  END IF;
  IF bal < _amount_cents THEN
    RAISE EXCEPTION 'Insufficient company balance';
  END IF;

  UPDATE public.company_wallet
     SET balance_cents = balance_cents - _amount_cents,
         lifetime_withdrawn_cents = lifetime_withdrawn_cents + _amount_cents,
         updated_at = now()
   WHERE id = wallet_id;

  INSERT INTO public.company_withdrawals(amount_cents, destination, note, created_by)
  VALUES (_amount_cents, _destination, _note, _created_by)
  RETURNING id INTO wid;

  RETURN wid;
END $$;

REVOKE ALL ON FUNCTION public.record_platform_fee(text, bigint, uuid, uuid, bigint, bigint, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_platform_fee(text, bigint, uuid, uuid, bigint, bigint, jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION public.company_wallet_withdraw(bigint, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_wallet_withdraw(bigint, text, text, uuid)
  TO service_role;
