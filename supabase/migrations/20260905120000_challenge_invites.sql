-- ============================================================================
-- Client request: invite a specific player to a challenge
--   * challenges.invited_user_id — who this challenge is FOR, if anyone
--   * find_user_by_login()       — resolve a username or email to a user id
-- ============================================================================
--
-- Kevin, 2026-09-05: "when users are creating a challenge could we have it to
-- where they could invite a person into the challenges ... they could just
-- input there username or account email ... or they could input it into the
-- marketplace for anyone to accept it".
--
-- So a challenge is now one of two things, and the difference is one nullable
-- column:
--
--   invited_user_id IS NULL      → public. Shows in the marketplace, anyone
--                                  may accept. This is the existing behaviour
--                                  and every existing row keeps it.
--   invited_user_id IS NOT NULL  → private. Hidden from the marketplace, and
--                                  only that player may accept.
--
-- A separate `visibility` enum was considered and rejected: it would be a
-- second source of truth for a fact this column already states, and the two
-- could disagree.
--
-- Single file, safe to run in one go. No enum changes.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. The column
-- ---------------------------------------------------------------------------
-- ON DELETE SET NULL rather than CASCADE. If the invited player deletes their
-- account, the challenge must NOT vanish — the creator's stake is sitting in
-- escrow against it. Nulling the invite turns it back into a public challenge,
-- which is recoverable; deleting the row would strand real money.

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS invited_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- The invited player's inbox query: "open challenges addressed to me".
CREATE INDEX IF NOT EXISTS challenges_invited_idx
  ON public.challenges (invited_user_id, status, created_at DESC)
  WHERE invited_user_id IS NOT NULL;

-- The marketplace's query: "open, public challenges". Partial, because the
-- marketplace never asks for anything else.
CREATE INDEX IF NOT EXISTS challenges_public_open_idx
  ON public.challenges (status, created_at DESC)
  WHERE invited_user_id IS NULL;

COMMENT ON COLUMN public.challenges.invited_user_id IS
  'When set, this challenge is private to that player: hidden from the marketplace and only they may accept. NULL means open to anyone.';


-- ---------------------------------------------------------------------------
-- 2. Resolving "who did they mean?"
-- ---------------------------------------------------------------------------
-- Accepts either a username or an account email and returns a user id, or NULL.
--
-- WHY THIS IS A FUNCTION AND NOT A QUERY IN THE APP
-- Emails live in auth.users, which PostgREST does not expose. The existing
-- pattern elsewhere in this project (adminCreditWallet, resolveUserId) pages
-- through `auth.admin.listUsers({ perPage: 200 })` and scans the result, which
-- silently stops finding people at user 201. This is an indexed lookup that
-- keeps working.
--
-- ⚠️ PRIVACY: this necessarily confirms whether an email has an account, which
-- is an account-enumeration oracle. It is mitigated, not eliminated:
--   * service_role only, so it is never reachable from a browser;
--   * the calling server function requires a signed-in user;
--   * it returns ONLY a uuid — never a name, email or profile.
-- That is the same trade every "invite a friend by email" feature makes. If it
-- ever needs closing, the answer is to drop email support and invite by
-- username alone, since usernames are already public on /player/<username>.
--
-- Case- and whitespace-insensitive, and tolerates a leading @ on usernames,
-- because people type "@Kevin" and " kevin@x.com " and mean the same thing.

CREATE OR REPLACE FUNCTION public.find_user_by_login(_login TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH needle AS (
    SELECT lower(btrim(_login)) AS raw,
           ltrim(lower(btrim(_login)), '@') AS handle
  )
  SELECT p.id
  FROM public.profiles p, needle n
  WHERE lower(p.username) = n.handle
  UNION ALL
  SELECT u.id
  FROM auth.users u, needle n
  WHERE lower(u.email) = n.raw
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_user_by_login(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_by_login(TEXT) TO service_role;

COMMENT ON FUNCTION public.find_user_by_login(TEXT) IS
  'Resolve a username or account email to a user id. Returns the uuid only. SECURITY DEFINER to reach auth.users; service-role only.';
