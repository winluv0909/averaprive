begin;

-- Delete only explicitly labelled fictional/demo records, including their dependent demo data.
delete from public.ap_agencies where demo_profile = true;

create table public.ap_agency_claims (
 id uuid primary key default gen_random_uuid(),
 agency_id uuid not null references public.ap_agencies(id) on delete cascade,
 claimant_user_id uuid not null references auth.users(id) on delete cascade,
 evidence text not null check(length(trim(evidence)) between 40 and 5000),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewer_note text,
 reviewed_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), reviewed_at timestamptz
);
create unique index ap_one_pending_claim_per_user on public.ap_agency_claims(agency_id,claimant_user_id) where status='pending';
alter table public.ap_agency_claims enable row level security;
create policy claims_read on public.ap_agency_claims for select to authenticated
 using (claimant_user_id=auth.uid() or ap_private.is_staff(array['super_admin']));
grant select on public.ap_agency_claims to authenticated;
revoke insert,update,delete on public.ap_agency_claims from anon,authenticated;

create function public.ap_request_agency_claim(target_agency uuid, ownership_evidence text)
returns uuid language plpgsql security definer set search_path='' as $$
declare claim_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to claim a profile'; end if;
 if ap_private.is_staff(null) then raise exception 'Use a separate agency account to claim a profile'; end if;
 perform 1 from public.ap_agencies where id=target_agency and published and status='approved' and publication_status='published' and not demo_profile for update;
 if not found then raise exception 'Published agency not found'; end if;
 if exists(select 1 from public.ap_agency_memberships where agency_id=target_agency and role='owner' and status='active') then raise exception 'This profile already has an owner'; end if;
 if length(trim(coalesce(ownership_evidence,''))) not between 40 and 5000 then raise exception 'Provide 40 to 5000 characters of ownership evidence'; end if;
 insert into public.ap_agency_claims(agency_id,claimant_user_id,evidence) values(target_agency,auth.uid(),trim(ownership_evidence)) returning id into claim_id;
 return claim_id;
end; $$;

create function public.ap_review_agency_claim(target_claim uuid, decision text, review_note text)
returns void language plpgsql security definer set search_path='' as $$
declare claim public.ap_agency_claims; target_id uuid;
begin
 if not ap_private.is_staff(array['super_admin']) then raise exception 'Owner reviewer access required'; end if;
 if coalesce(decision,'') not in ('approved','rejected') or length(trim(coalesce(review_note,'')))<10 then raise exception 'Decision and review explanation required'; end if;
 select agency_id into target_id from public.ap_agency_claims where id=target_claim;
 perform 1 from public.ap_agencies where id=target_id for update;
 select * into claim from public.ap_agency_claims where id=target_claim for update;
 if not found or claim.status<>'pending' then raise exception 'Pending claim not found'; end if;
 if decision='approved' then
  if exists(select 1 from public.ap_agency_memberships where agency_id=claim.agency_id and role='owner' and status='active') then raise exception 'This agency already has an owner'; end if;
  if exists(select 1 from public.ap_staff_roles where user_id=claim.claimant_user_id) then raise exception 'Staff accounts cannot own agency profiles'; end if;
  insert into public.ap_agency_memberships(agency_id,user_id,role,status) values(claim.agency_id,claim.claimant_user_id,'owner','active')
  on conflict(agency_id,user_id) do update set role='owner',status='active',updated_at=now();
 end if;
 update public.ap_agency_claims set status=decision,reviewer_note=trim(review_note),reviewed_by=auth.uid(),reviewed_at=now() where id=target_claim;
 insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id) values(auth.uid(),claim.agency_id,'claim.'||decision,'agency_claim',target_claim::text);
end; $$;

create function public.ap_add_curated_agency(agency_name text, agency_slug text, official_website text, agency_country text, agency_about text)
returns uuid language plpgsql security definer set search_path='' as $$
declare agency_id uuid;
begin
 if not ap_private.is_staff(array['super_admin']) then raise exception 'Owner access required'; end if;
 if coalesce(official_website,'') !~ '^https://[^ /]+' or length(trim(coalesce(agency_about,'')))<40 then raise exception 'Official HTTPS website and agency description required'; end if;
 insert into public.ap_agencies(name,slug,website_url,country,about,status,published,publication_status,approved_at,published_at,demo_profile,accepting_inquiries)
 values(trim(agency_name),agency_slug,official_website,trim(agency_country),trim(agency_about),'approved',true,'published',now(),now(),false,false) returning id into agency_id;
 insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id) values(auth.uid(),agency_id,'agency.curated_added','agency',agency_id::text);
 return agency_id;
end; $$;
revoke all on function public.ap_request_agency_claim(uuid,text),public.ap_review_agency_claim(uuid,text,text),public.ap_add_curated_agency(text,text,text,text,text) from public,anon;
grant execute on function public.ap_request_agency_claim(uuid,text),public.ap_review_agency_claim(uuid,text,text),public.ap_add_curated_agency(text,text,text,text,text) to authenticated;
commit;
