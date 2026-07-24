-- Admin revenue reporting: daily/weekly/monthly/yearly/lifetime totals,
-- revenue by source, and platform-wide deposit/withdrawal totals.
-- Only granted to service_role: called via supabaseAdmin from admin-gated
-- server functions (see src/lib/admin.functions.ts), same pattern as the
-- existing company_wallet / platform_fees access in this project.

CREATE OR REPLACE FUNCTION public.admin_revenue_summary()
RETURNS TABLE (
  today_cents bigint,
  week_cents bigint,
  month_cents bigint,
  year_cents bigint,
  lifetime_cents bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(amount_cents) FILTER (WHERE created_at >= date_trunc('day', now())), 0)::bigint,
    COALESCE(SUM(amount_cents) FILTER (WHERE created_at >= date_trunc('week', now())), 0)::bigint,
    COALESCE(SUM(amount_cents) FILTER (WHERE created_at >= date_trunc('month', now())), 0)::bigint,
    COALESCE(SUM(amount_cents) FILTER (WHERE created_at >= date_trunc('year', now())), 0)::bigint,
    COALESCE(SUM(amount_cents), 0)::bigint
  FROM public.platform_fees;
$$;

REVOKE ALL ON FUNCTION public.admin_revenue_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revenue_summary() TO service_role;

CREATE OR REPLACE FUNCTION public.admin_revenue_by_source()
RETURNS TABLE (
  source text,
  total_cents bigint,
  event_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT source, SUM(amount_cents)::bigint AS total_cents, COUNT(*)::bigint AS event_count
  FROM public.platform_fees
  GROUP BY source
  ORDER BY total_cents DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_revenue_by_source() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revenue_by_source() TO service_role;

CREATE OR REPLACE FUNCTION public.admin_wallet_totals()
RETURNS TABLE (
  total_deposits_cents bigint,
  deposit_count bigint,
  total_withdrawals_cents bigint,
  withdrawal_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(amount_cents) FILTER (WHERE type = 'deposit' AND status = 'completed'), 0)::bigint,
    COUNT(*) FILTER (WHERE type = 'deposit' AND status = 'completed')::bigint,
    COALESCE(SUM(ABS(amount_cents)) FILTER (WHERE type = 'withdrawal' AND status = 'completed'), 0)::bigint,
    COUNT(*) FILTER (WHERE type = 'withdrawal' AND status = 'completed')::bigint
  FROM public.wallet_transactions;
$$;

REVOKE ALL ON FUNCTION public.admin_wallet_totals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_wallet_totals() TO service_role;
