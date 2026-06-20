
-- Atomic wallet debit -> escrow hold
CREATE OR REPLACE FUNCTION public.escrow_debit(
  _user_id uuid,
  _amount_cents bigint,
  _tournament_id uuid DEFAULT NULL,
  _challenge_id uuid DEFAULT NULL,
  _description text DEFAULT 'Entry fee'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.wallets;
  new_balance bigint;
  hold_id uuid;
BEGIN
  IF _amount_cents <= 0 THEN RAISE EXCEPTION 'amount must be > 0'; END IF;

  INSERT INTO public.wallets(user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO w FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF w.balance_cents < _amount_cents THEN
    RAISE EXCEPTION 'Insufficient balance' USING ERRCODE = 'P0001';
  END IF;

  new_balance := w.balance_cents - _amount_cents;
  UPDATE public.wallets SET balance_cents = new_balance, updated_at = now() WHERE id = w.id;

  INSERT INTO public.escrow_holds(user_id, wallet_id, amount_cents, currency, status, tournament_id, challenge_id)
  VALUES (_user_id, w.id, _amount_cents, w.currency, 'held', _tournament_id, _challenge_id)
  RETURNING id INTO hold_id;

  INSERT INTO public.wallet_transactions(
    wallet_id, user_id, type, status, amount_cents, balance_after_cents, currency,
    description, tournament_id, challenge_id, metadata
  ) VALUES (
    w.id, _user_id, 'escrow_hold', 'completed', -_amount_cents, new_balance, w.currency,
    _description, _tournament_id, _challenge_id, jsonb_build_object('escrow_hold_id', hold_id)
  );

  RETURN hold_id;
END $$;

GRANT EXECUTE ON FUNCTION public.escrow_debit(uuid,bigint,uuid,uuid,text) TO service_role;

-- Credit a wallet (used for payouts / refunds)
CREATE OR REPLACE FUNCTION public.wallet_credit(
  _user_id uuid,
  _amount_cents bigint,
  _type wallet_tx_type,
  _description text,
  _tournament_id uuid DEFAULT NULL,
  _challenge_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.wallets;
  new_balance bigint;
BEGIN
  IF _amount_cents <= 0 THEN RAISE EXCEPTION 'amount must be > 0'; END IF;
  INSERT INTO public.wallets(user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  new_balance := w.balance_cents + _amount_cents;
  UPDATE public.wallets SET balance_cents = new_balance, updated_at = now() WHERE id = w.id;
  INSERT INTO public.wallet_transactions(
    wallet_id, user_id, type, status, amount_cents, balance_after_cents, currency,
    description, tournament_id, challenge_id, metadata
  ) VALUES (
    w.id, _user_id, _type, 'completed', _amount_cents, new_balance, w.currency,
    _description, _tournament_id, _challenge_id, _metadata
  );
  RETURN new_balance;
END $$;

GRANT EXECUTE ON FUNCTION public.wallet_credit(uuid,bigint,wallet_tx_type,text,uuid,uuid,jsonb) TO service_role;

-- Resolve escrow: mark hold as released/refunded/forfeited. Returns amount.
CREATE OR REPLACE FUNCTION public.escrow_resolve(
  _hold_id uuid,
  _new_status escrow_status
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h public.escrow_holds;
BEGIN
  SELECT * INTO h FROM public.escrow_holds WHERE id = _hold_id FOR UPDATE;
  IF h.id IS NULL THEN RAISE EXCEPTION 'escrow hold not found'; END IF;
  IF h.status <> 'held' THEN RAISE EXCEPTION 'escrow hold already resolved'; END IF;
  UPDATE public.escrow_holds
    SET status = _new_status, resolved_at = now(), updated_at = now()
    WHERE id = _hold_id;
  RETURN h.amount_cents;
END $$;

GRANT EXECUTE ON FUNCTION public.escrow_resolve(uuid,escrow_status) TO service_role;
