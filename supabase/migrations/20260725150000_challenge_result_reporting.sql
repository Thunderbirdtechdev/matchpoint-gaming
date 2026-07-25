-- Match result reporting: both players report who won a 1v1 challenge.
-- If they agree, the match auto-settles as before. If they disagree, the
-- challenge is marked 'disputed' - escrow stays held (funds locked) until
-- the fair play team resolves it via adminResolveChallenge.

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS creator_reported_winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opponent_reported_winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
