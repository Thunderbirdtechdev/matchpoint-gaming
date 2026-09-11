-- A dispute has to say what it is about.
--
-- `reason` was NOT NULL, which permits the empty string, and disputes are
-- inserted straight from the browser under RLS — so the only client-side check
-- (on challenge_id) was the only check there was. Submitting the form with the
-- reason box untouched stored '', and the moderator queue rendered a row with a
-- date, a reporter and nothing to act on.
--
-- Client validation cannot be the guard here precisely because the insert is
-- client-side: anyone can post the row directly. This constraint is the guard.

-- Existing blanks first, or the constraint cannot be validated. Kept as rows
-- rather than deleted — a dispute someone opened is a record even when they
-- failed to describe it, and a moderator may still need to follow it up.
UPDATE public.disputes
   SET reason = 'No reason given'
 WHERE char_length(btrim(reason)) = 0;

ALTER TABLE public.disputes
  DROP CONSTRAINT IF EXISTS disputes_reason_not_blank;

ALTER TABLE public.disputes
  ADD CONSTRAINT disputes_reason_not_blank
  CHECK (char_length(btrim(reason)) >= 10);
