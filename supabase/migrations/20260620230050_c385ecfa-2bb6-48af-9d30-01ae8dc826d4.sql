
REVOKE ALL ON FUNCTION public.record_platform_fee(text, bigint, uuid, uuid, bigint, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_wallet_withdraw(bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_platform_fee(text, bigint, uuid, uuid, bigint, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.company_wallet_withdraw(bigint, text, text) TO service_role;
