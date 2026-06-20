
CREATE TABLE IF NOT EXISTS public.platform_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',
  gross_cents bigint,
  net_cents bigint,
  reference_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_fees TO authenticated;
GRANT ALL ON public.platform_fees TO service_role;

ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all platform fees"
ON public.platform_fees FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_platform_fees_created_at ON public.platform_fees(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_fees_source ON public.platform_fees(source);
