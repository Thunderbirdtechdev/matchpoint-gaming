-- ============================================================================
-- Chat: a global room, a private room per match, and the moderation to run them
-- ============================================================================
--
-- Two surfaces, one table. A global room where players find each other, and a
-- private room opened when a challenge is accepted. They differ only in who may
-- read them, which is a row-level question, so splitting them into two tables
-- would duplicate every moderation feature and every index for nothing.
--
-- WHY MODERATION IS IN THE FIRST VERSION RATHER THAN THE SECOND
--
-- A public room on a platform holding player money is where escrow goes to
-- die: two players agree to settle by Cash App, one of them does not pay, and
-- there is no stake to release and no match to dispute. It is also where
-- harassment and scams land, and the platform is the one holding the liability.
-- Reporting, deletion, muting and rate limiting are therefore not a later
-- iteration; a room without them cannot be opened at all.
--
-- DELETION IS SOFT, AND THAT IS DELIBERATE
--
-- A match room is evidence. When two players disagree about a result, what they
-- said to each other while the money was in escrow is the best record of what
-- happened, and a moderator who can destroy it — or a player who can delete
-- their own half of the argument — makes disputes unresolvable. `deleted_at`
-- hides a message from players; nothing removes it from the moderators who
-- decide who gets paid.
--
-- WRITES DO NOT GO THROUGH RLS
--
-- There is no INSERT policy. Every message is written by a server function
-- holding the service key, because three things have to happen before a row
-- exists — the mute check, the rate limit, and the off-platform scan — and none
-- of them can be expressed as a row predicate. SELECT is policy-driven because
-- realtime delivery depends on it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope       TEXT NOT NULL CHECK (scope IN ('global', 'match')),
  -- Set for scope='match', null for scope='global'. CASCADE because a deleted
  -- challenge has no room; the messages are meaningless without it.
  match_id    UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  -- What the off-platform scanner matched, if anything. Kept on the row so the
  -- moderator queue can be sorted by it: "show me everyone who said Cash App"
  -- is the single most useful query this table can answer.
  flagged     TEXT[] NOT NULL DEFAULT '{}',
  deleted_at  TIMESTAMPTZ,
  deleted_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chat_scope_match CHECK (
    (scope = 'match'  AND match_id IS NOT NULL) OR
    (scope = 'global' AND match_id IS NULL)
  )
);

-- The two reads this table serves: a room's recent history, and the moderator
-- queue of flagged messages.
CREATE INDEX IF NOT EXISTS chat_messages_global_idx
  ON public.chat_messages (created_at DESC) WHERE scope = 'global';
CREATE INDEX IF NOT EXISTS chat_messages_match_idx
  ON public.chat_messages (match_id, created_at DESC) WHERE scope = 'match';
CREATE INDEX IF NOT EXISTS chat_messages_flagged_idx
  ON public.chat_messages (created_at DESC) WHERE cardinality(flagged) > 0;
-- Backs the rate-limit count, which runs on every single send.
CREATE INDEX IF NOT EXISTS chat_messages_author_recent_idx
  ON public.chat_messages (author_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Mutes
-- ---------------------------------------------------------------------------
-- One row per muted user. `until` null means indefinite; a lifted mute is
-- deleted rather than flagged, so the table only ever holds live restrictions.
CREATE TABLE IF NOT EXISTS public.chat_mutes (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  until      TIMESTAMPTZ,
  reason     TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One report per person per message. Without this, a brigade can bury a
  -- message under a hundred rows and drown the queue it is meant to feed.
  UNIQUE (message_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS chat_reports_open_idx
  ON public.chat_reports (created_at DESC) WHERE status = 'open';

-- ---------------------------------------------------------------------------
-- 4. Capability
-- ---------------------------------------------------------------------------
-- `chat.moderate` covers deleting a message, muting an author and clearing a
-- report. Given to the roles that already do front-line review; financial_admin
-- deliberately does not get it, for the same reason it sees no tickets.
INSERT INTO public.role_capabilities (role, capability) VALUES
  ('moderator',   'chat.moderate'),
  ('admin',       'chat.moderate'),
  ('super_admin', 'chat.moderate')
ON CONFLICT (role, capability) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mutes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reports  ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.chat_messages TO authenticated;
GRANT SELECT ON public.chat_mutes    TO authenticated;
GRANT ALL    ON public.chat_messages TO service_role;
GRANT ALL    ON public.chat_mutes    TO service_role;
GRANT ALL    ON public.chat_reports  TO service_role;

-- Global room: any signed-in player, live messages only.
DROP POLICY IF EXISTS chat_read_global ON public.chat_messages;
CREATE POLICY chat_read_global ON public.chat_messages
  FOR SELECT TO authenticated
  USING (scope = 'global' AND deleted_at IS NULL);

-- Match room: the two players only. Note this deliberately does NOT check the
-- challenge's status — a settled or disputed match keeps its room readable, or
-- players would lose the conversation at the exact moment they need to refer
-- back to it.
DROP POLICY IF EXISTS chat_read_match ON public.chat_messages;
CREATE POLICY chat_read_match ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    scope = 'match'
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = chat_messages.match_id
        AND (c.creator_id = auth.uid() OR c.opponent_id = auth.uid())
    )
  );

-- Moderators see everything, including deleted messages and rooms they are not
-- in. This is the policy that makes a match room usable as dispute evidence.
DROP POLICY IF EXISTS chat_read_moderator ON public.chat_messages;
CREATE POLICY chat_read_moderator ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.has_capability(auth.uid(), 'chat.moderate'));

-- A player can see their own mute, so the composer can explain why it is
-- disabled instead of silently failing.
DROP POLICY IF EXISTS chat_mutes_read_self ON public.chat_mutes;
CREATE POLICY chat_mutes_read_self ON public.chat_mutes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_capability(auth.uid(), 'chat.moderate'));

-- No INSERT, UPDATE or DELETE policy anywhere here on purpose. Every write goes
-- through a server function holding the service key, which is where the mute
-- check, the rate limit and the off-platform scan live.

-- ---------------------------------------------------------------------------
-- 6. Realtime
-- ---------------------------------------------------------------------------
-- The client subscribes to inserts; RLS above decides which of them it is
-- allowed to receive. Guarded because adding a table twice raises.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'supabase_realtime publication not found, skipping';
END $$;

-- REPLICA IDENTITY FULL so an update (a moderator deleting a message) carries
-- the whole row to subscribers rather than just the primary key.
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

COMMENT ON TABLE public.chat_messages IS
  'Global and per-match chat. Writes are server-function only; deletion is soft so match rooms stay usable as dispute evidence.';
