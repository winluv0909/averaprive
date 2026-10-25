-- AP Step 01 - Check Existing Database (READ ONLY)
-- Supabase SQL Editor title: AP Step 01 - Check Existing Database
-- Save at database/step-01-preflight.sql, not inside migrations.
-- Run on the existing Avera Prive project before either new fix.
select
  current_database() as database_name,
  to_regclass('public.ap_agencies') is not null as agencies_table_exists,
  to_regclass('public.ap_subscriptions') is not null as subscriptions_table_exists,
  to_regclass('public.ap_plan_change_requests') is not null as plan_requests_table_exists,
  to_regprocedure('public.ap_start_prive_trial(uuid)') is not null as trial_function_exists,
  to_regprocedure('public.ap_decide_plan_request(uuid,text,text,text)') is not null as plan_decision_function_exists,
  to_regprocedure('ap_private.has_agency_role(uuid,text[])') is not null as agency_role_check_exists,
  to_regprocedure('ap_private.is_staff(text[])') is not null as staff_role_check_exists,
  (select c.relrowsecurity from pg_catalog.pg_class c
    where c.oid = to_regclass('public.ap_agencies')) as agency_rls_enabled,
  (select count(*) = 1 from pg_catalog.pg_policies p
    where p.schemaname = 'public' and p.tablename = 'ap_agencies'
      and p.policyname = 'agencies_update_draft' and p.cmd = 'UPDATE') as draft_update_policy_exists;

-- These counts are a before/after comparison, not a backup.
select
  (select count(*) from public.ap_agencies) as total_agencies,
  (select count(*) from public.ap_agencies where published) as published_agencies,
  (select count(distinct user_id) from public.ap_staff_roles where role = 'super_admin') as platform_owners,
  (select count(*) from public.ap_plans) as plans,
  (select count(*) from public.ap_subscriptions) as subscriptions,
  (select count(*) from public.ap_invoices) as invoices;
