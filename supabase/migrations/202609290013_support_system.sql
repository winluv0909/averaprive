begin;

create sequence if not exists public.ap_support_ticket_number_seq start 1000;
create table if not exists public.ap_support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default ('AP-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.ap_support_ticket_number_seq')::text,6,'0')),
  user_id uuid not null references auth.users(id) on delete restrict,
  agency_id uuid references public.ap_agencies(id) on delete set null,
  subject text not null check (length(trim(subject)) between 4 and 200),
  category text not null check (category in ('general','account','agency_profile','verification','billing','technical','review_dispute','report','other')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','pending','waiting_on_customer','resolved','closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  sla_due_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.ap_support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.ap_support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  sender_type text not null check (sender_type in ('user','support','system')),
  message text not null check (length(trim(message)) between 1 and 10000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ap_support_ticket_queue_idx on public.ap_support_tickets(status,priority,updated_at desc);
create index if not exists ap_support_messages_ticket_idx on public.ap_support_messages(ticket_id,created_at);
alter table public.ap_support_tickets enable row level security;
alter table public.ap_support_messages enable row level security;
create policy "support_ticket_participant_read" on public.ap_support_tickets for select to authenticated using (user_id=auth.uid() or ap_private.is_staff(array['super_admin','support']));
create policy "support_ticket_owner_insert" on public.ap_support_tickets for insert to authenticated with check (user_id=auth.uid() and (agency_id is null or ap_private.has_agency_role(agency_id,null)));
create policy "support_ticket_staff_update" on public.ap_support_tickets for update to authenticated using (ap_private.is_staff(array['super_admin','support'])) with check (ap_private.is_staff(array['super_admin','support']));
create policy "support_ticket_owner_update" on public.ap_support_tickets for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "support_message_participant_read" on public.ap_support_messages for select to authenticated using (exists(select 1 from public.ap_support_tickets t where t.id=ticket_id and (t.user_id=auth.uid() or ap_private.is_staff(array['super_admin','support'])) and (not is_internal or ap_private.is_staff(array['super_admin','support']))));
create policy "support_message_participant_insert" on public.ap_support_messages for insert to authenticated with check (sender_id=auth.uid() and exists(select 1 from public.ap_support_tickets t where t.id=ticket_id and (t.user_id=auth.uid() or ap_private.is_staff(array['super_admin','support']))) and (not is_internal or ap_private.is_staff(array['super_admin','support'])));
grant select,insert on public.ap_support_tickets,public.ap_support_messages to authenticated;
grant update on public.ap_support_tickets to authenticated;
grant usage,select on sequence public.ap_support_ticket_number_seq to authenticated;

create or replace function ap_private.ap_support_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not ap_private.is_staff(array['super_admin','support']) then
    new.user_id=old.user_id; new.agency_id=old.agency_id; new.subject=old.subject; new.category=old.category;
    new.priority=old.priority; new.assigned_to=old.assigned_to; new.sla_due_at=old.sla_due_at;
    new.first_response_at=old.first_response_at; new.resolved_at=old.resolved_at;
    if new.status not in ('open','closed') then new.status=old.status; end if;
  end if;
  if tg_op='UPDATE' and (old.status,old.priority,old.assigned_to) is distinct from (new.status,new.priority,new.assigned_to) then
    insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
    values(auth.uid(),new.agency_id,'support.ticket_updated','support_ticket',new.id::text,jsonb_build_object('from_status',old.status,'to_status',new.status,'priority',new.priority));
  end if;
  new.updated_at=now(); return new;
end; $$;
drop trigger if exists ap_support_ticket_audit on public.ap_support_tickets;
create trigger ap_support_ticket_audit before update on public.ap_support_tickets for each row execute function ap_private.ap_support_audit();

commit;
