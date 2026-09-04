-- ============================================================================
-- Module 9 — Security, Audit & Compliance
--   * audit_log         — every privileged action, append-only and immutable
--   * security_settings — the compliance switches, as data rather than code
--   * security_flags    — the suspicious-activity queue, deduplicated
--   * security_scan_candidates() — the detectors, as one uniform result set
--   * admin_mfa_status()         — who has actually enrolled a second factor
--   * three new capabilities on the Module 7 map
-- ============================================================================
--
-- Single file, safe to run in one go. Module 7 had to be split across two files
-- because it added enum VALUES and then inserted rows using them in the same
-- transaction, which Postgres refuses. Nothing here touches an enum — every new
-- status column is TEXT with a CHECK — so that hazard does not apply.
--
-- Idempotent, with one deliberate exception called out at the seed below:
-- security_settings is NOT re-seeded on a re-run, because doing so would
-- silently revert an operator's decision to switch enforcement on.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. New capabilities
-- ---------------------------------------------------------------------------
-- Module 7's role_capabilities table is rebuilt wholesale by its own migration
-- (it DELETEs then re-INSERTs), so adding rows here would be undone the next
-- time that file is re-run. These INSERTs are therefore additive and idempotent,
-- and the same three lines have been added to the Module 7 seed as well. Both
-- files must agree; src/lib/roles.ts mirrors them for rendering.
--
--   security.audit.view  — read the log, the flag queue and the settings.
--                          Operations AND treasury both need it: an audit trail
--                          only one lane can read is not an audit trail.
--   security.flags.manage— triage the suspicious-activity queue.
--   security.settings    — flip enforcement, and reset another user's 2FA.
--                          super_admin ONLY. This is the power to turn the
--                          other controls off, so it is the narrowest one.

INSERT INTO public.role_capabilities (role, capability) VALUES
  ('admin',           'security.audit.view'),
  ('admin',           'security.flags.manage'),
  ('financial_admin', 'security.audit.view'),
  ('super_admin',     'security.audit.view'),
  ('super_admin',     'security.flags.manage'),
  ('super_admin',     'security.settings')
