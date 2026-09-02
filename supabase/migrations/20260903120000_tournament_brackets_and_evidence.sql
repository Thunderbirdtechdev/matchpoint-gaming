-- ============================================================================
-- Module 4 — Competition / Tournament Flow
--   * tournament_matches: the bracket
--   * match_evidence + private bucket: screenshots and clips
--   * tournament_bracket view for the public lobby
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Bracket
--
-- Rounds are 1-based; `slot` is the 0-based position within a round, so
-- (round, slot) uniquely addresses a match and slot/2 gives the slot it feeds
-- in the next round. A 'bye' is a match with only player1 — it settles
-- immediately so the entrant advances without playing.
--
-- No INSERT/UPDATE policies: the bracket is mutated only by server functions
-- running as service_role, which bypass RLS. That keeps seeding and
-- advancement authoritative instead of something a client could forge.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round         INT  NOT NULL CHECK (round >= 1),
  slot          INT  NOT NULL CHECK (slot >= 0),
  player1_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  player2_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'ready', 'settled', 'bye')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, round, slot)
);

CREATE INDEX IF NOT EXISTS tournament_matches_tournament_idx
  ON public.tournament_matches (tournament_id, round, slot);

ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

-- Brackets are public, matching `tournaments public read`.
DROP POLICY IF EXISTS "matches public read" ON public.tournament_matches;
CREATE POLICY "matches public read" ON public.tournament_matches
  FOR SELECT USING (true);


-- ---------------------------------------------------------------------------
-- 2. Evidence
--
-- Exactly one of challenge_id / tournament_match_id is set — evidence always
-- belongs to a specific contest.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.match_evidence (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id        UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
  tournament_match_id UUID REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path           TEXT NOT NULL,
  kind                TEXT NOT NULL DEFAULT 'screenshot'
                        CHECK (kind IN ('screenshot', 'clip', 'other')),
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT match_evidence_one_target CHECK (
    (challenge_id IS NOT NULL AND tournament_match_id IS NULL)
    OR (challenge_id IS NULL AND tournament_match_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS match_evidence_challenge_idx
  ON public.match_evidence (challenge_id);
CREATE INDEX IF NOT EXISTS match_evidence_match_idx
  ON public.match_evidence (tournament_match_id);

ALTER TABLE public.match_evidence ENABLE ROW LEVEL SECURITY;

-- Readable by the uploader, the other participant in that contest, and staff.
-- Deliberately NOT public: evidence can contain personal detail, and a public
-- read would expose it on lobby pages that anyone can open.
DROP POLICY IF EXISTS "evidence read participants" ON public.match_evidence;
CREATE POLICY "evidence read participants" ON public.match_evidence
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = match_evidence.challenge_id
        AND (c.creator_id = auth.uid() OR c.opponent_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.tournament_matches m
      WHERE m.id = match_evidence.tournament_match_id
        AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'moderator')
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "evidence insert own" ON public.match_evidence;
CREATE POLICY "evidence insert own" ON public.match_evidence
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "evidence delete own" ON public.match_evidence;
CREATE POLICY "evidence delete own" ON public.match_evidence
  FOR DELETE TO authenticated USING (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- 3. Evidence storage — PRIVATE bucket
--
-- Unlike avatars this bucket is not public. Storage policies cannot express
-- "the other player in this match", so they stay owner-only (plus staff) and
-- cross-participant viewing is done with short-lived signed URLs minted by a
-- server function after it checks participation.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'match-evidence', 'match-evidence', false, 10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "evidence insert own folder" ON storage.objects;
CREATE POLICY "evidence insert own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'match-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "evidence read own or staff" ON storage.objects;
CREATE POLICY "evidence read own or staff" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'match-evidence'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'moderator')
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "evidence delete own folder" ON storage.objects;
CREATE POLICY "evidence delete own folder" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'match-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ---------------------------------------------------------------------------
-- 4. Public bracket view — matches joined to public identity
--    Reuses player_public so no private column can leak through the bracket.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.tournament_bracket AS
SELECT
  m.id,
  m.tournament_id,
  m.round,
  m.slot,
  m.status,
  m.winner_id,
  m.player1_id,
  p1.username     AS player1_username,
  p1.display_name AS player1_name,
  p1.avatar_url   AS player1_avatar,
  m.player2_id,
  p2.username     AS player2_username,
  p2.display_name AS player2_name,
  p2.avatar_url   AS player2_avatar
FROM public.tournament_matches m
LEFT JOIN public.player_public p1 ON p1.id = m.player1_id
LEFT JOIN public.player_public p2 ON p2.id = m.player2_id;

GRANT SELECT ON public.tournament_bracket TO anon, authenticated;
