-- ============================================================================
-- Contact enquiries
-- ============================================================================
--
-- /contact has existed since the marketing site was built, is linked from the
-- footer, and its submit button was wired to nothing at all. Anyone who filled
-- it in watched the form sit there. Every enquiry the platform has ever
-- received is gone.
--
-- Kevin's reason for raising it is the one that makes this worth a table rather
-- than a mailto: he wants tournament organisers to ask about white-labelling
-- the bracket automation. Those are sales leads. Losing one because an email
-- bounced, or because it landed in a personal inbox nobody was watching, costs
-- more than the whole feature.
--
-- So: stored first, emailed second. The email is a notification about a row
-- that already exists, not the delivery mechanism itself.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What the enquiry is about. `partnership` is the one Kevin cares about;
  -- keeping it as a category rather than a separate form means one inbox and
  -- one place to look.
  topic       TEXT NOT NULL DEFAULT 'general'
              CHECK (topic IN ('general', 'partnership', 'support', 'press')),
  name        TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  email       TEXT NOT NULL CHECK (char_length(btrim(email)) BETWEEN 3 AND 320),
  -- Optional, and only meaningful for partnership enquiries.
  organisation TEXT CHECK (organisation IS NULL OR char_length(organisation) <= 200),
  subject     TEXT NOT NULL CHECK (char_length(btrim(subject)) BETWEEN 1 AND 200),
  message     TEXT NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 5000),
  -- Set when a signed-in player writes in, null for a visitor. Not a foreign
  -- key requirement: most enquiries will come from people without an account,
  -- which is rather the point.
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'new'
              CHECK (status IN ('new', 'read', 'replied', 'closed')),
  handled_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The queue read: newest unhandled first.
CREATE INDEX IF NOT EXISTS contact_messages_new_idx
  ON public.contact_messages (created_at DESC) WHERE status = 'new';
-- Partnership leads deserve their own fast path.
CREATE INDEX IF NOT EXISTS contact_messages_partnership_idx
  ON public.contact_messages (created_at DESC) WHERE topic = 'partnership';

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.contact_messages TO service_role;

-- No policy for anon or authenticated, deliberately.
--
-- Inserts go through a server function holding the service key so the write can
-- be rate limited and the staff notification sent in the same breath. Allowing
-- a direct insert would hand the open internet an unthrottled writer on a table
-- staff read, which is a spam queue rather than an inbox.
--
-- Reads are staff-only and also go through a server function, gated on
-- `moderation.tickets` — the people already handling support are the people who
-- should see these.

COMMENT ON TABLE public.contact_messages IS
  'Enquiries from /contact. Written only by server functions; the form was previously wired to nothing.';
