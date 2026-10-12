import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
let db: PGlite;
const agency = "10000000-0000-4000-8000-000000000001", user = "20000000-0000-4000-8000-000000000001";
async function create(environment = "sandbox", overrides: Record<string, unknown> = {}) {
  const input = { request_id: randomUUID(), agency_id: agency, created_by: user, plan_code: "prive", billing_cycle: "monthly", environment, legal_name: "Example Agency", full_name: "Example Owner", billing_email: "owner@example.com", billing_address: "Example billing address", tax_id: "", ...overrides };
  const result = await db.query<{ id: string }>("select ap_create_paypal_invoice($1::jsonb,'{}'::jsonb) id", [JSON.stringify(input)]);
  return { id: result.rows[0].id, input };
}
async function bind(id: string, environment = "sandbox", remote = randomUUID()) {
  await db.query("select ap_attach_paypal_order($1,$2,$3,'MERCHANT','https://www.sandbox.paypal.com/checkout')", [id, environment, remote]);
  return remote;
}
function evidence(remote: string, environment = "sandbox", override: Record<string, unknown> = {}) {
  return { order_id: remote, merchant_id: "MERCHANT", environment, capture_id: randomUUID(), status: "COMPLETED", amount: "49.00", currency: "USD", ...override };
}
async function record(id: string, proof: Record<string, unknown>) { return db.query("select ap_record_paypal_capture($1,$2::jsonb) state", [id, JSON.stringify(proof)]); }
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema ap_private;
    create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;
    create function ap_private.has_agency_role(uuid,text[]) returns boolean language sql as $$select false$$;
    create function ap_private.is_staff(text[]) returns boolean language sql as $$select false$$;
    create table ap_agencies(id uuid primary key);create table ap_plans(code text primary key,name text,active boolean,monthly_price_usd numeric,annual_price_usd numeric);
    create table ap_agency_memberships(agency_id uuid,user_id uuid,role text,status text);create table ap_staff_roles(user_id uuid,role text);
    create table ap_subscriptions(id uuid primary key default gen_random_uuid(),agency_id uuid unique,plan_code text,status text,current_period_started_at timestamptz,current_period_ends_at timestamptz,commercial_reference text,cancel_at_period_end boolean,updated_at timestamptz);
    create table ap_security_audit(actor_user_id uuid,agency_id uuid,action text,target_type text,target_id text,metadata jsonb);
    insert into auth.users values('${user}');insert into ap_agencies values('${agency}');insert into ap_plans values('prive','Prive',true,49,490);
    insert into ap_agency_memberships values('${agency}','${user}','owner','active');`);
  for (const file of ["202610080017_crypto_billing.sql", "202610110021_reliable_crypto_payments.sql", "202610110022_binance_credit_verification.sql", "202610110023_shared_binance_checkout.sql", "202610110024_paypal_checkout.sql"]) await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });
describe("PayPal atomic payment records", () => {
  it("uses database plan prices, ignoring a client-submitted amount", async () => {
    const p = await create("sandbox", { total_amount: 1 });
    const row = await db.query<{ total_amount: string }>("select total_amount from ap_payment_orders where id=$1", [p.id]);
    expect(Number(row.rows[0].total_amount)).toBe(49);
  });
  it("retries one request without duplicate invoices and rejects changed selections", async () => {
    const p = await create();
    const same = await create("sandbox", p.input); expect(same.id).toBe(p.id);
    await expect(create("sandbox", { ...p.input, billing_cycle: "annual" })).rejects.toThrow("changed");
  });
  it("does not change live access or queue real receipts for sandbox payments", async () => {
    const p = await create(), remote = await bind(p.id); await record(p.id, evidence(remote));
    expect((await db.query("select * from ap_subscriptions")).rows).toHaveLength(0);
    expect((await db.query("select * from ap_payment_notifications where order_id=$1", [p.id])).rows).toHaveLength(0);
    expect((await db.query<{ paypal_state: string }>("select paypal_state from ap_payment_orders where id=$1", [p.id])).rows[0].paypal_state).toBe("test_completed");
  });
  it("activates live paid access exactly once and queues two notices", async () => {
    const p = await create("live"), remote = await bind(p.id, "live"), proof = evidence(remote, "live"); await record(p.id, proof);
    const before = await db.query<{current_period_ends_at:string;commercial_reference:string;cancel_at_period_end:boolean}>("select current_period_ends_at,commercial_reference,cancel_at_period_end from ap_subscriptions");
    await record(p.id, proof); expect((await db.query<{current_period_ends_at:string;commercial_reference:string;cancel_at_period_end:boolean}>("select current_period_ends_at,commercial_reference,cancel_at_period_end from ap_subscriptions")).rows).toEqual(before.rows);
    expect(before.rows[0].cancel_at_period_end).toBe(true);
    expect((await db.query("select * from ap_payment_notifications where order_id=$1", [p.id])).rows).toHaveLength(2);
  });
  it.each([{ merchant_id: "OTHER" }, { environment: "live" }, { order_id: "OTHER" }, { amount: "48.99" }, { amount: "49.01" }, { currency: "EUR" }, { status: "APPROVED" }])("rejects incomplete or mismatched proof %j", async override => {
    const p = await create(), remote = await bind(p.id); await expect(record(p.id, evidence(remote, "sandbox", override))).rejects.toThrow();
    expect((await db.query<{ status: string }>("select status from ap_payment_orders where id=$1", [p.id])).rows[0].status).toBe("pending");
  });
  it("prevents a completed capture being used for another invoice", async () => {
    const a = await create(), b = await create(), ra = await bind(a.id), rb = await bind(b.id), proof = evidence(ra);
    await record(a.id, proof); await expect(record(b.id, { ...proof, order_id: rb })).rejects.toThrow();
  });
  it("binds the receiving account immutably", async () => {
    const p = await create(), remote = await bind(p.id);
    await expect(db.query("select ap_attach_paypal_order($1,'sandbox',$2,'OTHER','https://example.com')", [p.id, remote])).rejects.toThrow("immutable");
  });
  it("revokes the corresponding live entitlement on full refund and cannot re-activate it", async () => {
    const p = await create("live"), remote = await bind(p.id, "live"), proof = evidence(remote, "live"); await record(p.id, proof);
    await db.query("select ap_paypal_exception($1,'refunded','{}'::jsonb)", [p.id]);
    expect((await db.query<{ status: string }>("select status from ap_subscriptions")).rows[0].status).toBe("cancelled");
    await expect(record(p.id, proof)).rejects.toThrow("review");
  });
  it("blocks activation when a reversal arrives before capture recording", async () => {
    const p = await create(), remote = await bind(p.id); await db.query("select ap_paypal_exception($1,'reversed','{}'::jsonb)", [p.id]);
    await expect(record(p.id, evidence(remote))).rejects.toThrow("review");
  });
  it("denies direct customer execution of activation functions", async () => {
    const permission = await db.query<{ permitted: boolean }>("select has_function_privilege('authenticated','ap_record_paypal_capture(uuid,jsonb)','execute') permitted");
    expect(permission.rows[0].permitted).toBe(false);
  });
  it("rejects nonmembers and platform staff even with otherwise valid input", async () => {
    await expect(create("sandbox", { created_by: randomUUID() })).rejects.toThrow("access");
    await db.query("insert into ap_staff_roles values($1,'super_admin')", [user]);
    await expect(create()).rejects.toThrow("access");
    await db.query("delete from ap_staff_roles where user_id=$1", [user]);
  });
});
