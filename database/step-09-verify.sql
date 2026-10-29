-- Read only. Run each SELECT separately to inspect all result tables.
-- Optional telemetry false/null must return without inserts: behavior is tested in isolated tests.
select proname,prosecdef as security_definer,proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as signed_in_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and proname in ('ap_record_marketplace_event','ap_resolve_crypto_payment_exception','ap_assign_shared_crypto_deposit','ap_submit_crypto_transaction_hash');
-- Event RPC is intentionally public (anon/signed_in=true). All retired payment RPCs: false/false.
select c.relname,c.relrowsecurity as rls_enabled,
 has_table_privilege('anon',c.oid,'SELECT') as anon_read,
 has_table_privilege('authenticated',c.oid,'SELECT') as client_read,
 has_table_privilege('authenticated',c.oid,'INSERT') as client_insert,
 has_table_privilege('authenticated',c.oid,'UPDATE') as client_update
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('ap_crypto_refund_cases','ap_payment_exceptions','ap_crypto_tx_claims','ap_payment_notifications','ap_crypto_observations','ap_shared_crypto_deposits','ap_registration_email_checks','ap_agency_registration_numbers');
-- Expected for these private tables: RLS=true, every client permission=false.
select c.relname as table_without_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname like 'ap_%' and not c.relrowsecurity;
-- Expected: no rows. This is only one part of a Security Advisor review.
