begin;

revoke trigger, references on table
  public.ap_agency_claims,
  public.ap_agency_invitations,
  public.ap_agency_sources,
  public.ap_external_ratings,
  public.ap_moderation_cases,
  public.ap_security_audit,
  public.ap_staff_roles,
  public.ap_support_tickets,
  public.ap_user_profiles
from public, anon, authenticated;

-- Prevent these grants on future postgres-created public tables.
alter default privileges for role postgres in schema public
revoke trigger, references on tables
from public, anon, authenticated;

-- Abort if effective table or column privileges remain.
do $check$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join (
      values ('anon'::text), ('authenticated'::text)
    ) r(role_name)
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and left(c.relname, 3) = 'ap_'
      and (
        has_table_privilege(r.role_name, c.oid, 'TRIGGER')
        or has_table_privilege(r.role_name, c.oid, 'REFERENCES')
        or has_any_column_privilege(
          r.role_name, c.oid, 'REFERENCES'
        )
      )
  ) then
    raise exception 'Client trigger or reference privileges remain';
  end if;
end;
$check$;

commit;