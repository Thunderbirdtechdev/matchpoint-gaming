
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cashapp_tag text;

DO $$ BEGIN
  CREATE TYPE public.manual_payout_method AS ENUM ('paypal','cashapp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.manual_payout_status AS ENUM ('pending','processing','paid','failed','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.manual_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method public.manual_payout_method NOT NULL,
  handle text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  fee_cents bigint NOT NULL DEFAULT 0,
  net_cents bigint NOT NULL,
  status public.manual_payout_status NOT NULL DEFAULT 'pending',
  wallet_tx_id uuid,
  admin_note text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.manual_payout_requests TO authenticated;
GRANT ALL ON public.manual_payout_requests TO service_role;

ALTER TABLE public.manual_payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own payout requests" ON public.manual_payout_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users create own payout requests" ON public.manual_payout_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins update payout requests" ON public.manual_payout_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_manual_payout_requests_touch
  BEFORE UPDATE ON public.manual_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_manual_payout_requests_user ON public.manual_payout_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_payout_requests_status ON public.manual_payout_requests(status, created_at DESC);
