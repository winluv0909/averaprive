begin;

create table if not exists public.ap_plans (
  code text primary key check (code in ('free','prive','select','elite')),
  name text not null,
  monthly_price_usd numeric(10,2) not null,
  description text not null,
  entitlements jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  display_order integer not null
);

insert into public.ap_plans(code,name,monthly_price_usd,description,entitlements,display_order) values
('free','Free',0,'A permanent public foundation for every eligible agency.',jsonb_build_object('basic_profile',true,'services',true,'location',true,'links',true,'verification_eligible',true,'basic_stats',true),1),
('prive','Privé',49,'Enhanced presentation, proof of work, inquiries, and professional analytics.',jsonb_build_object('enhanced_profile',true,'unlimited_case_studies',true,'featured_media',true,'contact_cta',true,'lead_notifications',true,'analytics','standard','seo_backlink',true,'custom_sections',true,'priority_support',true),2),
('select','Privé Select',129,'Labelled visibility, acquisition tools, and advanced marketplace measurement.',jsonb_build_object('includes','prive','directory_visibility','paid_labelled','category_country_exposure',true,'homepage_opportunities',true,'lead_tools','advanced','analytics','advanced','monthly_report',true,'featured_case_studies',true),3),
('elite','Privé Elite',299,'Premium labelled distribution, customization, and high-touch commercial support.',jsonb_build_object('includes','select','premium_placements',true,'editorial_opportunity','disclosed','lead_tools','premium','analytics','premium','dedicated_customization',true,'priority_verification_review',true,'priority_support',true,'quarterly_review',true),4)
on conflict(code) do update set name=excluded.name,monthly_price_usd=excluded.monthly_price_usd,description=excluded.description,entitlements=excluded.entitlements,display_order=excluded.display_order;

create table if not exists public.ap_subscriptions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null unique references public.ap_agencies(id) on delete cascade,
  plan_code text not null default 'free' references public.ap_plans(code),
  status text not null default 'free' check (status in ('free','trialing','active','past_due','cancelled','expired')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_started_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  commercial_reference text,
  activated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ap_trial_window check (trial_ends_at is null or trial_started_at is not null)
);

create table if not exists public.ap_plan_change_requests (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.ap_agencies(id) on delete cascade,
  requested_plan text not null references public.ap_plans(code),
  status text not null default 'pending' check (status in ('pending','approved','declined','cancelled')),
  requested_by uuid not null references auth.users(id) on delete restrict,
  decision_note text,
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create unique index if not exists ap_one_pending_plan_request on public.ap_plan_change_requests(agency_id) where status='pending';
alter table public.ap_plans enable row level security;
alter table public.ap_subscriptions enable row level security;
alter table public.ap_plan_change_requests enable row level security;
create policy "plans_public_read" on public.ap_plans for select using (active=true);
create policy "subscriptions_related_read" on public.ap_subscriptions for select to authenticated using (ap_private.has_agency_role(agency_id,array['owner','admin','billing']) or ap_private.is_staff(array['super_admin','finance']));
create policy "plan_requests_related_read" on public.ap_plan_change_requests for select to authenticated using (ap_private.has_agency_role(agency_id,array['owner','admin','billing']) or ap_private.is_staff(array['super_admin','finance']));
revoke all on public.ap_plans,public.ap_subscriptions,public.ap_plan_change_requests from anon,authenticated;
grant select on public.ap_plans to anon,authenticated;
grant select on public.ap_subscriptions,public.ap_plan_change_requests to authenticated;

create or replace function public.ap_start_prive_trial(target_agency uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare subscription_id uuid; existing_trial timestamptz;
begin
  if not ap_private.has_agency_role(target_agency,array['owner','admin','billing']) then raise exception 'Agency billing access required'; end if;
  select trial_started_at into existing_trial from public.ap_subscriptions where agency_id=target_agency;
  if existing_trial is not null then raise exception 'The 7-day Privé trial has already been used'; end if;
  insert into public.ap_subscriptions(agency_id,plan_code,status,trial_started_at,trial_ends_at)
  values(target_agency,'prive','trialing',now(),now()+interval '7 days')
  on conflict(agency_id) do update set plan_code='prive',status='trialing',trial_started_at=now(),trial_ends_at=now()+interval '7 days',updated_at=now()
  returning id into subscription_id;
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata) values(auth.uid(),target_agency,'subscription.trial_started','subscription',subscription_id::text,jsonb_build_object('plan','prive','days',7,'card_required',false));
  return subscription_id;
end; $$;

create or replace function public.ap_request_plan_change(target_agency uuid,target_plan text) returns uuid language plpgsql security definer set search_path='' as $$
declare request_id uuid;
begin
  if not ap_private.has_agency_role(target_agency,array['owner','admin','billing']) then raise exception 'Agency billing access required'; end if;
  if target_plan not in ('prive','select','elite') then raise exception 'Invalid requested plan'; end if;
  insert into public.ap_plan_change_requests(agency_id,requested_plan,requested_by) values(target_agency,target_plan,auth.uid()) returning id into request_id;
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata) values(auth.uid(),target_agency,'subscription.plan_requested','plan_change_request',request_id::text,jsonb_build_object('plan',target_plan));
  return request_id;
end; $$;

create or replace function public.ap_decide_plan_request(request_id uuid,decision text,decision_note text,commercial_ref text) returns void language plpgsql security definer set search_path='' as $$
declare target_agency uuid; target_plan text; subscription_id uuid;
begin
  if not ap_private.is_staff(array['super_admin','finance']) then raise exception 'Subscription operations access required'; end if;
  if decision not in ('approved','declined') or length(trim(coalesce(decision_note,'')))<10 then raise exception 'A valid decision and traceable note are required'; end if;
  update public.ap_plan_change_requests set status=decision,decision_note=trim(decision_note),decided_by=auth.uid(),decided_at=now() where id=request_id and status='pending' returning agency_id,requested_plan into target_agency,target_plan;
  if target_agency is null then raise exception 'Pending request not found'; end if;
  if decision='approved' then
    insert into public.ap_subscriptions(agency_id,plan_code,status,current_period_started_at,current_period_ends_at,commercial_reference,activated_by)
    values(target_agency,target_plan,'active',now(),now()+interval '1 month',nullif(trim(commercial_ref),''),auth.uid())
    on conflict(agency_id) do update set plan_code=target_plan,status='active',current_period_started_at=now(),current_period_ends_at=now()+interval '1 month',commercial_reference=nullif(trim(commercial_ref),''),activated_by=auth.uid(),updated_at=now()
    returning id into subscription_id;
  end if;
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata) values(auth.uid(),target_agency,'subscription.plan_decided','plan_change_request',request_id::text,jsonb_build_object('decision',decision,'plan',target_plan,'note',trim(decision_note),'subscription_id',subscription_id));
end; $$;

revoke all on function public.ap_start_prive_trial(uuid) from public;grant execute on function public.ap_start_prive_trial(uuid) to authenticated;
revoke all on function public.ap_request_plan_change(uuid,text) from public;grant execute on function public.ap_request_plan_change(uuid,text) to authenticated;
revoke all on function public.ap_decide_plan_request(uuid,text,text,text) from public;grant execute on function public.ap_decide_plan_request(uuid,text,text,text) to authenticated;
commit;
