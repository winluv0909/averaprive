begin;

create table if not exists public.ap_fraud_investigations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.ap_agencies(id) on delete cascade,
  subject_user_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('review','agency','verification','report','account')),
  target_id text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','investigating','cleared','confirmed','closed')),
  signal_type text not null,
  summary text not null check (length(trim(summary)) >= 10),
  signals jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  resolution text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ap_fraud_resolution_required check (
    status not in ('cleared','confirmed','closed') or
    (resolved_by is not null and resolved_at is not null and nullif(trim(resolution),'') is not null)
  )
);

create unique index if not exists ap_one_open_fraud_signal
  on public.ap_fraud_investigations(target_type,target_id,signal_type)
  where status in ('open','investigating');
create index if not exists ap_fraud_queue_order on public.ap_fraud_investigations(status,severity,created_at);

alter table public.ap_fraud_investigations enable row level security;
drop policy if exists "fraud_investigations_staff_only" on public.ap_fraud_investigations;
create policy "fraud_investigations_staff_only" on public.ap_fraud_investigations for select to authenticated
using (ap_private.is_staff(array['super_admin','moderator','verification_reviewer']));
revoke all on public.ap_fraud_investigations from anon, authenticated;
grant select on public.ap_fraud_investigations to authenticated;

create or replace function public.ap_create_fraud_investigation(
  target_agency uuid, investigated_user uuid, investigated_type text, investigated_id text,
  risk_severity text, risk_signal text, risk_summary text, risk_signals jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare investigation_id uuid;
begin
  if not ap_private.is_staff(array['super_admin','moderator','verification_reviewer']) then raise exception 'Trust reviewer access required'; end if;
  insert into public.ap_fraud_investigations(agency_id,subject_user_id,target_type,target_id,severity,signal_type,summary,signals,created_by)
  values(target_agency,investigated_user,investigated_type,investigated_id,risk_severity,risk_signal,trim(risk_summary),coalesce(risk_signals,'{}'::jsonb),auth.uid())
  on conflict (target_type,target_id,signal_type) where status in ('open','investigating') do update set updated_at=now()
  returning id into investigation_id;
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
  values(auth.uid(),target_agency,'fraud.investigation_opened','fraud',investigation_id::text,jsonb_build_object('severity',risk_severity,'signal',risk_signal,'source_target',investigated_id));
  return investigation_id;
end; $$;

create or replace function public.ap_resolve_fraud_investigation(
  investigation_id uuid, decision text, decision_reason text
) returns void language plpgsql security definer set search_path = '' as $$
declare target_agency uuid; source_type text; source_id text;
begin
  if not ap_private.is_staff(array['super_admin','moderator','verification_reviewer']) then raise exception 'Trust reviewer access required'; end if;
  if decision not in ('investigating','cleared','confirmed','closed') then raise exception 'Invalid investigation decision'; end if;
  if length(trim(coalesce(decision_reason,''))) < 20 then raise exception 'A meaningful evidence-based reason is required'; end if;
  update public.ap_fraud_investigations set status=decision,assigned_to=auth.uid(),resolution=trim(decision_reason),
    resolved_by=case when decision in ('cleared','confirmed','closed') then auth.uid() else null end,
    resolved_at=case when decision in ('cleared','confirmed','closed') then now() else null end,updated_at=now()
  where id=investigation_id and status in ('open','investigating') returning agency_id,target_type,target_id into target_agency,source_type,source_id;
  if source_id is null then raise exception 'Open investigation not found'; end if;
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
  values(auth.uid(),target_agency,'fraud.investigation_decision','fraud',investigation_id::text,jsonb_build_object('decision',decision,'source_type',source_type,'source_id',source_id));
end; $$;

create or replace function public.ap_detect_review_risk() returns trigger language plpgsql security definer set search_path = '' as $$
declare recent_count integer; duplicate_review uuid;
begin
  select count(*) into recent_count from public.ap_reviews
  where reviewer_id=new.reviewer_id and created_at >= now()-interval '24 hours';
  if recent_count >= 3 then
    insert into public.ap_fraud_investigations(agency_id,subject_user_id,target_type,target_id,severity,signal_type,summary,signals)
    values(new.agency_id,new.reviewer_id,'review',new.id::text,'medium','submission_velocity','Reviewer submitted three or more reviews within 24 hours.',jsonb_build_object('reviews_in_24h',recent_count))
    on conflict (target_type,target_id,signal_type) where status in ('open','investigating') do nothing;
  end if;
  select id into duplicate_review from public.ap_reviews
  where id<>new.id and lower(regexp_replace(trim(body),'\s+',' ','g'))=lower(regexp_replace(trim(new.body),'\s+',' ','g'))
    and created_at>=now()-interval '90 days' limit 1;
  if duplicate_review is not null then
    insert into public.ap_fraud_investigations(agency_id,subject_user_id,target_type,target_id,severity,signal_type,summary,signals)
    values(new.agency_id,new.reviewer_id,'review',new.id::text,'high','duplicate_content','Review text matches another submission from the last 90 days.',jsonb_build_object('matching_review_id',duplicate_review))
    on conflict (target_type,target_id,signal_type) where status in ('open','investigating') do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists ap_review_risk_detection on public.ap_reviews;
create trigger ap_review_risk_detection after insert on public.ap_reviews for each row execute function public.ap_detect_review_risk();

revoke all on function public.ap_create_fraud_investigation(uuid,uuid,text,text,text,text,text,jsonb) from public;
revoke all on function public.ap_resolve_fraud_investigation(uuid,text,text) from public;
grant execute on function public.ap_create_fraud_investigation(uuid,uuid,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.ap_resolve_fraud_investigation(uuid,text,text) to authenticated;

commit;
