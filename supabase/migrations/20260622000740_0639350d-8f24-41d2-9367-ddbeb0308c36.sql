
REVOKE EXECUTE ON FUNCTION public.company_wallet_withdraw(bigint, text, text, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.escrow_debit(uuid, bigint, uuid, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.escrow_resolve(uuid, escrow_status) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_platform_fee(text, bigint, uuid, uuid, bigint, bigint, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_credit(uuid, bigint, wallet_tx_type, text, uuid, uuid, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_wallet(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM authenticated;
