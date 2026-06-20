
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paypal_email text;

CREATE TABLE IF NOT EXISTS public.paypal_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_tx_id uuid REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  fee_tx_id uuid REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  gross_amount_cents bigint NOT NULL CHECK (gross_amount_cents > 0),
  fee_cents bigint NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  net_amount_cents bigint NOT NULL CHECK (net_amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  payout_batch_id text,
  payout_item_id text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.paypal_payouts TO authenticated;
GRANT ALL ON public.paypal_payouts TO service_role;

ALTER TABLE public.paypal_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own paypal payouts"
  ON public.paypal_payouts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER paypal_payouts_touch_updated_at
  BEFORE UPDATE ON public.paypal_payouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS paypal_payouts_user_id_idx ON public.paypal_payouts(user_id);
CREATE INDEX IF NOT EXISTS paypal_payouts_batch_id_idx ON public.paypal_payouts(payout_batch_id);
