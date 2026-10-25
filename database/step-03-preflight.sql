-- SQL Editor title: AP Check 04 - Before Registration Safeguard
-- READ ONLY. Save at database/step-03-preflight.sql, not in migrations.
select 'agency_total' as item,count(*)::bigint as value from public.ap_agencies
union all select 'published_agencies',count(*) from public.ap_agencies where published and status='approved' and publication_status='published' and not demo_profile
union all select 'owners',count(*) from public.ap_staff_roles where role='super_admin'
union all select 'plans',count(*) from public.ap_plans
union all select 'subscriptions',count(*) from public.ap_subscriptions
union all select 'invoices',count(*) from public.ap_invoices
union all select 'bound_registration_numbers',count(*) from public.ap_agency_registration_numbers where bound_at is not null
union all select 'drafts_or_changes_requested',count(*) from public.ap_agencies where publication_status in ('draft','changes_requested');
