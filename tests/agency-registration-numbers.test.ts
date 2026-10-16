import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const db = new PGlite();
const reservation = "a0000000-0000-4000-8000-000000000001";
const delivery = "a0000000-0000-4000-8000-000000000002";
const user = "a0000000-0000-4000-8000-000000000003";
const agency = "a0000000-0000-4000-8000-000000000004";
const number = "AP-2026-0123456789ABCDEF0123";
const email = "owner@example.com";
const hash = "a".repeat(64);

async function prepare(id = delivery, candidate = number, proof = hash) {
  return db.query<{ number: string }>(
    "select public.ap_prepare_registration_number($1,$2,$3,$4,$5,$6) as number",
    [id, reservation, email, hash, proof, candidate],
  );
}
async function markSent() {
  await db.query("update public.ap_agency_registration_numbers set delivery_status='sent' where id=$1", [reservation]);
}
async function verify(candidate = number) {
  return db.query<{ status: string }>(
    "select public.ap_verify_registration_number($1,$2,$3,$4) as status",
    [reservation, email, hash, candidate],
  );
}
async function bind(owner = user, target = agency, ownerEmail = email) {
  return db.query<{ number: string }>(
    "select public.ap_bind_registration_number($1,$2,$3,$4,$5) as number",
    [reservation, number, owner, target, ownerEmail],
  );
}

beforeAll(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table public.ap_agencies(id uuid primary key);
    create table public.ap_agency_memberships(agency_id uuid,user_id uuid,role text,status text);
  `);
  const directory = join(process.cwd(), "supabase", "migrations");
  const file = readdirSync(directory).find((name) => name.endsWith("_agency_registration_numbers.sql"));
  if (!file) throw new Error("Install the agency_registration_numbers migration before running these tests.");
  await db.exec(readFileSync(join(directory, file), "utf8"));
}, 30_000);

beforeEach(async () => {
  await db.exec(`truncate public.ap_registration_number_deliveries, public.ap_agency_registration_numbers;
    truncate auth.users, public.ap_agencies, public.ap_agency_memberships cascade;`);
  await db.query("insert into auth.users values($1,$2,now())", [user, email]);
  await db.query("insert into public.ap_agencies values($1)", [agency]);
  await db.query("insert into public.ap_agency_memberships values($1,$2,'owner','active')", [agency, user]);
});
afterAll(async () => { await db.close(); });

describe("Avera Privé registration numbers", () => {
  it("keeps the same number on resend and enforces the cooldown", async () => {
    expect((await prepare()).rows[0].number).toBe(number);
    const retry = "a0000000-0000-4000-8000-000000000005";
    await expect(prepare(retry)).rejects.toThrow("COOLDOWN");
    await db.exec("update public.ap_registration_number_deliveries set created_at=now()-interval '61 seconds'");
    expect((await prepare(retry, "AP-2026-FFFFFFFFFFFFFFFFFFFF")).rows[0].number).toBe(number);
  });
  it("requires sent delivery and a correct number before verification", async () => {
    await prepare();
    expect((await verify()).rows[0].status).toBe("unavailable");
    await markSent();
    expect((await verify("AP-2026-FFFFFFFFFFFFFFFFFFFF")).rows[0].status).toBe("invalid");
    expect((await verify()).rows[0].status).toBe("verified");
  });
  it("locks after five incorrect attempts", async () => {
    await prepare(); await markSent();
    for (let i = 0; i < 5; i++) await verify("AP-2026-FFFFFFFFFFFFFFFFFFFF");
    expect((await verify()).rows[0].status).toBe("locked");
  });
  it("rejects expired entries and a forged browser proof", async () => {
    await prepare(); await markSent();
    const forged = await db.query<{ status: string }>(
      "select public.ap_verify_registration_number($1,$2,$3,$4) as status",
      [reservation,email,"b".repeat(64),number],
    );
    expect(forged.rows[0].status).toBe("invalid");
    await db.exec("update public.ap_agency_registration_numbers set expires_at=now()-interval '1 second'");
    expect((await verify()).rows[0].status).toBe("expired");
  });
  it("rejects unverified binding, then binds idempotently to the owner agency", async () => {
    await prepare(); await markSent();
    await expect(bind()).rejects.toThrow("VERIFIED_REGISTRATION_NUMBER_REQUIRED");
    await verify();
    expect((await bind()).rows[0].number).toBe(number);
    expect((await bind()).rows[0].number).toBe(number);
    const otherAgency = "a0000000-0000-4000-8000-000000000006";
    await db.query("insert into public.ap_agencies values($1)", [otherAgency]);
    await db.query("insert into public.ap_agency_memberships values($1,$2,'owner','active')", [otherAgency,user]);
    await expect(bind(user,otherAgency)).rejects.toThrow("ALREADY_USED");
  });
  it("rejects a different confirmed owner even when they know the number", async () => {
    await prepare(); await markSent(); await verify();
    const attacker = "a0000000-0000-4000-8000-000000000007";
    await db.query("insert into auth.users values($1,'other@example.com',now())", [attacker]);
    await db.query("insert into public.ap_agency_memberships values($1,$2,'owner','active')", [agency,attacker]);
    await expect(bind(attacker,agency,"other@example.com")).rejects.toThrow("VERIFIED_REGISTRATION_NUMBER_REQUIRED");
  });
  it("rejects a user without active owner membership", async () => {
    await prepare(); await markSent(); await verify();
    await db.exec("delete from public.ap_agency_memberships");
    await expect(bind()).rejects.toThrow("OWNER_REQUIRED");
  });
  it("blocks direct client reads, inserts and RPC calls", async () => {
    const result = await db.query<{ blocked: boolean }>(`select
      not has_table_privilege('anon','public.ap_agency_registration_numbers','SELECT')
      and not has_table_privilege('authenticated','public.ap_agency_registration_numbers','INSERT')
      and not has_function_privilege('anon','public.ap_prepare_registration_number(uuid,uuid,text,text,text,text)','EXECUTE')
      and not has_function_privilege('authenticated','public.ap_bind_registration_number(uuid,text,uuid,uuid,text)','EXECUTE')
      as blocked`);
    expect(result.rows[0].blocked).toBe(true);
  });
});
