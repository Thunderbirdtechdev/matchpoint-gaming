-- ============================================================================
-- Module 7 — Admin & Role System, part 2 of 2.
--   * role_capabilities: what each role may DO, as data rather than as code
--   * has_capability(): the single enforcement primitive
--   * role_grants: an audit trail for every privilege change
--   * bootstrap: existing admins become super_admins
-- ============================================================================
--
-- ⚠️ RUN 20260903210000_role_hierarchy_enum.sql FIRST and let it commit.
--    This file inserts 'super_admin' and 'financial_admin' rows, which fails if
--    those enum values were added in the same still-open transaction. The
--    companion file explains why in full.
--
-- WHY CAPABILITIES AND NOT A LADDER
--
-- The obvious model is a numeric rank — super_admin > admin > financial_admin >
-- moderator — and it is wrong here. 'financial_admin' is not a rung, it is a
-- lane: the whole point of naming a finance role is that you can hand someone
-- the bank without also handing them every dispute thread and support ticket.
-- On a ladder that is impossible to express.
--
-- So roles map to named capabilities and every check asks "can this user do X",
-- never "is this user at least a Y". Adding a role later is a seed row, not a
-- rewrite of every call site.
--
-- Idempotent: safe to re-run.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 2. The capability map
-- ---------------------------------------------------------------------------
-- `role` is TEXT, not app_role, so a capability can be seeded for a role before
-- that role exists in the enum — which is exactly the ordering this two-file
-- split creates. It also keeps the map readable in a plain SELECT.
--
-- The integrity guarantee comes from the seed below being the only writer: the
-- table has no INSERT policy, so a typo cannot arrive from the app.

CREATE TABLE IF NOT EXISTS public.role_capabilities (
  role        TEXT NOT NULL,
  capability  TEXT NOT NULL,
  PRIMARY KEY (role, capability)
);

ALTER TABLE public.role_capabilities ENABLE ROW LEVEL SECURITY;

-- Readable by any signed-in user. This is a policy map, not a secret: the
-- client needs it to decide which nav entries to render, and knowing that
-- 'admin' implies 'promo.manage' grants nobody anything.
DROP POLICY IF EXISTS "capabilities readable" ON public.role_capabilities;
CREATE POLICY "capabilities readable" ON public.role_capabilities
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.role_capabilities TO authenticated;
GRANT ALL    ON public.role_capabilities TO service_role;

-- Rebuild the map on every run so this migration is the single source of truth.
-- (Editing a seed row by hand in the SQL editor will be reverted on re-run —
-- change it here instead.)
DELETE FROM public.role_capabilities;

INSERT INTO public.role_capabilities (role, capability) VALUES
  -- ── moderator ── front-line review. Sees player disputes and tickets.
  --    Deliberately CANNOT approve a dispute: approving releases escrow, and
  --    Module 6's two-person rule requires a second, different person for that.
  ('moderator',       'moderation.disputes.review'),
  ('moderator',       'moderation.tickets'),
  ('moderator',       'moderation.evidence'),

  -- ── admin ── platform operations. Everything a moderator can do, plus
  --    dispute approval, promo codes, and granting the moderator role.
  --    Can SEE finance but cannot MOVE money — see the finance lane below.
  ('admin',           'moderation.disputes.review'),
  ('admin',           'moderation.disputes.approve'),
  ('admin',           'moderation.tickets'),
  ('admin',           'moderation.evidence'),
  ('admin',           'moderation.tournaments.override'),
  ('admin',           'users.view'),
  ('admin',           'promo.manage'),
  ('admin',           'roles.view'),
  ('admin',           'roles.manage'),
  ('admin',           'platform.analytics'),
  ('admin',           'finance.view'),

  -- ── financial_admin ── the treasury lane. Moves real money; sees no
  --    disputes, no tickets, no evidence. Lateral to admin, not below it.
  ('financial_admin', 'users.view'),
  ('financial_admin', 'roles.view'),
  ('financial_admin', 'platform.analytics'),
  ('financial_admin', 'finance.view'),
  ('financial_admin', 'finance.payouts'),
  ('financial_admin', 'finance.treasury'),
  ('financial_admin', 'finance.wallet_adjust'),

  -- ── super_admin ── the union of both lanes, and the only role that can
  --    grant a privileged role. Someone has to be able to appoint the first
  --    financial_admin; that power is deliberately not on 'admin'.
  ('super_admin',     'moderation.disputes.review'),
  ('super_admin',     'moderation.disputes.approve'),
  ('super_admin',     'moderation.tickets'),
  ('super_admin',     'moderation.evidence'),
  ('super_admin',     'moderation.tournaments.override'),
  ('super_admin',     'users.view'),
  ('super_admin',     'promo.manage'),
  ('super_admin',     'roles.view'),
  ('super_admin',     'roles.manage'),
  ('super_admin',     'roles.manage_privileged'),
  ('super_admin',     'platform.analytics'),
  ('super_admin',     'finance.view'),
  ('super_admin',     'finance.payouts'),
  ('super_admin',     'finance.treasury'),
  ('super_admin',     'finance.wallet_adjust');


