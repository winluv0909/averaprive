-- AP Check 03 - Verify Subscription and Agency Permission Fixes (READ ONLY)
-- Supabase SQL Editor title: AP Check 03 - Verify Subscription and Profile Fixes
-- Save at database/step-01-verify.sql, not inside migrations.
-- Run after AP Fix 01 and AP Fix 02. Every check below should return true.
with columns_to_check as (
  select a.attname from pg_catalog.pg_attribute a
  where a.attrelid = 'public.ap_agencies'::regclass and a.attnum > 0 and not a.attisdropped
), allowed as (
  select unnest(array[
    'name','tagline','positioning_statement','about','country','city','website_url','logo_url','cover_image_url',
    'services','creator_niches','regions_served','social_links','category','founded_year',
    'employee_count_range','languages','ideal_client','minimum_requirements','accepting_inquiries','updated_at'
  ]) as name
)
select
  pg_catalog.strpos(pg_catalog.pg_get_functiondef('public.ap_start_prive_trial(uuid)'::regprocedure),
    'The trial is available only before a paid subscription') > 0 as paid_trial_guard_installed,
  pg_catalog.strpos(pg_catalog.pg_get_functiondef('public.ap_decide_plan_request(uuid,text,text,text)'::regprocedure),
    'p_note alias for $3') > 0 as decision_argument_fix_installed,
  not pg_catalog.has_table_privilege('authenticated','public.ap_agencies','UPDATE') as broad_profile_updates_removed,
  not exists (select 1 from columns_to_check c where
    pg_catalog.has_column_privilege('authenticated','public.ap_agencies',c.attname,'UPDATE')
      is distinct from exists(select 1 from allowed where name = c.attname)
  ) as profile_column_permissions_correct,
  not pg_catalog.has_any_column_privilege('anon','public.ap_agencies','UPDATE') as anonymous_updates_blocked,
  (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.ap_agencies'::regclass) as agency_rls_enabled,
  pg_catalog.has_table_privilege('authenticated','public.ap_agencies','SELECT') as agency_reads_preserved,
  pg_catalog.has_table_privilege('service_role','public.ap_agencies','UPDATE') as server_updates_preserved,
  not pg_catalog.has_function_privilege('anon','public.ap_start_prive_trial(uuid)','EXECUTE')
    and not pg_catalog.has_function_privilege('anon','public.ap_decide_plan_request(uuid,text,text,text)','EXECUTE')
      as anonymous_subscription_calls_blocked;

-- With no unrelated activity, these counts should match AP Step 01.
select
  (select count(*) from public.ap_agencies) as total_agencies,
  (select count(*) from public.ap_agencies where published) as published_agencies,
  (select count(distinct user_id) from public.ap_staff_roles where role = 'super_admin') as platform_owners,
  (select count(*) from public.ap_plans) as plans,
  (select count(*) from public.ap_subscriptions) as subscriptions,
  (select count(*) from public.ap_invoices) as invoices;
