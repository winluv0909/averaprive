-- READ ONLY. No deletion or account changes. Counts are not a cleanup instruction.
select 'all_agencies' as metric,count(*) as total from public.ap_agencies
union all select 'published_agencies',count(*) from public.ap_agencies where published
union all select 'explicit_demo_agencies',count(*) from public.ap_agencies where demo_profile
union all select 'owner_role_assignments',count(*) from public.ap_staff_roles where role='super_admin'
union all select 'refund_cases',count(*) from public.ap_crypto_refund_cases
union all select 'pending_payment_emails',count(*) from public.ap_payment_notifications where status<>'sent';
select provider,paypal_environment,status,count(*) as total from public.ap_payment_orders group by provider,paypal_environment,status;
select status,count(*) as total from public.ap_invoices group by status;
-- A sandbox record may be kept for audit. Never delete paid evidence merely because it is a test.
select version from supabase_migrations.schema_migrations order by version;
-- Do not print cron command strings, monitor configuration or vault values: they may contain secrets.
select jobname,schedule,active from cron.job where jobname ilike '%avera%';
