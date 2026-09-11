-- Staff RLS never included super_admin.
--
-- has_role() is an exact match on one role, so `has_role(uid,'admin')` is FALSE
-- for an account holding only super_admin. Every staff policy across support,
-- disputes and evidence spelled the check out as moderator-or-admin, so the
-- most privileged role on the platform had no read access to any of it.
--
-- src/lib/support.functions.ts carries a note about fixing exactly this in the
-- TypeScript layer ("a hardcoded .in('role', ['moderator','admin']) silently
-- excluded super_admin"). The RLS half was missed, and it is the half that
-- matters here: the moderator queue reads these tables straight from the
-- browser, so a pure super_admin would not get an error — they would get an
-- empty queue, which reads as "no work to do" rather than "you cannot see it".
--
-- It has not bitten because both current super admins also hold `admin`. It
-- bites the first time someone is granted super_admin on its own.
--
-- One helper instead of the role list repeated per policy, so the next staff
-- role is added in a single place rather than reintroducing this in nine.

CREATE OR REPLACE FUNCTION public.is_support_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('moderator', 'admin', 'super_admin')
  )
$$;

REVOKE ALL ON FUNCTION public.is_support_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_support_staff(uuid) TO authenticated, service_role;

-- ── disputes ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "disputes read involved" ON public.disputes;
CREATE POLICY "disputes read involved" ON public.disputes FOR SELECT TO authenticated USING (
  opened_by = auth.uid() OR public.is_support_staff(auth.uid())
);

DROP POLICY IF EXISTS "disputes moderate" ON public.disputes;
CREATE POLICY "disputes moderate" ON public.disputes FOR UPDATE TO authenticated USING (
  public.is_support_staff(auth.uid())
);

-- ── support tickets ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tickets read own or staff" ON public.support_tickets;
CREATE POLICY "tickets read own or staff" ON public.support_tickets
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR public.is_support_staff(auth.uid())
  );

DROP POLICY IF EXISTS "tickets update staff" ON public.support_tickets;
CREATE POLICY "tickets update staff" ON public.support_tickets
  FOR UPDATE TO authenticated USING (public.is_support_staff(auth.uid()));

-- ── support messages ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "messages read ticket participants" ON public.support_messages;
CREATE POLICY "messages read ticket participants" ON public.support_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid()
    )
    OR public.is_support_staff(auth.uid())
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
      OR public.is_support_staff(auth.uid())
    )
  );

-- ── match evidence, which is what a dispute is argued with ──────────────────
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
    OR public.is_support_staff(auth.uid())
  );

-- ── the files behind both ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "evidence read own or staff" ON storage.objects;
CREATE POLICY "evidence read own or staff" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'match-evidence'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_support_staff(auth.uid())
    )
  );

DROP POLICY IF EXISTS "support read own or staff" ON storage.objects;
CREATE POLICY "support read own or staff" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'support-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_support_staff(auth.uid())
    )
  );
