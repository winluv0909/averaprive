-- AP Fix 02 - Restrict Agency Profile Updates to Editable Columns
-- Save in supabase/migrations/. Run once after AP Fix 01.
-- Keeps row-level security and SELECT access. Changes permissions, not agency data.
begin;

revoke update on public.ap_agencies from public,anon,authenticated;

-- Table-level REVOKE does not remove older column grants. Clear those as well.
do $$
declare column_list text;
begin
  select string_agg(pg_catalog.quote_ident(a.attname), ', ' order by a.attnum)
    into column_list from pg_catalog.pg_attribute a
    where a.attrelid = 'public.ap_agencies'::regclass and a.attnum > 0 and not a.attisdropped;
  execute 'revoke update (' || column_list || ') on public.ap_agencies from public,anon,authenticated';
end;
$$;

grant update (
  name,tagline,positioning_statement,about,country,city,website_url,logo_url,cover_image_url,
  services,creator_niches,regions_served,social_links,category,founded_year,
  employee_count_range,languages,ideal_client,minimum_requirements,accepting_inquiries,updated_at
) on public.ap_agencies to authenticated;

-- Trusted moderation/claim RPCs retain their existing authorization checks.
-- The service role remains server-only; do not put it in a browser environment.
grant update on public.ap_agencies to service_role;

-- Fail the whole transaction if an inherited grant still exposes an internal column.
do $$
declare
  item record;
  allowed constant text[] := array[
    'name','tagline','positioning_statement','about','country','city','website_url','logo_url','cover_image_url',
    'services','creator_niches','regions_served','social_links','category','founded_year',
    'employee_count_range','languages','ideal_client','minimum_requirements','accepting_inquiries','updated_at'
  ];
begin
  if not exists (select 1 from pg_catalog.pg_class c
    where c.oid = 'public.ap_agencies'::regclass and c.relrowsecurity) then
    raise exception 'Agency RLS must remain enabled';
  end if;
  for item in select a.attname from pg_catalog.pg_attribute a
    where a.attrelid = 'public.ap_agencies'::regclass and a.attnum > 0 and not a.attisdropped
  loop
    if pg_catalog.has_column_privilege('anon','public.ap_agencies',item.attname,'UPDATE')
      or pg_catalog.has_column_privilege('authenticated','public.ap_agencies',item.attname,'UPDATE')
         is distinct from (item.attname = any(allowed)) then
      raise exception 'Unexpected agency column UPDATE access: %', item.attname;
    end if;
  end loop;
end;
$$;

commit;