ON CONFLICT (role, capability) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 2. audit_log — what staff did, kept beyond their tenure
-- ---------------------------------------------------------------------------
-- Module 7 audited role changes into role_grants because that one event had to
-- survive from day one. This is the general trail it deferred: wallet credits,
-- Stripe sweeps, company withdrawals, payout decisions, dispute overrides,
-- promo changes, security-setting flips and 2FA resets.
--
-- WHY THE ACTOR IS SNAPSHOTTED
-- actor_id is ON DELETE SET NULL, so deleting a staff account does not delete
-- the record of what they did — but it does leave a bare NULL. actor_label and
-- actor_roles freeze who that was and what hat they wore AT THE TIME, which is
-- the question an audit asks. A live join to user_roles would answer today's
-- question instead, and would show a demoted admin's past actions as if a
-- plain user had performed them.
--
-- BIGSERIAL, not uuid: an audit log is read in time order and gaps are
-- meaningful. A missing id is visible; a missing uuid is not.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  actor_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label  TEXT,
  actor_roles  TEXT[],

  action       TEXT NOT NULL,
  target_type  TEXT,
  target_id    TEXT,
  target_label TEXT,

  summary      TEXT NOT NULL,
  amount_cents BIGINT,
  metadata     JSONB NOT NULL DEFAULT '{}'::JSONB,

  ip           TEXT,
  user_agent   TEXT
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx   ON public.audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx  ON public.audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_target_idx  ON public.audit_log (target_type, target_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit log readable by security viewers" ON public.audit_log;
CREATE POLICY "audit log readable by security viewers" ON public.audit_log
  FOR SELECT TO authenticated USING (public.has_capability(auth.uid(), 'security.audit.view'));

GRANT SELECT ON public.audit_log TO authenticated;
GRANT SELECT, INSERT ON public.audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.audit_log_id_seq TO service_role;

-- ⚠️ IMMUTABILITY — this is the part that matters.
--
-- Having no UPDATE/DELETE *policy* (Module 7's approach for role_grants) stops
-- clients, because RLS denies what no policy allows. It does NOT stop the
-- service-role key, which bypasses RLS entirely — and every audit row is
-- written by that key. So the one identity able to write the log would also
-- have been able to rewrite it.
--
-- The trigger closes that: UPDATE and DELETE raise for every caller, including
-- service_role. The table is owned by postgres (migrations run as postgres in
-- the SQL editor), and service_role cannot drop a trigger on a table it does
-- not own, so an attacker holding the service key can append but never erase.

CREATE OR REPLACE FUNCTION public.audit_log_reject_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not permitted', TG_OP
    USING HINT = 'Correct a mistaken entry by appending a correcting one.';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_no_update ON public.audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_reject_mutation();

COMMENT ON TABLE public.audit_log IS
  'Module 9. Append-only record of privileged actions. UPDATE and DELETE are blocked by trigger for every role including service_role. No retention policy by design - do not add a purge job without a compliance decision.';

-- Backfill from role_grants so the general log is complete from its first day
-- rather than starting empty next to a role history that already exists.
-- Guarded on the log being empty of role actions, so a re-run cannot duplicate.
INSERT INTO public.audit_log (created_at, actor_id, action, target_type, target_id, summary, metadata)
SELECT
  rg.created_at,
  rg.actor_id,
  ('roles.' || rg.action)::TEXT,
  'user'::TEXT,
  rg.target_user_id::TEXT,
  (CASE WHEN rg.action = 'grant' THEN 'Granted ' ELSE 'Revoked ' END || rg.role
     || CASE WHEN rg.actor_id IS NULL THEN ' (system)' ELSE '' END)::TEXT,
  jsonb_build_object('role', rg.role, 'note', rg.note, 'backfilled_from', 'role_grants')
FROM public.role_grants rg
WHERE NOT EXISTS (
  SELECT 1 FROM public.audit_log al WHERE al.action IN ('roles.grant', 'roles.revoke')
);


-- ---------------------------------------------------------------------------
-- 3. security_settings — enforcement as data
-- ---------------------------------------------------------------------------
-- These are switches a compliance decision flips, not constants a deploy
-- changes. Keeping them in a table means turning jurisdiction enforcement on is
-- a click by an accountable person that lands in the audit log, rather than a
-- code change nobody can point to afterwards.
--
-- ⚠️ SEEDED WITH ON CONFLICT DO NOTHING, and that is not cosmetic. Every other
-- seed in this project rebuilds itself so the migration stays the source of
-- truth. This one must not: re-running the file after someone switches
-- enforcement ON would switch it back OFF, silently, and the platform would
-- resume accepting money from sanctioned jurisdictions with no error anywhere.
-- Change a DEFAULT here; change a LIVE VALUE in the app.

CREATE TABLE IF NOT EXISTS public.security_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security settings readable by security viewers" ON public.security_settings;
CREATE POLICY "security settings readable by security viewers" ON public.security_settings
  FOR SELECT TO authenticated USING (public.has_capability(auth.uid(), 'security.audit.view'));

GRANT SELECT ON public.security_settings TO authenticated;
GRANT ALL    ON public.security_settings TO service_role;

INSERT INTO public.security_settings (key, value, description) VALUES
  -- ON by default. It only bites an account whose country we actually KNOW to
  -- be sanctioned, or whose recorded date of birth is under 18. An account with
  -- no recorded country is unaffected, which is why this can ship on without
  -- breaking the existing unverified accounts.
  ('enforce_blocked_jurisdictions', 'true'::JSONB,
   'Refuse deposits, stakes and cash-outs from a recorded sanctioned country or a recorded under-18 date of birth.'),

  -- OFF by default. This is the blanket gate — it requires every player to have
  -- confirmed eligibility before touching money at all, and switching it on
  -- today would lock out every existing account. Module 3 deferred it for
  -- exactly this reason; the switch is the decision point, not the code.
  ('require_eligibility_confirmed', 'false'::JSONB,
   'Require a confirmed eligibility attestation before any money movement. Locks out accounts that have never completed onboarding.'),

  -- OFF by default. The AAL2 gate is written and wired; it has never been
  -- exercised by a real signed-in staff account, and no staff member has a
  -- factor enrolled yet. Switching it on before someone enrols would remove the
  -- treasury controls from everyone at once. Enrol first, then flip.
  ('require_mfa_for_treasury', 'false'::JSONB,
   'Require a verified second factor on the current session for treasury moves, wallet adjustments and privileged role grants.')
ON CONFLICT (key) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 4. security_flags — the suspicious-activity queue
-- ---------------------------------------------------------------------------
-- The failure mode for a queue like this is not missing a signal, it is showing
-- the same signal every day until people stop reading it. Two columns exist
-- solely to prevent that:
--
--   dedupe_key  — a deterministic identity for the finding, so a re-scan
--                 UPDATEs the existing row rather than appending a duplicate.
--   magnitude   — how big the finding is right now (disputes opened, accounts
--                 sharing a handle, matches in a lopsided pair).
--
-- Together they give dismissal real semantics: a dismissed flag STAYS dismissed
-- on re-scan, and re-opens only when magnitude exceeds what it was when the
-- human dismissed it. "I've looked at these 3 disputes" therefore does not
-- suppress the 8th.

CREATE TABLE IF NOT EXISTS public.security_flags (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                TEXT NOT NULL,
  dedupe_key          TEXT NOT NULL,
  severity            TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),

  -- SET NULL, not CASCADE: deleting the account must not delete the finding.
  -- `detail` holds a snapshot of who this was.
  subject_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  title               TEXT NOT NULL,
  detail              JSONB NOT NULL DEFAULT '{}'::JSONB,
  magnitude           NUMERIC NOT NULL DEFAULT 1,

  status              TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'acknowledged', 'dismissed', 'actioned')),

  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_count          INTEGER NOT NULL DEFAULT 1,

  resolved_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at         TIMESTAMPTZ,
  resolution_note     TEXT,
  -- magnitude at the moment a human dismissed it; NULL unless dismissed.
  dismissed_magnitude NUMERIC,

  UNIQUE (kind, dedupe_key)
);

