-- ============================================================================
-- Module 8 — Financial Dashboard reporting functions
--   * admin_revenue_daily()        — gap-filled daily series, for charts
--   * admin_revenue_by_source_range() — source breakdown over a date range
--   * admin_platform_liabilities()  — what the platform OWES vs what it HOLDS
-- ============================================================================
--
-- Single file, and it only adds functions — no new types, no new tables, no
-- enum changes. So none of the two-phase ordering the Module 7 migration needed
-- applies here, and this is safe to run in one go.
--
-- Every function follows the pattern already established by
-- 20260724180000_admin_revenue_reporting.sql: STABLE, pinned search_path, and
-- EXECUTE granted to service_role ONLY. They are reached through server
-- functions that gate on the 'finance.view' capability (Module 7), never
-- directly from the client, so there is no path for a player to call them.
--
-- ⚠️ TIMEZONE: created_at is timestamptz and all bucketing happens in the
-- session timezone, which is UTC on Supabase. A "day" here is a UTC day, so
-- late-evening US activity lands on the next day's bucket. Fine for trend
-- reporting; do not use these for anything that has to tie out to a
-- local-calendar statement.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Daily revenue series
-- ---------------------------------------------------------------------------
-- LEFT JOIN against generate_series so days with no fee events come back as
-- zero rather than being missing. A chart fed sparse rows silently draws a
-- straight line between two distant points, which reads as steady income over a
-- period that actually had none — the gap fill is what makes the shape honest.

CREATE OR REPLACE FUNCTION public.admin_revenue_daily(_from DATE, _to DATE)
RETURNS TABLE (
  day         DATE,
  total_cents BIGINT,
  event_count BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    d.day::DATE,
    COALESCE(SUM(pf.amount_cents), 0)::BIGINT,
    COUNT(pf.id)::BIGINT
  FROM generate_series(
         _from::TIMESTAMPTZ,
         _to::TIMESTAMPTZ,
         INTERVAL '1 day'
       ) AS d(day)
  LEFT JOIN public.platform_fees pf
         ON pf.created_at >= d.day
        AND pf.created_at <  d.day + INTERVAL '1 day'
  GROUP BY d.day
  ORDER BY d.day;
$$;

REVOKE ALL ON FUNCTION public.admin_revenue_daily(DATE, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revenue_daily(DATE, DATE) TO service_role;


-- ---------------------------------------------------------------------------
-- 2. Revenue by source, over a range
-- ---------------------------------------------------------------------------
-- The existing admin_revenue_by_source() is lifetime-only. This is the same
-- shape bounded by dates, so the breakdown can agree with the chart above
-- instead of quietly reporting a different period.
--
-- _to is inclusive of the whole day: the upper bound is (_to + 1 day), so a
-- fee recorded at 23:59 on the end date still counts.

CREATE OR REPLACE FUNCTION public.admin_revenue_by_source_range(_from DATE, _to DATE)
RETURNS TABLE (
  source      TEXT,
  total_cents BIGINT,
  event_count BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    pf.source,
    SUM(pf.amount_cents)::BIGINT,
    COUNT(*)::BIGINT
  FROM public.platform_fees pf
  WHERE pf.created_at >= _from::TIMESTAMPTZ
    AND pf.created_at <  (_to::TIMESTAMPTZ + INTERVAL '1 day')
  GROUP BY pf.source
  ORDER BY 2 DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_revenue_by_source_range(DATE, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revenue_by_source_range(DATE, DATE) TO service_role;


-- ---------------------------------------------------------------------------
-- 3. Platform liabilities — the number nothing else reports
-- ---------------------------------------------------------------------------
-- Revenue says what was earned. It says nothing about whether the platform can
-- pay everyone out, and those are different questions on a product that holds
-- player money. This returns the three obligations and the one internal asset:
--
--   player_balance_cents  wallets.balance_cents — spendable player money.
--   escrow_held_cents     stakes locked in live matches. escrow_debit REMOVES
--                         these from balance_cents, so the two never overlap.
--   pending_payout_cents  cash-outs promised but not yet sent. Also disjoint
--                         from balance_cents: createPayoutRequest debits the
--                         wallet at request time and a rejection refunds it.
--                         Summed on net_cents, not amount_cents — the player is
--                         owed the net; the fee half becomes platform revenue
--                         when the payout completes.
--   company_balance_cents collected fees. An ASSET, not an obligation.
--
-- The three obligations are mutually exclusive by construction, so they can be
-- added without double-counting. That is the property worth preserving if
-- anyone edits this: check it again before adding a fourth term.
--
-- Stripe's balance is deliberately NOT here — it lives behind the Stripe API,
-- not the database. The server function stitches the two together.

CREATE OR REPLACE FUNCTION public.admin_platform_liabilities()
RETURNS TABLE (
  player_balance_cents  BIGINT,
  escrow_held_cents     BIGINT,
  pending_payout_cents  BIGINT,
  company_balance_cents BIGINT,
  funded_wallet_count   BIGINT,
  open_escrow_count     BIGINT,
  pending_payout_count  BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    (SELECT COALESCE(SUM(w.balance_cents), 0)::BIGINT FROM public.wallets w),
    (SELECT COALESCE(SUM(e.amount_cents), 0)::BIGINT
       FROM public.escrow_holds e
      WHERE e.status = 'held'::public.escrow_status),
    (SELECT COALESCE(SUM(p.net_cents), 0)::BIGINT
       FROM public.manual_payout_requests p
      WHERE p.status IN ('pending'::public.manual_payout_status, 'processing'::public.manual_payout_status)),
    (SELECT COALESCE(MAX(c.balance_cents), 0)::BIGINT FROM public.company_wallet c),
    (SELECT COUNT(*)::BIGINT FROM public.wallets w WHERE w.balance_cents > 0),
    (SELECT COUNT(*)::BIGINT
       FROM public.escrow_holds e
      WHERE e.status = 'held'::public.escrow_status),
    (SELECT COUNT(*)::BIGINT
       FROM public.manual_payout_requests p
      WHERE p.status IN ('pending'::public.manual_payout_status, 'processing'::public.manual_payout_status));
$$;

REVOKE ALL ON FUNCTION public.admin_platform_liabilities() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_platform_liabilities() TO service_role;


COMMENT ON FUNCTION public.admin_platform_liabilities() IS
  'Module 8. Player obligations vs internal assets. The three obligation columns are mutually exclusive by construction - escrow and pending payouts are both already debited from wallets.balance_cents - so they may be summed without double counting. Re-verify that before adding a term.';
