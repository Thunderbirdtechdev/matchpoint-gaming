-- ============================================================================
-- Module 6 — Support & Dispute Portal
--   * support_tickets / support_messages: threaded player support
--   * disputes: reviewer columns for a two-person rule on payouts
--   * support-attachments: private bucket
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Support tickets
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT 'other'
                CHECK (category IN ('payout', 'deposit', 'match', 'account', 'bug', 'other')),
  subject     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  priority    TEXT NOT NULL DEFAULT 'normal'
                CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Optional links so a ticket can be opened straight off a match or a payout.
  challenge_id  UUID REFERENCES public.challenges(id) ON DELETE SET NULL,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS support_tickets_user_idx   ON public.support_tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON public.support_tickets (status, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets read own or staff" ON public.support_tickets;
CREATE POLICY "tickets read own or staff" ON public.support_tickets
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'moderator')
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "tickets create own" ON public.support_tickets;
CREATE POLICY "tickets create own" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Staff only. A reporter closing or re-prioritising their own ticket would
-- let them skip the queue, so those transitions go through a server function.
DROP POLICY IF EXISTS "tickets update staff" ON public.support_tickets;
CREATE POLICY "tickets update staff" ON public.support_tickets
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin')
  );


-- ---------------------------------------------------------------------------
-- 2. Ticket messages
--
-- `is_staff` is stamped by the server, not the client — it drives how a message
-- is presented, so letting a player set it would let them impersonate support.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.support_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  is_staff        BOOLEAN NOT NULL DEFAULT false,
  attachment_path TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_ticket_idx
  ON public.support_messages (ticket_id, created_at);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages read ticket participants" ON public.support_messages;
CREATE POLICY "messages read ticket participants" ON public.support_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'moderator')
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "messages insert participants" ON public.support_messages;
CREATE POLICY "messages insert participants" ON public.support_messages
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'moderator')
      OR public.has_role(auth.uid(), 'admin')
    )
  );


-- ---------------------------------------------------------------------------
-- 3. Dispute review — two-person rule
--
-- Resolving a dispute releases real money and cannot be undone, so the decision
-- and the payout are split: a moderator records a recommended winner, an admin
-- confirms it. `adminResolveChallenge` remains the only path that moves funds.
-- ---------------------------------------------------------------------------

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS recommended_winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_note           TEXT,
  ADD COLUMN IF NOT EXISTS approved_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at           TIMESTAMPTZ;

-- Statuses in use: open -> awaiting_approval -> resolved (or denied).
CREATE INDEX IF NOT EXISTS disputes_status_idx ON public.disputes (status, created_at DESC);


-- ---------------------------------------------------------------------------
-- 4. Support attachments — PRIVATE bucket
--
-- Same reasoning as match-evidence: a support screenshot can contain personal
-- or financial detail, so it is never publicly readable. Cross-party access is
-- granted through short-lived signed URLs minted server-side.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments', 'support-attachments', false, 10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "support insert own folder" ON storage.objects;
CREATE POLICY "support insert own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "support read own or staff" ON storage.objects;
CREATE POLICY "support read own or staff" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'moderator')
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "support delete own folder" ON storage.objects;
CREATE POLICY "support delete own folder" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'support-attachments' AND (storage.foldername(name))[1] = auth.uid()::text
  );
