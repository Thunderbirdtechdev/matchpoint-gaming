-- Remove balance from a player wallet (the inverse of wallet_credit).
--
-- An operator who credits a wallet by mistake currently has no way back: every
-- other debit path is escrow_debit, which is tied to a stake, or the withdrawal
-- flow, which moves real money. This is the plain reversal.
--
-- Two deliberate refusals:
--   * Never overdraws. If the player already spent the credit, the operator is
--     told the shortfall rather than the wallet going negative — a negative
--     balance silently breaks cash-out limits and the balance UI.
--   * Only touches wallets.balance_cents, which escrow_debit has already
--     reduced, so money staked in a live match can never be pulled out from
--     under a player mid-match.
--
-- Writes a negative-amount ledger row, matching the sign convention withdrawals
-- already use, so the player sees where the money went.
CREATE OR REPLACE FUNCTION public.wallet_debit(
  _user_id uuid,
  _amount_cents bigint,
  _type wallet_tx_type,
  _description text,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.wallets;
  new_balance bigint;
BEGIN
  IF _amount_cents <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;

  SELECT * INTO w FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no wallet for user %', _user_id;
  END IF;

  IF w.balance_cents < _amount_cents THEN
    RAISE EXCEPTION 'insufficient_balance: available % cents, tried to remove %',
      w.balance_cents, _amount_cents;
  END IF;

  new_balance := w.balance_cents - _amount_cents;
  UPDATE public.wallets SET balance_cents = new_balance, updated_at = now() WHERE id = w.id;

  INSERT INTO public.wallet_transactions(
    wallet_id, user_id, type, status, amount_cents, balance_after_cents, currency,
    description, metadata
  ) VALUES (
    w.id, _user_id, _type, 'completed', -_amount_cents, new_balance, w.currency,
    _description, _metadata
  );

  RETURN new_balance;
END $$;

-- Same lockdown as wallet_credit: service_role only, never reachable from a
-- browser session.
REVOKE EXECUTE ON FUNCTION public.wallet_debit(uuid, bigint, wallet_tx_type, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_debit(uuid, bigint, wallet_tx_type, text, jsonb)
  TO service_role;
