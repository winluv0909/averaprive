-- AP Security 03 — Secure Server Public Views
-- Requires the server-read code changes to be deployed first.

begin;

alter view public.ap_public_agencies
  set (security_invoker = true);

alter view public.ap_public_platform_reviews
  set (security_invoker = true);

alter view public.ap_platform_review_summary
  set (security_invoker = true);

revoke all privileges on
  public.ap_public_agencies,
  public.ap_public_platform_reviews,
  public.ap_platform_review_summary
from public, anon, authenticated;

grant select on
  public.ap_public_agencies,
  public.ap_public_platform_reviews,
  public.ap_platform_review_summary
to service_role;

-- Abort if browser roles retain SELECT access through any grant.
do $$
declare
  target text;
begin
  foreach target in array array[
    'public.ap_public_agencies',
    'public.ap_public_platform_reviews',
    'public.ap_platform_review_summary'
  ]
  loop
    if has_any_column_privilege('anon', target, 'SELECT')
       or has_any_column_privilege('authenticated', target, 'SELECT') then
      raise exception 'Unexpected browser SELECT access: %', target;
    end if;
  end loop;
end;
$$;

-- Verify that the server role can actually query all three views.
-- Any permission failure prevents this transaction from committing.
set local role service_role;

select
  (select count(*) from public.ap_public_agencies)
    as server_visible_agencies,
  (select count(*) from public.ap_public_platform_reviews)
    as server_visible_platform_reviews,
  (select review_count from public.ap_platform_review_summary)
    as platform_review_count;

reset role;

commit;