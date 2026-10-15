-- Remove remaining client TRUNCATE privileges.
begin;

revoke truncate on table
  public.ap_agency_claims,
  public.ap_agency_sources,
  public.ap_external_ratings,
  public.ap_moderation_cases,
  public.ap_security_audit,
  public.ap_support_tickets,
  public.ap_user_profiles
from public, anon, authenticated;

-- Verify all application tables, including previously fixed tables.
do $check$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and left(c.relname, 3) = 'ap_'
      and (
        has_table_privilege('anon', c.oid, 'TRUNCATE')
        or has_table_privilege('authenticated', c.oid, 'TRUNCATE')
      )
  ) then
    raise exception 'Client TRUNCATE access remains on an application table';
  end if;
end;
$check$;

commit;