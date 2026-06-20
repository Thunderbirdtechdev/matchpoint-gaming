ALTER TABLE public.manual_payout_requests DROP CONSTRAINT IF EXISTS manual_payout_requests_amount_cents_check;

ALTER TABLE public.manual_payout_requests
  ADD CONSTRAINT manual_payout_requests_amount_cents_check
  CHECK (amount_cents >= 1000);