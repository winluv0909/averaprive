import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
let db: PGlite;
const agency = "10000000-0000-4000-8000-000000000001", user = "20000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema ap_private;
    create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select '20000000-0000-4000-8000-000000000001'::uuid$$;
    create function ap_private.has_agency_role(uuid,text[]) returns boolean language sql as $$select true$$;
    create function ap_private.is_staff(text[]) returns boolean language sql as $$select false$$;
    create table ap_agencies(id uuid primary key);create table ap_plans(code text primary key,name text,active boolean,monthly_price_usd numeric,annual_price_usd numeric);
    create table ap_agency_memberships(agency_id uuid,user_id uuid,role text,status text);create table ap_staff_roles(user_id uuid,role text);
    create table ap_subscriptions(id uuid primary key default gen_random_uuid(),agency_id uuid unique,plan_code text,status text,current_period_started_at timestamptz,current_period_ends_at timestamptz,commercial_reference text,cancel_at_period_end boolean,updated_at timestamptz);
    create table ap_security_audit(actor_user_id uuid,agency_id uuid,action text,target_type text,target_id text,metadata jsonb);
    insert into auth.users values('${user}');insert into ap_agencies values('${agency}');insert into ap_plans values('prive','Prive',true,49,490);
    insert into ap_agency_memberships values('${agency}','${user}','owner','active');`);
  for (const file of ["202610080017_crypto_billing.sql", "202610110021_reliable_crypto_payments.sql", "202610110022_binance_credit_verification.sql", "202610110023_shared_binance_checkout.sql", "202610110024_paypal_checkout.sql", "202610120025_trust_wallet_checkout.sql"]) await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });

async function create(overrides: Record<string,unknown> = {}) {
 const input = {checkout_request_id:randomUUID(),agency_id:agency,created_by:user,plan_code:"prive",billing_cycle:"monthly",payer_company_name:"Example agency",payer_full_name:"Example owner",payer_email:"owner@example.com",payer_billing_address:"Example street address",crypto_asset:"USDT",crypto_network:"ERC20",token_contract:"0xdac17f958d2ee523a2206206994597c13d831ec7",token_decimals:6,required_confirmations:12,total_amount:"49",expected_crypto_amount:"49",scan_cursor:"100",payment_expires_at:new Date(Date.now()+1800000).toISOString(),quoted_at:new Date().toISOString(),usd_rate:"1",receiving_provider:"wallet",...overrides};
 const result=await db.query<{record:{order_id:string}}>("select ap_create_trust_wallet_invoice($1::jsonb,$2::jsonb,'{}'::jsonb) record",[JSON.stringify(input),JSON.stringify([input.crypto_network==="BITCOIN"?"bc1qyxpxwhmd8w39xndgnvu9wfq6d57sa7t7u9c42h":input.crypto_network==="TRC20"?"TQmrKedVwf3yfvmLUcsPbnWsWHFkSFVZnq":"0x7a71cfbdc7d37d9520445bff3634cbda889f904d"])]);
 return {id:result.rows[0].record.order_id,input};
}
async function proof(id:string, overrides:Record<string,unknown>={}) {
 const q=await db.query<Record<string,unknown>>("select *,expected_crypto_amount::text exact from ap_payment_orders where id=$1",[id]);const p=q.rows[0];
 return {network:p.crypto_network,txid:"0x"+randomUUID().replaceAll("-","").padEnd(64,"0"),token:p.token_contract,destination:p.receiving_address,amount:p.exact,confirmations:p.required_confirmations,finalized:true,successful:true,block_hash:"independent-block",block_number:"150",transaction_at:new Date().toISOString(),...overrides};
}
async function lease(id:string) {const worker=randomUUID();await db.query("update ap_payment_orders set monitor_worker=$2,monitor_lock_until=now()+interval '10 minutes' where id=$1",[id,worker]);return worker;}
async function record(id:string,evidence:Record<string,unknown>) { const worker=await lease(id);return db.query<{state:string}>("select ap_record_trust_wallet_evidence($1,$2,$3::jsonb) state",[id,worker,JSON.stringify(evidence)]); }
describe("Trust Wallet atomic checkout",()=>{
 it("creates distinct exact amounts for concurrent invoices to the same wallet",async()=>{const orders=await Promise.all(Array.from({length:8},()=>create()));const rows=await db.query<{amount:string}>("select expected_crypto_amount::text amount from ap_payment_orders where id=any($1::uuid[])",[orders.map(p=>p.id)]);expect(new Set(rows.rows.map(p=>p.amount)).size).toBe(8);});
 it("is idempotent and rejects changed billing information",async()=>{const p=await create();expect((await create(p.input)).id).toBe(p.id);await expect(create({...p.input,payer_email:"other@example.com"})).rejects.toThrow("different details");});
 it("rejects spoofed prices, recipients and unauthorized users",async()=>{await expect(create({total_amount:"1"})).rejects.toThrow("price");await expect(create({token_contract:"0x0000000000000000000000000000000000000001"})).rejects.toThrow("mismatch");await expect(create({created_by:randomUUID()})).rejects.toThrow("membership");});
 it("supports native Bitcoin, Base and Arbitrum invoices",async()=>{for(const channel of [{crypto_asset:"BTC",crypto_network:"BITCOIN",token_contract:"BTC",token_decimals:8,required_confirmations:6,expected_crypto_amount:"0.00049",usd_rate:"100000"},{crypto_asset:"USDC",crypto_network:"BASE",token_contract:"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"},{crypto_asset:"USDC",crypto_network:"ARBITRUM",token_contract:"0xaf88d065e77c8cc2239327c5edb3a432268e5831"}])expect((await create(channel)).id).toBeTruthy();});
 it("activates only the invoice whose exact amount was received",async()=>{const a=await create(),b=await create(),e=await proof(b.id);expect((await record(a.id,e)).rows[0].state).not.toBe("confirmed");expect((await record(b.id,e)).rows[0].state).toBe("confirmed");expect((await db.query<{status:string}>("select status from ap_payment_orders where id=$1",[a.id])).rows[0].status).toBe("pending");expect((await db.query<{cancel_at_period_end:boolean}>("select cancel_at_period_end from ap_subscriptions where agency_id=$1",[agency])).rows[0].cancel_at_period_end).toBe(true);});
 it("requires finality and sufficient confirmations",async()=>{const p=await create();const e=await proof(p.id,{finalized:false,confirmations:1});expect((await record(p.id,e)).rows[0].state).toBe("confirming");e.finalized=true;e.confirmations=12;expect((await record(p.id,e)).rows[0].state).toBe("confirmed");});
 it("does not accept a customer hash as proof",async()=>{const p=await create();await db.query("select ap_submit_trust_wallet_hint($1,$2)",[p.id,"0x"+"a".repeat(64)]);expect((await db.query<{status:string}>("select status from ap_payment_orders where id=$1",[p.id])).rows[0].status).toBe("pending");});
 it("keeps duplicate, underpayment and overpayment hints in review",async()=>{const paid=await create(),e=await proof(paid.id);await record(paid.id,e);const other=await create();await db.query("select ap_submit_trust_wallet_hint($1,$2)",[other.id,e.txid]);await record(other.id,e);expect((await db.query("select * from ap_payment_exceptions where order_id=$1 and code='duplicate_txid'",[other.id])).rows).toHaveLength(1);for(const [amount,code] of [["1","underpaid"],["999","overpaid"]]){const p=await create(),q=await proof(p.id,{amount});await db.query("select ap_submit_trust_wallet_hint($1,$2)",[p.id,q.txid]);await record(p.id,q);expect((await db.query("select * from ap_payment_exceptions where order_id=$1 and code=$2",[p.id,code])).rows).toHaveLength(1);}});
 it("does not activate late payments or wrong-network evidence",async()=>{const p=await create();expect((await record(p.id,await proof(p.id,{transaction_at:new Date(Date.now()+3600000).toISOString()}))).rows[0].state).toBe("late_payment");const q=await create();expect((await record(q.id,await proof(q.id,{network:"BEP20"}))).rows[0].state).not.toBe("confirmed");});
 it("does not scan historical Binance invoices",async()=>{await db.query("update ap_payment_orders set wallet_generation=null,receiving_provider='binance',monitor_after=now() where status='pending'");const rows=await db.query("select ap_claim_trust_wallet_monitor($1,4)",[randomUUID()]);expect(rows.rows).toHaveLength(0);});
});
