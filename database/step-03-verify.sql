-- SQL Editor title: AP Check 05 - Verify Registration Safeguard
-- READ ONLY. Save at database/step-03-verify.sql, not in migrations.
-- All passed values in the first result should be true.
with installed as (
 select p.prosrc,p.proconfig from pg_catalog.pg_proc p
 where p.oid='public.ap_submit_agency_for_review(uuid)'::regprocedure
)
select 'registration_number_gate_present' as check_name,
  prosrc like '%public.ap_agency_registration_numbers%'
  and prosrc like '%r.bound_at is not null%'
  and prosrc like '%r.verified_at is not null%'
  and prosrc like '%r.delivery_status=''sent''%'
  and prosrc like '%m.user_id=r.owner_user_id%' as passed from installed
union all select 'reviewed_claim_route_preserved',
  prosrc like '%public.ap_agency_claims%'
  and prosrc like '%c.status=''approved''%'
  and prosrc like '%c.reviewed_snapshot is not null%' from installed
union all select 'authenticated_submission_available',
  has_function_privilege('authenticated','public.ap_submit_agency_for_review(uuid)','EXECUTE')
union all select 'anonymous_submission_blocked',
  not has_function_privilege('anon','public.ap_submit_agency_for_review(uuid)','EXECUTE')
union all select 'client_number_forgery_blocked',
  not has_table_privilege('authenticated','public.ap_agency_registration_numbers','INSERT,UPDATE')
union all select 'client_claim_forgery_blocked',
  not has_table_privilege('authenticated','public.ap_agency_claims','INSERT,UPDATE')
union all select 'client_publication_status_update_blocked',
  not has_column_privilege('authenticated','public.ap_agencies','publication_status','UPDATE')
union all select 'registration_number_rls_enabled',
  relrowsecurity from pg_catalog.pg_class where oid='public.ap_agency_registration_numbers'::regclass;

-- Compare these counts with AP Check 04; this migration does not alter records.
select 'agency_total' as item,count(*)::bigint as value from public.ap_agencies
union all select 'published_agencies',count(*) from public.ap_agencies where published and status='approved' and publication_status='published' and not demo_profile
union all select 'owners',count(*) from public.ap_staff_roles where role='super_admin'
union all select 'plans',count(*) from public.ap_plans
union all select 'subscriptions',count(*) from public.ap_subscriptions
union all select 'invoices',count(*) from public.ap_invoices
union all select 'bound_registration_numbers',count(*) from public.ap_agency_registration_numbers where bound_at is not null
union all select 'drafts_or_changes_requested',count(*) from public.ap_agencies where publication_status in ('draft','changes_requested');
