-- Remove client access to an operation that bypasses RLS.
begin;

revoke truncate on table
  public.ap_staff_roles,
  public.ap_agency_memberships,
  public.ap_agency_invitations
from public, anon, authenticated;

-- Abort if either client role retains inherited access.
do $check$
declare
  target regclass;
begin
  foreach target in array array[
    'public.ap_staff_roles'::regclass,
    'public.ap_agency_memberships'::regclass,
    'public.ap_agency_invitations'::regclass
  ]
  loop
    if has_table_privilege('anon', target, 'TRUNCATE')
       or has_table_privilege('authenticated', target, 'TRUNCATE') then
      raise exception 'Client TRUNCATE access remains on %', target;
    end if;
  end loop;
end;
$check$;

commit;