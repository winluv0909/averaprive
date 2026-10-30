-- Read-only installation checks. All five results should be true.
select
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.ap_agency_registration_numbers'::regclass,
    'public.ap_registration_number_deliveries'::regclass
  )) as rls_enabled,
  not has_table_privilege('anon','public.ap_agency_registration_numbers','SELECT') as public_read_blocked,
  not has_table_privilege('authenticated','public.ap_agency_registration_numbers','INSERT') as client_assignment_blocked,
  not has_function_privilege('authenticated','public.ap_bind_registration_number(uuid,text,uuid,uuid,text)','EXECUTE') as client_binding_blocked,
  has_function_privilege('service_role','public.ap_prepare_registration_number(uuid,uuid,text,text,text,text)','EXECUTE') as server_issuing_enabled;
