-- Move a wallet balance by a delta, under a row lock.
--
-- Every withdrawal path used to do this in TypeScript: read balance_cents,
-- subtract, write the result back. Two concurrent cash-outs both read $40, both
-- write $30, and both send money — $20 paid out against a $10 debit. The
-- CHECK (balance_cents >= 0) does not catch it, because both writes store the
-- same non-negative absolute value.
--
-- The refund-on-failure path was worse: it wrote back the balance read at the
-- start, so a prize that landed while the payout was in flight was silently
-- erased.
--
-- A delta applied under FOR UPDATE fixes both. It is the same lock every other
-- money function here already takes (wallet_credit, wallet_debit,
-- escrow_debit, escrow_resolve, company_wallet_withdraw) — the withdrawal
-- paths were the only ones not taking it.
--
-- Deliberately writes NO ledger row. Callers each write their own with their
-- own type, description and provider ids; this only moves the number, and
-- returns the balance it settled on so the caller can record an accurate
-- balance_after_cents rather than one it guessed before locking.
CREATE OR REPLACE FUNCTION public.wallet_adjust_balance(
  _user_id uuid,
  _delta_cents bigint
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.wallets;
  new_balance bigint;
BEGIN
  IF _delta_cents = 0 THEN
    RAISE EXCEPTION 'delta must be non-zero';
  END IF;

  SELECT * INTO w FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no wallet for user %', _user_id;
  END IF;

  new_balance := w.balance_cents + _delta_cents;

  IF new_balance < 0 THEN
    RAISE EXCEPTION 'insufficient_balance: available % cents, tried to move %',
      w.balance_cents, _delta_cents;
  END IF;

  UPDATE public.wallets
     SET balance_cents = new_balance, updated_at = now()
   WHERE id = w.id;

  RETURN new_balance;
END $$;

-- service_role only, same as every other money function.
REVOKE EXECUTE ON FUNCTION public.wallet_adjust_balance(uuid, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_adjust_balance(uuid, bigint)
  TO service_role;