-- ---------------------------------------------------------------------------
-- 3. has_capability — the enforcement primitive
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER for the same reason has_role is: it reads user_roles, which
-- is owner-only under RLS, and it must be callable from inside a policy on
-- another table without recursing.
--
-- STABLE + pinned search_path. Never grant this to anon: an anonymous caller
-- has no roles, so it can only ever return false, and exposing it just hands
-- out a free role-probe oracle.

CREATE OR REPLACE FUNCTION public.has_capability(_user_id UUID, _capability TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_capabilities rc ON rc.role = ur.role::TEXT
    WHERE ur.user_id = _user_id
      AND rc.capability = _capability
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_capability(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_capability(UUID, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.has_capability(UUID, TEXT) IS
  'Module 7. True when any of the user''s roles grants the named capability. '
  'Prefer this over has_role() in new policies and server functions — has_role '
  'is an exact match with no hierarchy, so it silently excludes super_admin.';


-- ---------------------------------------------------------------------------
-- 4. Audit trail for privilege changes
-- ---------------------------------------------------------------------------
-- Module 9 owns audit logging generally, but role changes are the one event
-- where "who did this" has to survive from day one — a granted admin can
-- rewrite almost anything else afterwards.

CREATE TABLE IF NOT EXISTS public.role_grants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role           TEXT NOT NULL,
  action         TEXT NOT NULL CHECK (action IN ('grant', 'revoke')),
  actor_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_grants_target_idx  ON public.role_grants (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS role_grants_created_idx ON public.role_grants (created_at DESC);

ALTER TABLE public.role_grants ENABLE ROW LEVEL SECURITY;

-- Readable by anyone who can see the staff list. No INSERT/UPDATE/DELETE policy
-- at all, so the log is append-only from the server functions and cannot be
-- edited or erased by a client — including by an admin covering their tracks.
DROP POLICY IF EXISTS "role grants readable by role viewers" ON public.role_grants;
CREATE POLICY "role grants readable by role viewers" ON public.role_grants
  FOR SELECT TO authenticated USING (public.has_capability(auth.uid(), 'roles.view'));

GRANT SELECT ON public.role_grants TO authenticated;
GRANT ALL    ON public.role_grants TO service_role;


-- ---------------------------------------------------------------------------
-- 5. Bootstrap — existing admins become super_admins
-- ---------------------------------------------------------------------------
-- ⚠️ THIS IS A PRIVILEGE ESCALATION, AND IT IS DELIBERATE.
--
-- 'super_admin' is only grantable by an existing super_admin. Without a
-- backfill the very first one could never be created through the app, and
-- nobody could ever appoint a financial_admin — the system would be
-- permanently stuck one role short.
--
-- Backfilling also means no current admin loses access on the day this ships:
-- finance moved to its own lane, so a plain 'admin' can no longer sweep the
-- Stripe balance, but every admin who could do that yesterday is a super_admin
-- today and still can.
--
-- ✅ AFTER RUNNING THIS: review the staff list in /admin and demote anyone who
-- does not genuinely need super_admin down to 'admin'. This is the one privilege
-- decision the migration cannot make for you.
--
-- The existing 'admin' row is KEPT, not replaced — see step 6.

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT ur.user_id, 'super_admin'::public.app_role
FROM public.user_roles ur
WHERE ur.role = 'admin'::public.app_role
ON CONFLICT DO NOTHING;

-- Logged with a NULL actor, which is what "the migration did this, not a person"
-- looks like in the audit trail. The NOT EXISTS guard keeps a re-run from
-- stacking duplicate bootstrap entries on top of a real grant history.
INSERT INTO public.role_grants (target_user_id, role, action, actor_id, note)
SELECT DISTINCT ur.user_id, 'super_admin', 'grant', NULL,
       'Module 7 bootstrap: existing admin promoted so the role system has an owner.'
FROM public.user_roles ur
WHERE ur.role = 'admin'::public.app_role
  AND NOT EXISTS (
    SELECT 1 FROM public.role_grants rg
    WHERE rg.target_user_id = ur.user_id
      AND rg.role = 'super_admin'
      AND rg.action = 'grant'
  );


-- ---------------------------------------------------------------------------
-- 6. INVARIANT: super_admin is always held ALONGSIDE admin
-- ---------------------------------------------------------------------------
-- Every RLS policy written before this migration spells out
--   has_role(uid,'moderator') OR has_role(uid,'admin')
-- and has_role() is an exact match. A user holding ONLY 'super_admin' would
-- therefore fail every one of those ~25 policies across seven migrations —
-- the most privileged account on the platform would be the one locked out.
--
-- Rewriting live RLS on money tables is its own change with its own testing,
-- so instead the system maintains an invariant: granting 'super_admin' always
-- grants 'admin' too. The bootstrap above satisfies it (it only ever promotes
-- accounts that already hold 'admin'), and adminGrantRole enforces it for
-- every future grant. Revoking 'admin' from a super_admin is likewise blocked.
--
-- New policies should use has_capability(). Retiring the has_role() calls
-- belongs with the Module 9 security pass, and once they are gone this
-- invariant can be dropped with them.
--
-- Backstop for anything that wrote user_roles directly before this ran:

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT ur.user_id, 'admin'::public.app_role
FROM public.user_roles ur
WHERE ur.role = 'super_admin'::public.app_role
ON CONFLICT DO NOTHING;