CREATE INDEX IF NOT EXISTS security_flags_status_idx  ON public.security_flags (status, severity, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS security_flags_subject_idx ON public.security_flags (subject_user_id);

ALTER TABLE public.security_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security flags readable by security viewers" ON public.security_flags;
CREATE POLICY "security flags readable by security viewers" ON public.security_flags
  FOR SELECT TO authenticated USING (public.has_capability(auth.uid(), 'security.audit.view'));

-- No INSERT/UPDATE/DELETE policy: triage goes through server functions on the
-- service-role client, which also writes the audit entry for the triage itself.
GRANT SELECT ON public.security_flags TO authenticated;
GRANT ALL    ON public.security_flags TO service_role;


-- ---------------------------------------------------------------------------
-- 5. security_scan_candidates() — the detectors
-- ---------------------------------------------------------------------------
-- One function, one uniform shape, four detectors UNIONed. The caller
-- (src/lib/security.functions.ts) adds severity and wording and upserts the
-- results; a fifth detector lives there rather than here because it needs the
-- blocked-country list from src/lib/eligibility.ts, and a second copy of that
-- list in SQL is a list that will eventually disagree with the first.
--
-- STABLE and service_role-only, like every other reporting function in this
-- project. It reads across every player's wallet and match history, so it must
-- never be reachable from a client.
--
-- Windows are deliberately short (24h / 30d / 60d). These detectors answer
-- "what is happening now" for a human queue, not "what has ever happened".

CREATE OR REPLACE FUNCTION public.security_scan_candidates()
RETURNS TABLE (
  kind            TEXT,
  dedupe_key      TEXT,
  subject_user_id UUID,
  magnitude       NUMERIC,
  detail          JSONB
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$

  -- (a) DEPOSIT STRAIGHT BACK OUT — the classic laundering shape: money in,
  -- money out within a day, with no real play in between. Joining through
  -- wallet_transactions rather than the payout tables is what makes this cover
  -- every cash-out route at once (Stripe, PayPal, CashApp, crypto): they all
  -- debit the wallet, so they all leave a 'withdrawal' row here.
  SELECT
    'rapid_cashout'::TEXT,
    d.user_id::TEXT,
    d.user_id,
    COUNT(*)::NUMERIC,
    jsonb_build_object(
      'pairs',                COUNT(*),
      'deposited_cents',      SUM(d.amount_cents),
      'withdrawn_cents',      SUM(ABS(w.amount_cents)),
      'fastest_minutes',      ROUND(MIN(EXTRACT(EPOCH FROM (w.created_at - d.created_at)) / 60)),
      'window_hours',         24
    )
  FROM public.wallet_transactions d
  JOIN public.wallet_transactions w
    ON  w.user_id    = d.user_id
    AND w.type       = 'withdrawal'
    AND w.status    <> 'failed'
    AND w.created_at > d.created_at
    AND w.created_at < d.created_at + INTERVAL '24 hours'
  WHERE d.type    = 'deposit'
    AND d.status  = 'completed'
    AND d.created_at > now() - INTERVAL '30 days'
  GROUP BY d.user_id

  UNION ALL

  -- (b) ONE PAYOUT DESTINATION, SEVERAL ACCOUNTS — multi-accounting, and the
  -- shape behind most bonus abuse and match-fixing rings. Handles are
  -- lower-cased before grouping because 'A@b.com' and 'a@b.com' are the same
  -- PayPal account; crypto addresses are compared as stored, since case is
  -- significant in some address formats.
  SELECT
    'shared_payout_handle'::TEXT,
    h.handle_key,
    NULL::UUID,
    COUNT(DISTINCT h.user_id)::NUMERIC,
    jsonb_build_object(
      'handle_kind',  SPLIT_PART(h.handle_key, ':', 1),
      'account_count', COUNT(DISTINCT h.user_id),
      'user_ids',      jsonb_agg(DISTINCT h.user_id)
    )
  FROM (
    SELECT user_id, 'paypal:'  || LOWER(paypal_email) AS handle_key
      FROM public.user_payout_methods WHERE paypal_email IS NOT NULL
    UNION ALL
    SELECT user_id, 'cashapp:' || LOWER(cashapp_tag)  AS handle_key
      FROM public.user_payout_methods WHERE cashapp_tag IS NOT NULL
    UNION ALL
    SELECT user_id, 'crypto:'  || address             AS handle_key
      FROM public.crypto_payout_addresses
  ) h
  GROUP BY h.handle_key
  HAVING COUNT(DISTINCT h.user_id) > 1

  UNION ALL

  -- (c) A PLAYER WHO KEEPS OPENING DISPUTES. Three in a month is either someone
  -- being cheated repeatedly or someone working the dispute process; both are
  -- worth a human look, and the queue does not presume which.
  SELECT
    'repeat_disputes'::TEXT,
    dp.opened_by::TEXT,
    dp.opened_by,
    COUNT(*)::NUMERIC,
    jsonb_build_object(
      'disputes',    COUNT(*),
      'window_days', 30,
      'upheld',      COUNT(*) FILTER (WHERE dp.status = 'resolved')
    )
  FROM public.disputes dp
  WHERE dp.created_at > now() - INTERVAL '30 days'
  GROUP BY dp.opened_by
  HAVING COUNT(*) >= 3

  UNION ALL

  -- (d) THE SAME TWO PLAYERS, ONE ALWAYS WINNING. Normalising the pair with
  -- least()/greatest() means A-vs-B and B-vs-A collapse to one finding instead
  -- of two mirror-image ones. Four matches is the floor because at three, an
  -- 80% split is just 3-0, which happens honestly all the time.
  SELECT
    'collusion_pair'::TEXT,
    p.a::TEXT || ':' || p.b::TEXT,
    NULL::UUID,
    p.n::NUMERIC,
    jsonb_build_object(
      'user_ids',      jsonb_build_array(p.a, p.b),
      'matches',       p.n,
      'a_wins',        p.wa,
      'b_wins',        p.wb,
      'one_sidedness', ROUND(GREATEST(p.wa, p.wb)::NUMERIC / p.n, 2),
      'staked_cents',  p.staked,
      'window_days',   60
    )
  FROM (
    SELECT
      LEAST(c.creator_id, c.opponent_id)    AS a,
      GREATEST(c.creator_id, c.opponent_id) AS b,
      COUNT(*)                              AS n,
      COUNT(*) FILTER (WHERE c.winner_id = LEAST(c.creator_id, c.opponent_id))    AS wa,
      COUNT(*) FILTER (WHERE c.winner_id = GREATEST(c.creator_id, c.opponent_id)) AS wb,
      SUM(c.entry_amount)                   AS staked
    FROM public.challenges c
    WHERE c.opponent_id IS NOT NULL
      AND c.winner_id   IS NOT NULL
      AND c.created_at  > now() - INTERVAL '60 days'
    GROUP BY 1, 2
  ) p
  WHERE p.n >= 4
    AND GREATEST(p.wa, p.wb)::NUMERIC / p.n >= 0.8

  UNION ALL

  -- (e) STAFF ACTING ON THEIR OWN ACCOUNT. This one reads the audit log itself,
  -- which is the point of having written it: an admin crediting their own
  -- wallet or approving their own payout is the single highest-signal event on
  -- the platform, and until Module 9 there was no record to notice it in.
  -- Role changes are excluded — revoking your own role is a normal, safe act
  -- and Module 7 already refuses the dangerous version of it.
  SELECT
    'self_dealing'::TEXT,
    al.actor_id::TEXT,
    al.actor_id,
    COUNT(*)::NUMERIC,
    jsonb_build_object(
      'events',       COUNT(*),
      'actions',      jsonb_agg(DISTINCT al.action),
      'total_cents',  COALESCE(SUM(al.amount_cents), 0),
      'window_days',  90
    )
  FROM public.audit_log al
  WHERE al.actor_id IS NOT NULL
    AND al.target_type = 'user'
    AND al.target_id   = al.actor_id::TEXT
    AND al.action NOT LIKE 'roles.%'
    AND al.created_at > now() - INTERVAL '90 days'
  GROUP BY al.actor_id;

$$;

REVOKE ALL ON FUNCTION public.security_scan_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_scan_candidates() TO service_role;

COMMENT ON FUNCTION public.security_scan_candidates() IS
  'Module 9. Suspicious-activity detectors as one uniform result set. Service-role only - it reads every player''s wallet and match history. The jurisdiction detector lives in TypeScript so the blocked-country list has exactly one home.';


-- ---------------------------------------------------------------------------
-- 6. admin_mfa_status() — has this person actually enrolled a second factor?
-- ---------------------------------------------------------------------------
-- auth.mfa_factors is in the auth schema, which PostgREST does not expose and
-- the service-role key cannot query directly through the REST API. The GoTrue
-- admin API can answer this, but only one user per HTTP call — a staff list of
-- twelve would be twelve round trips before the page renders.
--
-- SECURITY DEFINER so it can read auth.mfa_factors, taking an explicit array of
-- ids so it can never be used to enumerate the whole user table. It returns
-- counts and a timestamp only: no secrets, no factor ids.

CREATE OR REPLACE FUNCTION public.admin_mfa_status(_user_ids UUID[])
RETURNS TABLE (
  user_id         UUID,
  factor_count    BIGINT,
  verified_count  BIGINT,
  last_verified_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    u.id,
    COUNT(f.id)::BIGINT,
    COUNT(f.id) FILTER (WHERE f.status = 'verified')::BIGINT,
    MAX(f.updated_at)
  FROM UNNEST(_user_ids) AS u(id)
  LEFT JOIN auth.mfa_factors f ON f.user_id = u.id
  GROUP BY u.id;
$$;

REVOKE ALL ON FUNCTION public.admin_mfa_status(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mfa_status(UUID[]) TO service_role;

COMMENT ON FUNCTION public.admin_mfa_status(UUID[]) IS
  'Module 9. Second-factor enrolment status for the given users. SECURITY DEFINER to reach auth.mfa_factors; service-role only; returns counts, never factor secrets.';


-- ---------------------------------------------------------------------------
-- 7. security_record_flag() — the upsert that makes dismissal mean something
-- ---------------------------------------------------------------------------
-- The scanner calls this once per finding. It lives in SQL rather than in the
-- caller because the rule it encodes is a single atomic decision about one row,
-- and PostgREST's upsert cannot express a conditional status: expressed as
-- select-then-update from the app, two concurrent scans would race and
-- double-count `seen_count`.
--
-- THE RULE, and the reason the queue stays worth reading:
--
--   * A re-scan of an unchanged finding UPDATES the existing row. It does not
--     append a second copy, so the queue does not grow by its own length daily.
--   * A finding a human dismissed STAYS dismissed. This is the important half —
--     a queue that resurrects everything someone already judged is a queue
--     people stop opening, and then the one real finding goes unread too.
--   * ...unless it got BIGGER than it was when they dismissed it. "I've looked
--     at these 3 disputes" must not silently suppress the 8th, so the
--     magnitude at dismissal is remembered and compared. Growth past that mark
--     reopens the flag and clears the mark.
--
-- `security_flags.<col>` on the right-hand side is the EXISTING row; EXCLUDED
-- is what this scan just proposed.

CREATE OR REPLACE FUNCTION public.security_record_flag(
  _kind            TEXT,
  _dedupe_key      TEXT,
  _subject_user_id UUID,
  _severity        TEXT,
  _title           TEXT,
  _detail          JSONB,
  _magnitude       NUMERIC
)
RETURNS UUID
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  INSERT INTO public.security_flags
    (kind, dedupe_key, subject_user_id, severity, title, detail, magnitude)
  VALUES
    (_kind, _dedupe_key, _subject_user_id, _severity, _title, _detail, _magnitude)
  ON CONFLICT (kind, dedupe_key) DO UPDATE SET
    last_seen_at = now(),
    seen_count   = security_flags.seen_count + 1,
    detail       = EXCLUDED.detail,
    magnitude    = EXCLUDED.magnitude,
    severity     = EXCLUDED.severity,
    title        = EXCLUDED.title,

    status = CASE
      WHEN security_flags.status IN ('dismissed', 'actioned')
       AND EXCLUDED.magnitude > COALESCE(security_flags.dismissed_magnitude, security_flags.magnitude)
      THEN 'open'
      ELSE security_flags.status
    END,

    -- Cleared on reopen so the next dismissal sets a fresh high-water mark;
    -- otherwise a flag dismissed at 3, reopened at 8 and dismissed again would
    -- still be measuring against 3 and would reopen on every later scan.
    dismissed_magnitude = CASE
      WHEN security_flags.status IN ('dismissed', 'actioned')
       AND EXCLUDED.magnitude > COALESCE(security_flags.dismissed_magnitude, security_flags.magnitude)
      THEN NULL
      ELSE security_flags.dismissed_magnitude
    END
  RETURNING id;
$$;

REVOKE ALL ON FUNCTION public.security_record_flag(TEXT, TEXT, UUID, TEXT, TEXT, JSONB, NUMERIC)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_record_flag(TEXT, TEXT, UUID, TEXT, TEXT, JSONB, NUMERIC)
  TO service_role;

COMMENT ON FUNCTION public.security_record_flag(TEXT, TEXT, UUID, TEXT, TEXT, JSONB, NUMERIC) IS
  'Module 9. Idempotent upsert for one suspicious-activity finding. A dismissed flag stays dismissed until its magnitude exceeds the value it held when a human dismissed it.';
