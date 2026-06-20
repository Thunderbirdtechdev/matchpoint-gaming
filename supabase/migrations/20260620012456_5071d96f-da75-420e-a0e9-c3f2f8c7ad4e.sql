
-- WALLETS
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cents bigint NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own wallet" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER wallets_touch BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- WALLET TRANSACTIONS (ledger)
CREATE TYPE public.wallet_tx_type AS ENUM (
  'deposit', 'withdrawal', 'entry_fee', 'prize_payout',
  'platform_fee', 'refund', 'escrow_hold', 'escrow_release', 'adjustment'
);
CREATE TYPE public.wallet_tx_status AS ENUM ('pending', 'completed', 'failed', 'reversed');

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.wallet_tx_type NOT NULL,
  status public.wallet_tx_status NOT NULL DEFAULT 'completed',
  amount_cents bigint NOT NULL, -- signed: + credit, - debit
  balance_after_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  description text,
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE SET NULL,
  challenge_id uuid REFERENCES public.challenges(id) ON DELETE SET NULL,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  stripe_transfer_id text,
  stripe_payout_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_tx_user_created_idx ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX wallet_tx_wallet_created_idx ON public.wallet_transactions(wallet_id, created_at DESC);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ESCROW HOLDS
CREATE TYPE public.escrow_status AS ENUM ('held', 'released', 'refunded', 'forfeited');

CREATE TABLE public.escrow_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'usd',
  status public.escrow_status NOT NULL DEFAULT 'held',
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE,
  challenge_id uuid REFERENCES public.challenges(id) ON DELETE CASCADE,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((tournament_id IS NOT NULL) <> (challenge_id IS NOT NULL))
);
CREATE INDEX escrow_user_idx ON public.escrow_holds(user_id);
CREATE INDEX escrow_tournament_idx ON public.escrow_holds(tournament_id);
CREATE INDEX escrow_challenge_idx ON public.escrow_holds(challenge_id);
GRANT SELECT ON public.escrow_holds TO authenticated;
GRANT ALL ON public.escrow_holds TO service_role;
ALTER TABLE public.escrow_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own escrow" ON public.escrow_holds FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER escrow_touch BEFORE UPDATE ON public.escrow_holds FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- STRIPE CONNECT ACCOUNTS (for payouts to winners)
CREATE TABLE public.stripe_connect_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL UNIQUE,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stripe_connect_accounts TO authenticated;
GRANT ALL ON public.stripe_connect_accounts TO service_role;
ALTER TABLE public.stripe_connect_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own connect account" ON public.stripe_connect_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER connect_touch BEFORE UPDATE ON public.stripe_connect_accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- STRIPE EVENT IDEMPOTENCY
CREATE TABLE public.stripe_events (
  id text PRIMARY KEY, -- stripe event id (evt_...)
  type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb
);
GRANT ALL ON public.stripe_events TO service_role;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- no policies = no client access; only service_role (webhook) writes

-- Helper: get-or-create wallet
CREATE OR REPLACE FUNCTION public.ensure_wallet(_user_id uuid)
RETURNS public.wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE w public.wallets;
BEGIN
  INSERT INTO public.wallets(user_id) VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.wallets WHERE user_id = _user_id;
  RETURN w;
END $$;
