-- Read only. Expected: RLS=true, no direct client access, anonymous execute=false.
select c.relrowsecurity as rls_enabled,
 has_table_privilege('anon','public.ap_crypto_refund_cases','SELECT') as anon_read,
 has_table_privilege('authenticated','public.ap_crypto_refund_cases','SELECT') as client_read,
 has_table_privilege('authenticated','public.ap_crypto_refund_cases','INSERT') as client_insert,
 has_table_privilege('authenticated','public.ap_crypto_refund_cases','UPDATE') as client_update,
 has_function_privilege('anon','public.ap_open_crypto_refund(uuid,text)','EXECUTE') as anon_open,
 has_function_privilege('authenticated','public.ap_open_crypto_refund(uuid,text)','EXECUTE') as authenticated_open
from pg_class c where c.oid='public.ap_crypto_refund_cases'::regclass;
-- Expected: two private functions are definer; two public wrappers are invoker.
select n.nspname as schema,p.proname,p.prosecdef as security_definer,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='ap_private' and p.proname in ('open_crypto_refund','record_crypto_refund'))
 or (n.nspname='public' and p.proname in ('ap_open_crypto_refund','ap_record_crypto_refund'));
select state,count(*) from public.ap_crypto_refund_cases group by state;
