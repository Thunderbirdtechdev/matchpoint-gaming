
CREATE TYPE public.crypto_currency AS ENUM ('USDC', 'BTC');
CREATE TYPE public.crypto_network AS ENUM ('base', 'bitcoin');
CREATE TYPE public.crypto_payout_status AS ENUM ('pending', 'sending', 'sent', 'failed', 'cancelled');

CREATE TABLE public.crypto_payout_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency public.crypto_currency NOT NULL,
  network public.crypto_network NOT NULL,
  address text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, currency, network)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crypto_payout_addresses TO authenticated;
GRANT ALL ON public.crypto_payout_addresses TO service_role;
ALTER TABLE public.crypto_payout_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own crypto addresses" ON public.crypto_payout_addresses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER crypto_addr_touch BEFORE UPDATE ON public.crypto_payout_addresses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.crypto_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  currency public.crypto_currency NOT NULL,
  network public.crypto_network NOT NULL,
  to_address text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  amount_crypto numeric(38, 18),
  fee_cents bigint NOT NULL DEFAULT 0,
  status public.crypto_payout_status NOT NULL DEFAULT 'pending',
  tx_hash text,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crypto_payouts TO authenticated;
GRANT ALL ON public.crypto_payouts TO service_role;
ALTER TABLE public.crypto_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own crypto payouts" ON public.crypto_payouts
  FOR SELECT USING (auth.uid() = user_id);
CREATE TRIGGER crypto_payouts_touch BEFORE UPDATE ON public.crypto_payouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX crypto_payouts_user_idx ON public.crypto_payouts (user_id, created_at DESC);
CREATE INDEX crypto_payouts_status_idx ON public.crypto_payouts (status) WHERE status IN ('pending','sending');
