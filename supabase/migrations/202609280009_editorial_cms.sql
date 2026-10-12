begin;

create table if not exists public.ap_editorial_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 8 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  content_type text not null check (content_type in ('article','visual_editorial','agency_spotlight','prive_report','market_graphic','interview','editorial_case_study')),
  category text not null check (category in ('creator-economy','agencies','business','influence','entertainment','culture','adult-industry','interviews','market-insights')),
  summary text not null check (length(trim(summary)) between 30 and 500),
  body text not null check (length(trim(body)) >= 100),
  tags text[] not null default '{}',
  author_name text not null,
  cover_image_url text,
  cover_image_alt text,
  seo_title text not null,
  seo_description text not null check (length(trim(seo_description)) between 50 and 180),
  canonical_url text,
  status text not null default 'draft' check (status in ('draft','in_review','scheduled','published','archived')),
  commercial_disclosure text,
  publish_at timestamptz,
  published_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ap_editorial_cover_pair check (cover_image_url is null or nullif(trim(cover_image_alt),'') is not null),
  constraint ap_editorial_schedule_time check (status <> 'scheduled' or publish_at is not null)
);

create index if not exists ap_editorial_public_lookup on public.ap_editorial_posts(status,publish_at,published_at desc);
alter table public.ap_editorial_posts enable row level security;
drop policy if exists "editorial_public_read" on public.ap_editorial_posts;
create policy "editorial_public_read" on public.ap_editorial_posts for select
using (status='published' or (status='scheduled' and publish_at<=now()));
drop policy if exists "editorial_staff_read" on public.ap_editorial_posts;
create policy "editorial_staff_read" on public.ap_editorial_posts for select to authenticated
using (ap_private.is_staff(array['super_admin','moderator']));
revoke all on public.ap_editorial_posts from anon, authenticated;
grant select on public.ap_editorial_posts to anon, authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('editorial-media','editorial-media',true,8388608,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "editorial_media_public_read" on storage.objects;
create policy "editorial_media_public_read" on storage.objects for select using (bucket_id='editorial-media');
drop policy if exists "editorial_media_staff_upload" on storage.objects;
create policy "editorial_media_staff_upload" on storage.objects for insert to authenticated
with check (bucket_id='editorial-media' and ap_private.is_staff(array['super_admin','moderator']));

create or replace function public.ap_save_editorial_post(
  post_id uuid, post_title text, post_slug text, post_type text, post_category text,
  post_summary text, post_body text, post_tags text[], post_author text,
  post_cover_url text, post_cover_alt text, post_seo_title text, post_seo_description text,
  post_canonical text, post_status text, post_disclosure text, post_publish_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved_id uuid; previous_status text;
begin
  if not ap_private.is_staff(array['super_admin','moderator']) then raise exception 'Editorial access required'; end if;
  if post_status not in ('draft','in_review','scheduled','published','archived') then raise exception 'Invalid editorial status'; end if;
  if post_status='scheduled' and post_publish_at is null then raise exception 'Scheduled content requires a publish time'; end if;
  if post_id is null then
    insert into public.ap_editorial_posts(title,slug,content_type,category,summary,body,tags,author_name,cover_image_url,cover_image_alt,seo_title,seo_description,canonical_url,status,commercial_disclosure,publish_at,published_at,created_by,updated_by)
    values(trim(post_title),trim(post_slug),post_type,post_category,trim(post_summary),trim(post_body),coalesce(post_tags,'{}'),trim(post_author),nullif(trim(post_cover_url),''),nullif(trim(post_cover_alt),''),trim(post_seo_title),trim(post_seo_description),nullif(trim(post_canonical),''),post_status,nullif(trim(post_disclosure),''),post_publish_at,case when post_status='published' then now() else null end,auth.uid(),auth.uid()) returning id into saved_id;
  else
    select status into previous_status from public.ap_editorial_posts where id=post_id;
    update public.ap_editorial_posts set title=trim(post_title),slug=trim(post_slug),content_type=post_type,category=post_category,summary=trim(post_summary),body=trim(post_body),tags=coalesce(post_tags,'{}'),author_name=trim(post_author),cover_image_url=nullif(trim(post_cover_url),''),cover_image_alt=nullif(trim(post_cover_alt),''),seo_title=trim(post_seo_title),seo_description=trim(post_seo_description),canonical_url=nullif(trim(post_canonical),''),status=post_status,commercial_disclosure=nullif(trim(post_disclosure),''),publish_at=post_publish_at,published_at=case when post_status='published' and previous_status<>'published' then now() else published_at end,updated_by=auth.uid(),updated_at=now() where id=post_id returning id into saved_id;
  end if;
  if saved_id is null then raise exception 'Editorial post not found'; end if;
  insert into public.ap_security_audit(actor_user_id,action,target_type,target_id,metadata)
  values(auth.uid(),'editorial.saved','editorial_post',saved_id::text,jsonb_build_object('status',post_status,'slug',post_slug,'content_type',post_type));
  return saved_id;
end; $$;

revoke all on function public.ap_save_editorial_post(uuid,text,text,text,text,text,text,text[],text,text,text,text,text,text,text,text,text,timestamptz) from public;
grant execute on function public.ap_save_editorial_post(uuid,text,text,text,text,text,text,text[],text,text,text,text,text,text,text,text,text,timestamptz) to authenticated;

commit;
