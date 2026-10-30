-- Read only. Run each SELECT separately to see each result table.
-- Do not share raw private records, credentials or request/response bodies.
select now() as observed_at,jobname,schedule,active from cron.job;
select provider,http_status,transport_error,count(*) as requests,max(requested_at) as latest
from avera_monitor_ops.requests where requested_at>now()-interval '1 hour'
group by provider,http_status,transport_error order by provider;
select q.provider,r.status_code,r.timed_out,r.created
from (select distinct on(provider) provider,request_id from avera_monitor_ops.requests order by provider,requested_at desc)q
left join net._http_response r on r.id=q.request_id;
select role,count(*) from public.ap_staff_roles group by role;
select provider,paypal_environment,status,count(*) from public.ap_payment_orders group by provider,paypal_environment,status;
select status,count(*) from public.ap_invoices group by status;
select count(*) total,count(*) filter(where published) published,count(*) filter(where demo_profile) demos from public.ap_agencies;
select c.relname as table_without_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname like 'ap_%' and not c.relrowsecurity;
-- No rows expected in the last result. This is not a complete security audit.
