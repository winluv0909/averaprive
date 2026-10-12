begin;

-- Platform feedback is separate from reviews of individual agencies.
create table public.ap_platform_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  audience text not null check (audience in ('viewer','business')),
  rating integer not null check (rating between 1 and 5),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 20 and 3000),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  revision integer not null default 1,
  moderation_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index ap_platform_reviews_public_order
  on public.ap_platform_reviews(published_at desc, id)
  where status='approved';

alter table public.ap_platform_reviews enable row level security;

create policy platform_reviews_private_read
  on public.ap_platform_reviews
  for select to authenticated
  using (
    user_id=auth.uid()
    or ap_private.is_staff(array['super_admin'])
  );

revoke all on public.ap_platform_reviews
  from public, anon, authenticated;
grant select on public.ap_platform_reviews to authenticated;

-- Expose approved content without account IDs or moderation notes.
create view public.ap_public_platform_reviews as
  select id,display_name,audience,rating,title,body,published_at
  from public.ap_platform_reviews
  where status='approved';

create view public.ap_platform_review_summary as
  select
    count(*)::integer as review_count,
    round(avg(rating),1) as average_rating
  from public.ap_platform_reviews
  where status='approved';

revoke all on
  public.ap_public_platform_reviews,
  public.ap_platform_review_summary
  from public,anon,authenticated;

grant select on
  public.ap_public_platform_reviews,
  public.ap_platform_review_summary
  to anon,authenticated;

create function public.ap_submit_platform_review(
  public_name text,
  reviewer_audience text,
  review_rating integer,
  review_title text,
  review_body text,
  truthful boolean,
  expected_revision integer
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  existing public.ap_platform_reviews;
  result uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in before writing a review';
  end if;

  if not exists(
    select 1 from auth.users
    where id=auth.uid()
      and email_confirmed_at is not null
  ) then
    raise exception 'Confirm your email address before writing a review';
  end if;

  if ap_private.is_staff(null) then
    raise exception 'Platform staff cannot review their own platform';
  end if;

  if truthful is distinct from true then
    raise exception 'Confirm this reflects your own experience';
  end if;

  public_name:=btrim(public_name);
  review_title:=btrim(review_title);
  review_body:=btrim(review_body);

  if public_name is null
    or char_length(public_name) not between 2 and 60
    or reviewer_audience is null
    or reviewer_audience not in ('viewer','business')
    or review_rating is null
    or review_rating not between 1 and 5
    or review_title is null
    or char_length(review_title) not between 3 and 120
    or review_body is null
    or char_length(review_body) not between 20 and 3000
  then
    raise exception 'Complete the rating, display name, title and review within the displayed limits';
  end if;

  -- Serialize writes: one review per account.
  perform pg_advisory_xact_lock(
    hashtextextended(auth.uid()::text,20)
  );

  select * into existing
  from public.ap_platform_reviews
  where user_id=auth.uid()
  for update;

  if expected_revision is distinct from coalesce(existing.revision,0) then
    raise exception 'Your review changed. Reload the page before editing';
  end if;

  if existing.id is not null
    and existing.updated_at > now()-interval '30 seconds'
  then
    raise exception 'Please wait 30 seconds before updating your review';
  end if;

  insert into public.ap_platform_reviews(
    user_id,display_name,audience,rating,title,body
  )
  values(
    auth.uid(),public_name,reviewer_audience,
    review_rating,review_title,review_body
  )
  on conflict(user_id) do update set
    display_name=excluded.display_name,
    audience=excluded.audience,
    rating=excluded.rating,
    title=excluded.title,
    body=excluded.body,
    status='pending',
    revision=ap_platform_reviews.revision+1,
    moderation_note=null,
    reviewed_by=null,
    reviewed_at=null,
    published_at=null,
    updated_at=now()
  returning id into result;

  insert into public.ap_security_audit(
    actor_user_id,action,target_type,target_id
  )
  values(
    auth.uid(),'platform_review.submitted',
    'platform_review',result::text
  );

  return result;
end;
$$;

create function public.ap_moderate_platform_review(
  target_review uuid,
  decision text,
  explanation text,
  expected_revision integer
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  item public.ap_platform_reviews;
begin
  if not ap_private.is_staff(array['super_admin']) then
    raise exception 'Owner access required';
  end if;

  if decision is null
    or decision not in ('approved','rejected')
    or explanation is null
    or char_length(btrim(explanation)) not between 10 and 1000
  then
    raise exception 'Choose a decision and provide an explanation of 10–1000 characters';
  end if;

  select * into item
  from public.ap_platform_reviews
  where id=target_review
  for update;

  if item.id is null then
    raise exception 'Review not found';
  end if;

  if item.user_id=auth.uid() then
    raise exception 'You cannot moderate your own review';
  end if;

  if item.revision is distinct from expected_revision then
    raise exception 'Review changed. Reload before making a decision';
  end if;

  update public.ap_platform_reviews set
    status=decision,
    moderation_note=btrim(explanation),
    reviewed_by=auth.uid(),
    reviewed_at=now(),
    revision=revision+1,
    published_at=case
      when decision='approved' then coalesce(published_at,now())
      else null
    end
  where id=target_review;

  insert into public.ap_security_audit(
    actor_user_id,action,target_type,target_id,metadata
  )
  values(
    auth.uid(),'platform_review.'||decision,
    'platform_review',target_review::text,
    jsonb_build_object(
      'explanation',btrim(explanation),
      'revision',expected_revision
    )
  );
end;
$$;

revoke all on function
  public.ap_submit_platform_review(
    text,text,integer,text,text,boolean,integer
  )
  from public,anon,authenticated;

revoke all on function
  public.ap_moderate_platform_review(uuid,text,text,integer)
  from public,anon,authenticated;

grant execute on function
  public.ap_submit_platform_review(
    text,text,integer,text,text,boolean,integer
  )
  to authenticated;

grant execute on function
  public.ap_moderate_platform_review(uuid,text,text,integer)
  to authenticated;

commit;