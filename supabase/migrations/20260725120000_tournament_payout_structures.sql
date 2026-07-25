-- Customizable tournament payout structures (winner-take-all / fixed / percentage),
-- per spec's "customizable payout structures including fixed payouts,
-- percentage-based payouts, winner-takes-all" requirement.

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS payout_type text NOT NULL DEFAULT 'winner_take_all'
    CHECK (payout_type IN ('winner_take_all', 'fixed', 'percentage')),
  ADD COLUMN IF NOT EXISTS payout_structure jsonb NOT NULL DEFAULT '[]'::jsonb;
