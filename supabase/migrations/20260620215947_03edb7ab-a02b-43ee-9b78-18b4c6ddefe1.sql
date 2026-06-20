ALTER TABLE public.manual_payout_requests DROP CONSTRAINT IF EXISTS manual_payout_requests_speed_check;
UPDATE public.manual_payout_requests SET speed = 'same_day' WHERE speed = 'instant';
ALTER TABLE public.manual_payout_requests ADD CONSTRAINT manual_payout_requests_speed_check CHECK (speed IN ('standard','same_day'));