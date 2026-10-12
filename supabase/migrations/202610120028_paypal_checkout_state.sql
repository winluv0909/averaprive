begin;
-- Explicit initial state, independent of a legacy table default.
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
  insert into public.ap_payment_orders(id,checkout_request_id,agency_id,created_by,plan_code,billing_cycle,provider,currency,subtotal,total_amount,payer_full_name,payer_email,payer_company_name,payer_billing_address,paypal_environment,payment_expires_at,status)
    values(payment_id,(input->>'request_id')::uuid,(input->>'agency_id')::uuid,(input->>'created_by')::uuid,plan.code,input->>'billing_cycle','paypal','USD',price,price,input->>'full_name',input->>'billing_email',input->>'legal_name',input->>'billing_address',input->>'environment',now()+interval '3 hours','pending');
  insert into public.ap_invoices(order_id,agency_id,currency,subtotal,total_amount,due_at,seller_snapshot,customer_snapshot,line_items,payment_snapshot,notes)
    values(payment_id,(input->>'agency_id')::uuid,'USD',price,price,now()+interval '3 hours',seller,
      jsonb_build_object('legal_name',input->>'legal_name','full_name',input->>'full_name','billing_email',input->>'billing_email','billing_address',input->>'billing_address','tax_id',input->>'tax_id'),
      jsonb_build_array(jsonb_build_object('description',plan.name||' - '||(input->>'billing_cycle')||' access (no automatic renewal)','quantity',1,'amount',price)),
      jsonb_build_object('provider','paypal','environment',input->>'environment','status','created'),
      case when input->>'environment'='sandbox' then 'SANDBOX TEST ONLY. No real money received. Does not activate live plan access.' else 'One-time purchase. No automatic renewal. Payment purchases tools only; verification and reviews remain independent.' end);
  return payment_id;
end; $$;

create or replace function public.ap_prepare_paypal_checkout(target_order uuid,target_agency uuid,actor_user uuid)
returns void language plpgsql security definer set search_path='' as $$
declare p public.ap_payment_orders%rowtype;
begin
  if not exists(select 1 from public.ap_agency_memberships where agency_id=target_agency and user_id=actor_user and status='active' and role in ('owner','admin','billing'))
     or exists(select 1 from public.ap_staff_roles where user_id=actor_user) then raise exception 'Agency billing access required'; end if;
  select * into p from public.ap_payment_orders where id=target_order and agency_id=target_agency for update;
  if p.id is null or p.provider<>'paypal' or coalesce(p.paypal_environment,'') not in ('sandbox','live')
     or p.payment_expires_at is null or p.payment_expires_at<=now() then
    raise exception 'PayPal checkout is unavailable or expired';
  end if;
  if p.status='pending' then return; end if;
  if p.status<>'created' or p.paypal_state<>'created' or p.provider_reference is not null
     or p.checkout_url is not null or p.paypal_capture_id is not null or p.paypal_merchant_id is not null then
    raise exception 'Payment state requires review; checkout cannot be restarted';
  end if;
  update public.ap_payment_orders set status='pending',updated_at=now() where id=p.id;
  insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
  values(actor_user,p.agency_id,'payment.paypal_checkout_recovered','payment_order',p.id::text,
         jsonb_build_object('from_status','created','to_status','pending'));
end; $$;
revoke all on function public.ap_create_paypal_invoice(jsonb,jsonb),public.ap_prepare_paypal_checkout(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.ap_create_paypal_invoice(jsonb,jsonb),public.ap_prepare_paypal_checkout(uuid,uuid,uuid) to service_role;

commit;
