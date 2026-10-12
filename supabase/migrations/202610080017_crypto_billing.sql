begin;

create sequence if not exists public.ap_invoice_number_seq;

create table if not exists public.ap_billing_profiles (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null unique references public.ap_agencies(id) on delete cascade,
  contact_full_name text not null,
  legal_name text not null,
  billing_email text not null,
  billing_address text not null,
  tax_id text,
  country_code text not null default 'PH',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ap_payment_orders (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.ap_agencies(id) on delete cascade,
  plan_code text not null references public.ap_plans(code),
  billing_cycle text not null check (billing_cycle in ('monthly','annual')),
  provider text not null default 'crypto',
  provider_reference text,
  checkout_url text,
  currency text not null default 'USD',
  subtotal numeric(12,2) not null,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled','refunded')),
  failure_reason text,
  created_by uuid references auth.users(id) on delete set null,
  payer_full_name text not null,
  payer_email text not null,
  payer_company_name text not null,
  payer_billing_address text not null,
  crypto_asset text,
  crypto_network text,
  receiving_address text,
  expected_crypto_amount numeric(30,12),
  required_confirmations integer not null default 1,
  blockchain_confirmations integer not null default 0,
  transaction_hash text,
  transaction_detected_at timestamptz,
  transaction_confirmed_at timestamptz,
  payment_expires_at timestamptz,
  nowpayments_payment_id text unique,
  nowpayments_status text,
  pay_currency text,
  pay_amount numeric(30,12),
  pay_address text,
  payment_url text,
  current_crypto_status text not null default 'awaiting_payment',
  verified_transaction_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ap_payment_orders_nowpayments_payment_uq
  on public.ap_payment_orders(nowpayments_payment_id)
  where nowpayments_payment_id is not null;

create unique index if not exists ap_payment_orders_transaction_hash_uq
  on public.ap_payment_orders(transaction_hash)
  where transaction_hash is not null;

create index if not exists ap_payment_orders_agency_idx
  on public.ap_payment_orders(agency_id, created_at desc);

create index if not exists ap_payment_orders_crypto_status_idx
  on public.ap_payment_orders(provider, status, current_crypto_status);

create table if not exists public.ap_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default ('INV-' || to_char(now(),'YYYYMMDD') || '-' || lpad(nextval('public.ap_invoice_number_seq')::text, 6, '0')),
  order_id uuid not null unique references public.ap_payment_orders(id) on delete cascade,
  agency_id uuid not null references public.ap_agencies(id) on delete cascade,
  status text not null default 'open' check (status in ('open','paid','void','overdue')),
  currency text not null default 'USD',
  subtotal numeric(12,2) not null,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null,
  due_at timestamptz,
  seller_snapshot jsonb not null default '{}'::jsonb,
  customer_snapshot jsonb not null default '{}'::jsonb,
  line_items jsonb not null default '[]'::jsonb,
  payment_snapshot jsonb not null default '{}'::jsonb,
  notes text,
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ap_payment_orders add column if not exists nowpayments_payment_id text;
alter table public.ap_payment_orders add column if not exists nowpayments_status text;
alter table public.ap_payment_orders add column if not exists pay_currency text;
alter table public.ap_payment_orders add column if not exists pay_amount numeric(30,12);
alter table public.ap_payment_orders add column if not exists pay_address text;
alter table public.ap_payment_orders add column if not exists payment_url text;
alter table public.ap_payment_orders add column if not exists current_crypto_status text default 'awaiting_payment';
alter table public.ap_payment_orders add column if not exists verified_transaction_hash text;
alter table public.ap_payment_orders add column if not exists transaction_detected_at timestamptz;
alter table public.ap_payment_orders add column if not exists transaction_confirmed_at timestamptz;
alter table public.ap_payment_orders add column if not exists blockchain_confirmations integer default 0;
alter table public.ap_payment_orders add column if not exists required_confirmations integer default 1;
alter table public.ap_payment_orders add column if not exists transaction_hash text;
alter table public.ap_payment_orders add column if not exists receiving_address text;
alter table public.ap_payment_orders add column if not exists expected_crypto_amount numeric(30,12);
alter table public.ap_payment_orders add column if not exists payment_expires_at timestamptz;
alter table public.ap_payment_orders add column if not exists crypto_asset text;
alter table public.ap_payment_orders add column if not exists crypto_network text;
alter table public.ap_payment_orders add column if not exists provider_reference text;
alter table public.ap_payment_orders add column if not exists checkout_url text;
alter table public.ap_payment_orders add column if not exists failure_reason text;

alter table public.ap_invoices add column if not exists payment_snapshot jsonb not null default '{}'::jsonb;
alter table public.ap_invoices add column if not exists paid_at timestamptz;
alter table public.ap_invoices add column if not exists updated_at timestamptz not null default now();

create table if not exists public.ap_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null unique,
  event_type text not null,
  order_id uuid references public.ap_payment_orders(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.ap_billing_profiles enable row level security;
alter table public.ap_payment_orders enable row level security;
alter table public.ap_invoices enable row level security;
alter table public.ap_payment_events enable row level security;

revoke all on public.ap_billing_profiles, public.ap_payment_orders, public.ap_invoices, public.ap_payment_events from anon, authenticated;
grant select on public.ap_invoices to authenticated;

drop policy if exists "billing_invoices_related_read" on public.ap_invoices;

create policy "billing_invoices_related_read"
on public.ap_invoices for select to authenticated
using (
  ap_private.has_agency_role(agency_id, array['owner','admin','billing'])
  or ap_private.is_staff(array['super_admin','finance'])
);

create or replace function public.ap_activate_crypto_payment(target_order uuid, verified_txid text, confirmations integer)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  target public.ap_payment_orders%rowtype;
  period_end timestamptz;
  invoice_id uuid;
begin
  select * into target
  from public.ap_payment_orders
  where id = target_order
  for update;

  if target.id is null then
    raise exception 'Payment order not found';
  end if;

  if target.provider <> 'crypto' then
    raise exception 'Payment order is not crypto';
  end if;

  if target.status = 'paid' then
    return;
  end if;

  period_end := case
    when target.billing_cycle = 'annual' then now() + interval '1 year'
    else now() + interval '1 month'
  end;

  update public.ap_payment_orders
  set status='paid',
      current_crypto_status='confirmed',
      transaction_hash=coalesce(verified_txid, transaction_hash),
      verified_transaction_hash=coalesce(verified_txid, transaction_hash),
      blockchain_confirmations=greatest(coalesce(confirmations,0), required_confirmations),
      transaction_detected_at=coalesce(transaction_detected_at, now()),
      transaction_confirmed_at=now(),
      updated_at=now()
  where id=target_order;

  select id into invoice_id from public.ap_invoices where order_id=target_order;

  update public.ap_invoices
  set status='paid', paid_at=now(), updated_at=now()
  where order_id=target_order;

  insert into public.ap_subscriptions(
    agency_id, plan_code, status, current_period_started_at,
    current_period_ends_at, commercial_reference, activated_by, updated_at
  ) values (
    target.agency_id, target.plan_code, 'active', now(), period_end,
    coalesce((select invoice_number from public.ap_invoices where id=invoice_id), target.id::text),
    null, now()
  )
  on conflict (agency_id) do update set
    plan_code=excluded.plan_code,
    status='active',
    current_period_started_at=excluded.current_period_started_at,
    current_period_ends_at=excluded.current_period_ends_at,
    commercial_reference=excluded.commercial_reference,
    cancel_at_period_end=false,
    updated_at=now();
end;
$$;

revoke all on function public.ap_activate_crypto_payment(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.ap_activate_crypto_payment(uuid,text,integer) to service_role;

commit;
