begin;
alter table public.ap_payment_orders add column if not exists paypal_environment text check(paypal_environment in ('sandbox','live'));
alter table public.ap_payment_orders add column if not exists paypal_merchant_id text;
alter table public.ap_payment_orders add column if not exists paypal_capture_id text;
alter table public.ap_payment_orders add column if not exists paypal_state text not null default 'created';
create unique index if not exists ap_paypal_order_unique on public.ap_payment_orders(paypal_environment,provider_reference) where provider='paypal' and provider_reference is not null;
create unique index if not exists ap_paypal_capture_unique on public.ap_payment_orders(paypal_environment,paypal_capture_id) where provider='paypal' and paypal_capture_id is not null;

create or replace function public.ap_create_paypal_invoice(input jsonb,seller jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.ap_payment_orders%rowtype; plan public.ap_plans%rowtype; price numeric; payment_id uuid:=gen_random_uuid();
begin
  if coalesce(input->>'environment','') not in ('sandbox','live') or coalesce(input->>'billing_cycle','') not in ('monthly','annual') or coalesce(input->>'plan_code','') not in ('prive','select','elite') then raise exception 'Invalid checkout'; end if;
  if not exists(select 1 from public.ap_agency_memberships where agency_id=(input->>'agency_id')::uuid and user_id=(input->>'created_by')::uuid and status='active' and role in ('owner','admin','billing'))
    or exists(select 1 from public.ap_staff_roles where user_id=(input->>'created_by')::uuid) then raise exception 'Agency billing access required'; end if;
  if length(input->>'legal_name') not between 2 and 200 or length(input->>'billing_address') not between 8 and 1000 or length(input->>'billing_email') not between 3 and 254 then raise exception 'Invalid billing information'; end if;
  perform pg_advisory_xact_lock(hashtext('checkout:'||(input->>'request_id')));
  select * into p from public.ap_payment_orders where checkout_request_id=(input->>'request_id')::uuid;
  if p.id is not null then
    if p.provider<>'paypal' or p.agency_id is distinct from (input->>'agency_id')::uuid or p.created_by is distinct from (input->>'created_by')::uuid or p.plan_code is distinct from input->>'plan_code' or p.billing_cycle is distinct from input->>'billing_cycle' or p.paypal_environment is distinct from input->>'environment'
      or p.payer_company_name is distinct from input->>'legal_name' or p.payer_email is distinct from input->>'billing_email' or p.payer_billing_address is distinct from input->>'billing_address' then raise exception 'Checkout request has changed; reload checkout'; end if;
    return p.id;
  end if;
  select * into plan from public.ap_plans where code=input->>'plan_code' and active=true;
  price:=case when input->>'billing_cycle'='annual' then plan.annual_price_usd else plan.monthly_price_usd end;
  if plan.code is null or price is null or price<=0 then raise exception 'Active plan price missing'; end if;
  insert into public.ap_billing_profiles(agency_id,contact_full_name,legal_name,billing_email,billing_address,tax_id)
    values((input->>'agency_id')::uuid,input->>'full_name',input->>'legal_name',input->>'billing_email',input->>'billing_address',input->>'tax_id')
    on conflict(agency_id) do update set contact_full_name=excluded.contact_full_name,legal_name=excluded.legal_name,billing_email=excluded.billing_email,billing_address=excluded.billing_address,tax_id=excluded.tax_id,updated_at=now();
  insert into public.ap_payment_orders(id,checkout_request_id,agency_id,created_by,plan_code,billing_cycle,provider,currency,subtotal,total_amount,payer_full_name,payer_email,payer_company_name,payer_billing_address,paypal_environment,payment_expires_at)
    values(payment_id,(input->>'request_id')::uuid,(input->>'agency_id')::uuid,(input->>'created_by')::uuid,plan.code,input->>'billing_cycle','paypal','USD',price,price,input->>'full_name',input->>'billing_email',input->>'legal_name',input->>'billing_address',input->>'environment',now()+interval '3 hours');
  insert into public.ap_invoices(order_id,agency_id,currency,subtotal,total_amount,due_at,seller_snapshot,customer_snapshot,line_items,payment_snapshot,notes)
    values(payment_id,(input->>'agency_id')::uuid,'USD',price,price,now()+interval '3 hours',seller,
      jsonb_build_object('legal_name',input->>'legal_name','full_name',input->>'full_name','billing_email',input->>'billing_email','billing_address',input->>'billing_address','tax_id',input->>'tax_id'),
      jsonb_build_array(jsonb_build_object('description',plan.name||' - '||(input->>'billing_cycle')||' access (no automatic renewal)','quantity',1,'amount',price)),
      jsonb_build_object('provider','paypal','environment',input->>'environment','status','created'),
      case when input->>'environment'='sandbox' then 'SANDBOX TEST ONLY. No real money received. Does not activate live plan access.' else 'One-time purchase. No automatic renewal. Payment purchases tools only; verification and reviews remain independent.' end);
  return payment_id;
end; $$;

create or replace function public.ap_attach_paypal_order(target_order uuid,environment text,remote_id text,merchant_id text,approval_url text)
returns void language plpgsql security definer set search_path='' as $$
declare p public.ap_payment_orders%rowtype;
begin
  select * into p from public.ap_payment_orders where id=target_order for update;
  if p.id is null or p.provider<>'paypal' or p.paypal_environment is distinct from environment or nullif(remote_id,'') is null or nullif(merchant_id,'') is null then raise exception 'Invalid PayPal binding'; end if;
  if p.provider_reference is not null and (p.provider_reference is distinct from remote_id or p.paypal_merchant_id is distinct from merchant_id) then raise exception 'PayPal binding is immutable'; end if;
  update public.ap_payment_orders set provider_reference=remote_id,paypal_merchant_id=merchant_id,checkout_url=approval_url,updated_at=now() where id=p.id;
  update public.ap_invoices set payment_snapshot=payment_snapshot||jsonb_build_object('paypal_order_id',remote_id,'merchant_id',merchant_id),updated_at=now() where order_id=p.id;
end; $$;

create or replace function public.ap_record_paypal_capture(target_order uuid,proof jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare p public.ap_payment_orders%rowtype; existing public.ap_subscriptions%rowtype; started timestamptz; result text;
begin
  select * into p from public.ap_payment_orders where id=target_order for update;
  if p.id is null or p.provider<>'paypal' or p.provider_reference is null or p.paypal_merchant_id is null or proof->>'environment' is distinct from p.paypal_environment or proof->>'order_id' is distinct from p.provider_reference or proof->>'merchant_id' is distinct from p.paypal_merchant_id
    or proof->>'currency' is distinct from p.currency or (proof->>'amount')::numeric is distinct from p.total_amount or proof->>'status' is distinct from 'COMPLETED' or nullif(proof->>'capture_id','') is null then raise exception 'Independent completed PayPal capture required'; end if;
  if p.status='paid' then
    if p.paypal_capture_id is distinct from proof->>'capture_id' then raise exception 'Capture mismatch'; end if;
    return p.paypal_state;
  end if;
  if p.status<>'pending' or p.paypal_state in ('refunded','reversed','partially_refunded') then raise exception 'Payment requires review'; end if;
  result:=case when p.paypal_environment='sandbox' then 'test_completed' else 'completed' end;
  update public.ap_payment_orders set status='paid',paypal_state=result,paypal_capture_id=proof->>'capture_id',transaction_confirmed_at=now(),updated_at=now() where id=p.id;
  update public.ap_invoices set status='paid',paid_at=now(),payment_snapshot=payment_snapshot||proof||jsonb_build_object('provider','paypal','status',result),updated_at=now() where order_id=p.id;
  if not found then raise exception 'Invoice missing'; end if;
  if p.paypal_environment='live' then
    perform pg_advisory_xact_lock(hashtext('subscription:'||p.agency_id::text));
    select * into existing from public.ap_subscriptions where agency_id=p.agency_id for update;
    started:=case when existing.plan_code=p.plan_code and existing.status='active' and existing.current_period_ends_at>now() then existing.current_period_ends_at else now() end;
    insert into public.ap_subscriptions(agency_id,plan_code,status,current_period_started_at,current_period_ends_at,commercial_reference,cancel_at_period_end,updated_at)
      values(p.agency_id,p.plan_code,'active',now(),started+case when p.billing_cycle='annual' then interval '1 year' else interval '1 month' end,'paypal:'||(proof->>'capture_id'),true,now())
      on conflict(agency_id) do update set plan_code=excluded.plan_code,status='active',current_period_started_at=excluded.current_period_started_at,current_period_ends_at=excluded.current_period_ends_at,commercial_reference=excluded.commercial_reference,cancel_at_period_end=true,updated_at=now();
    insert into public.ap_payment_notifications(order_id,kind,recipient,event) values(p.id,'customer',p.payer_email,'confirmed') on conflict do nothing;
    insert into public.ap_payment_notifications(order_id,kind,event) values(p.id,'admin','confirmed') on conflict do nothing;
  end if;
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata) values(null,p.agency_id,'payment.paypal_'||result,'payment',p.id::text,proof);
  return result;
end; $$;

create or replace function public.ap_paypal_exception(target_order uuid,new_state text,details jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare p public.ap_payment_orders%rowtype;
begin
  if new_state not in ('pending','denied','refunded','partially_refunded','reversed','verification_error') then raise exception 'Invalid PayPal state'; end if;
  select * into p from public.ap_payment_orders where id=target_order for update;
  if p.id is null or p.provider<>'paypal' then raise exception 'Payment missing'; end if;
  if p.paypal_state in ('refunded','reversed') then return; end if;
  if new_state in ('pending','denied','verification_error') and p.status<>'pending' then return; end if;
  update public.ap_payment_orders set paypal_state=new_state,status=case when new_state in ('refunded','reversed') then 'refunded' when new_state='denied' then 'failed' else status end,failure_reason=case when new_state='verification_error' then 'PayPal verification failed; retry or contact support.' else new_state end,updated_at=now() where id=p.id;
  update public.ap_invoices set payment_snapshot=payment_snapshot||jsonb_build_object('status',new_state,'exception',details),updated_at=now() where order_id=p.id;
  insert into public.ap_payment_exceptions(order_id,code,details) values(p.id,'paypal_'||new_state,details) on conflict(order_id,code,txid) do update set details=excluded.details;
  if p.paypal_environment='live' then
    if new_state in ('refunded','reversed') then
      perform pg_advisory_xact_lock(hashtext('subscription:'||p.agency_id::text));
      update public.ap_subscriptions set status='cancelled',cancel_at_period_end=true,updated_at=now() where agency_id=p.agency_id and commercial_reference='paypal:'||p.paypal_capture_id;
    end if;
    insert into public.ap_payment_notifications(order_id,kind,event) values(p.id,'admin','paypal_'||new_state) on conflict do nothing;
  end if;
end; $$;
revoke all on function public.ap_create_paypal_invoice(jsonb,jsonb),public.ap_attach_paypal_order(uuid,text,text,text,text),public.ap_record_paypal_capture(uuid,jsonb),public.ap_paypal_exception(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.ap_create_paypal_invoice(jsonb,jsonb),public.ap_attach_paypal_order(uuid,text,text,text,text),public.ap_record_paypal_capture(uuid,jsonb),public.ap_paypal_exception(uuid,text,jsonb) to service_role;
commit;
