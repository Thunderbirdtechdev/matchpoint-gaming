-- ============================================================================
-- Module 3 — Player Account & Profile
--   * private verification / eligibility data
--   * public read-only projections for profiles and stats
--   * avatar storage bucket
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Verification & eligibility (PRIVATE)
--
-- Deliberately NOT columns on public.profiles: that table's policy is
-- `FOR SELECT USING (true)`, so anything added there becomes world-readable.
-- Date of birth and country must never be. They live here, owner-only, and
-- reach the public profile solely as a derived boolean (see player_public).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.player_verification (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  date_of_birth       DATE,
  country             TEXT,
  age_confirmed_at    TIMESTAMPTZ,

  -- Room for document KYC (Stripe Identity) later without another migration.
  identity_status     TEXT NOT NULL DEFAULT 'unverified'
                        CHECK (identity_status IN ('unverified', 'pending', 'verified', 'rejected')),
  identity_session_id TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.player_verification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verification select own" ON public.player_verification;
CREATE POLICY "verification select own" ON public.player_verification
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "verification insert own" ON public.player_verification;
CREATE POLICY "verification insert own" ON public.player_verification
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "verification update own" ON public.player_verification;
CREATE POLICY "verification update own" ON public.player_verification
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- 2. Public player projection
--
-- A view, not extra columns, so the eligibility boolean cannot be forged: the
-- `profiles update own` policy lets a user write any column on their own row,
-- so a writable `is_age_verified` flag would be self-serve. This view is owned
-- by the migration role and runs with definer rights (security_invoker is off
-- by default), letting it read the private table while exposing only the flag.
--
--   ⚠️  DO NOT add further columns from player_verification to this view.
--
-- Because it runs as definer, RLS on player_verification does NOT apply here.
-- Adding `v.date_of_birth` or `v.country` would make them world-readable
-- immediately — no error, no warning, nothing to catch it. Only the derived
-- boolean below is safe to project. Supabase's linter flags this view under
-- "Security Definer View" (0010); that finding is knowingly accepted, see
-- v1-progress.md → "Security linter findings".
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.player_public AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.favorite_game,
  p.platform,
  p.region,
  p.reputation,
  p.xp,
  p.rank_tier,
  p.created_at,
  (v.age_confirmed_at IS NOT NULL) AS is_age_verified
FROM public.profiles p
LEFT JOIN public.player_verification v ON v.user_id = p.id;

GRANT SELECT ON public.player_public TO anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3. Player stats
--
-- Derived from public.challenges only. wallet_transactions is owner-only, so
-- summing it here would leak private balances through a public view. Earnings
-- are therefore reconstructed from settled challenges using the same tiered
-- rates as src/lib/fees.ts (pool = entry x 2).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.player_stats AS
WITH settled AS (
  SELECT
    c.id,
    c.creator_id,
    c.opponent_id,
    c.winner_id,
    ROUND(
      (c.entry_amount * 2) * (
        1 - CASE
              WHEN c.entry_amount * 2 <= 25  THEN 0.10
              WHEN c.entry_amount * 2 <= 100 THEN 0.08
              WHEN c.entry_amount * 2 <= 500 THEN 0.06
              ELSE 0.05
            END
      ), 2
    ) AS net_prize
  FROM public.challenges c
  WHERE c.status = 'settled'
    AND c.winner_id IS NOT NULL
),
participants AS (
  SELECT id, creator_id AS user_id, winner_id, net_prize FROM settled
  UNION ALL
  SELECT id, opponent_id AS user_id, winner_id, net_prize FROM settled WHERE opponent_id IS NOT NULL
)
SELECT
  user_id,
  COUNT(*)::int                                                        AS matches_played,
  COUNT(*) FILTER (WHERE winner_id = user_id)::int                     AS wins,
  COUNT(*) FILTER (WHERE winner_id <> user_id)::int                    AS losses,
  COALESCE(SUM(net_prize) FILTER (WHERE winner_id = user_id), 0)::numeric(12,2) AS earnings
FROM participants
GROUP BY user_id;

GRANT SELECT ON public.player_stats TO anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4. Leaderboard — stats joined to public identity, ranked by earnings
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.player_leaderboard AS
SELECT
  pp.id,
  pp.username,
  pp.display_name,
  pp.avatar_url,
  pp.favorite_game,
  pp.rank_tier,
  pp.is_age_verified,
  s.matches_played,
  s.wins,
  s.losses,
  s.earnings,
  RANK() OVER (ORDER BY s.earnings DESC, s.wins DESC)::int AS rank
FROM public.player_stats s
JOIN public.player_public pp ON pp.id = s.user_id
WHERE s.matches_played > 0;

GRANT SELECT ON public.player_leaderboard TO anon, authenticated;


-- ---------------------------------------------------------------------------
-- 5. Avatar storage
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Objects are keyed <user-id>/<filename>, so ownership is the first path segment.
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars insert own" ON storage.objects;
CREATE POLICY "avatars insert own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars update own" ON storage.objects;
CREATE POLICY "avatars update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars delete own" ON storage.objects;
CREATE POLICY "avatars delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ---------------------------------------------------------------------------
-- 6. Lookup index — public profiles are addressed by username
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS profiles_username_lower_idx
  ON public.profiles (lower(username));
