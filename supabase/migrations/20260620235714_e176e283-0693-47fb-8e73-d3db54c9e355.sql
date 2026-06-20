CREATE TABLE public.waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  source text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX waitlist_signups_email_key ON public.waitlist_signups (lower(email));

GRANT INSERT ON public.waitlist_signups TO anon, authenticated;
GRANT SELECT ON public.waitlist_signups TO authenticated;
GRANT ALL ON public.waitlist_signups TO service_role;

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join the waitlist"
  ON public.waitlist_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view waitlist"
  ON public.waitlist_signups
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));