
REVOKE EXECUTE ON FUNCTION public.escrow_debit(uuid,bigint,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_credit(uuid,bigint,wallet_tx_type,text,uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.escrow_resolve(uuid,escrow_status) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_wallet(uuid) FROM PUBLIC, anon, authenticated;
