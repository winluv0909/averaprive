import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const db = new PGlite();
const owner = "70000000-0000-4000-8000-000000000001";
const other = "70000000-0000-4000-8000-000000000002";
const admin = "70000000-0000-4000-8000-000000000003";
const agency = "71000000-0000-4000-8000-000000000001";
const otherAgency = "71000000-0000-4000-8000-000000000002";
const reservation = "72000000-0000-4000-8000-000000000001";
const number = "AP-2026-0123456789ABCDEF0123";
const email = "owner@example.com";
const checks = '{"identity":true,"authority":true,"contact":true,"information":true}';
async function asUser(id = owner) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function submit(id = agency) {
  return db.query("select public.ap_submit_agency_for_review(target_agency=>$1)", [id]);
}
async function seedNumber(target = agency, user = owner) {
  await db.exec("reset role");
  await db.query(`insert into public.ap_agency_registration_numbers
    (id,email,proof_hash,registration_number,delivery_status,verified_at,agency_id,owner_user_id,bound_at)
    values($1,$2,repeat('a',64),$3,'sent',now(),$4,$5,now())`, [reservation,email,number,target,user]);
  await asUser();
}
async function seedClaim(status = "approved", claimant = owner) {
  await db.exec("reset role");
  await db.query(`insert into public.ap_agency_claims
    (agency_id,claimant_user_id,evidence,status,reviewed_by,reviewed_at,profile_confirmed,reviewer_checks,reviewed_snapshot)
    values($1,$2,repeat('e',40),$3,$4,now(),true,$5::jsonb,'{}'::jsonb)`, [agency,claimant,status,admin,checks]);
  await asUser();
}
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb,raw_app_meta_data jsonb,email text,encrypted_password text);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key,bucket_id text,name text,owner uuid,metadata jsonb);
    alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    grant all on all tables in schema public,storage to service_role;
    alter default privileges in schema public grant all on tables to service_role;
    alter default privileges in schema public grant all on sequences to service_role;
    alter default privileges in schema public grant all on functions to service_role;`);
  const directory = join(process.cwd(), "supabase/migrations");
  for (const name of readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) {
    // PGlite already provides the UUID function; pgcrypto is not installed in this fixture.
    await db.exec(readFileSync(join(directory, name), "utf8").replace(/create extension if not exists pgcrypto;/gi, ""));
  }
}, 60_000);


beforeEach(async () => {
  await db.exec("reset role; truncate public.ap_agencies,auth.users cascade");
  for (const id of [owner,other,admin]) {
    await db.query("insert into auth.users(id,email) values($1,$2)", [id,id===owner ? email : `${id}@example.com`]);
  }
  await db.query(`insert into public.ap_agencies(id,name,slug,country,services,about)
    values($1,'Safety fixture','safety-fixture','Philippines',array['Management'],repeat('x',80)),
      ($2,'Other fixture','other-fixture','Philippines',array['Management'],repeat('x',80))`, [agency,otherAgency]);
  await db.query(`insert into public.ap_agency_memberships(agency_id,user_id,role,status)
    values($1,$2,'owner','active'),($3,$2,'owner','active'),($1,$4,'admin','active')`, [agency,owner,otherAgency,admin]);
  await asUser();
});
afterAll(async () => { await db.close(); });

describe("registration number submission safeguard", () => {
  it("blocks a complete draft without a bound number and leaves no side effects", async () => {
    await expect(submit()).rejects.toThrow("registration number before submitting");
    await db.exec("reset role");
    expect((await db.query<{ publication_status: string }>("select publication_status from public.ap_agencies where id=$1",[agency])).rows[0].publication_status).toBe("draft");
    expect((await db.query<{ count: number }>("select count(*)::int count from public.ap_moderation_cases")).rows[0].count).toBe(0);
    expect((await db.query<{ count: number }>("select count(*)::int count from public.ap_security_audit where action='agency.submitted'")).rows[0].count).toBe(0);
  });
  it("ignores forged signup metadata", async () => {
    await db.exec("reset role");
    await db.query(`update auth.users set raw_user_meta_data=$1::jsonb where id=$2`, [JSON.stringify({onboarding_provisioned:true,onboarding_profile:{registrationNumber:number,registrationReservationId:reservation}}),owner]);
    await asUser(); await expect(submit()).rejects.toThrow("registration number before submitting");
  });
  it("permits a draft before binding, then the real server-only bind and submission", async () => {
    const created = await db.query<{ id: string }>("select public.ap_create_agency_draft('New agency','new-agency') id");
    const id = created.rows[0].id;
    await db.query(`update public.ap_agencies set country='Philippines',about=repeat('x',80),services=array['Management'] where id=$1`,[id]);
    await expect(submit(id)).rejects.toThrow("registration number before submitting");
    await db.exec("reset role");
    await db.query(`insert into public.ap_agency_registration_numbers(id,email,proof_hash,registration_number,delivery_status,verified_at)
      values($1,$2,repeat('a',64),$3,'sent',now())`,[reservation,email,number]);
    await db.exec("set role service_role");
    await db.query("select public.ap_bind_registration_number($1,$2,$3,$4,$5)",[reservation,number,owner,id,email]);
    await asUser(); await submit(id);
    await db.exec("reset role");
    expect((await db.query<{ publication_status: string }>("select publication_status from public.ap_agencies where id=$1",[id])).rows[0].publication_status).toBe("submitted");
  });
  it("does not accept a number bound to a different agency", async () => {
    await seedNumber(otherAgency); await expect(submit()).rejects.toThrow("registration number before submitting");
  });
  it.each(["verified_at=null", "delivery_status='failed'", "agency_id=null,bound_at=null", "owner_user_id=null"])("rejects an invalid number record: %s", async assignment => {
    await seedNumber(); await db.exec("reset role");
    await db.exec(`update public.ap_agency_registration_numbers set ${assignment}`);
    await asUser(); await expect(submit()).rejects.toThrow("registration number before submitting");
  });
  it("rejects a number belonging to an inactive owner", async () => {
    await seedNumber(); await db.exec("reset role");
    await db.query("update public.ap_agency_memberships set status='revoked' where agency_id=$1 and user_id=$2",[agency,owner]);
    await asUser(admin); await expect(submit()).rejects.toThrow("registration number before submitting");
  });
  it("allows an agency admin to submit after its owner has bound a number", async () => {
    await seedNumber(); await asUser(admin); await submit();
  });
  it("keeps a bound number valid after its original email-entry window expires", async () => {
    await seedNumber(); await db.exec("reset role");
    await db.exec("update public.ap_agency_registration_numbers set expires_at=now()-interval '1 year',verified_at=now()-interval '1 year'");
    await asUser(); await submit();
  });
  it("allows resubmission after changes are requested without duplicating a submission", async () => {
    await seedNumber(); await db.exec("reset role");
    await db.query("update public.ap_agencies set publication_status='changes_requested' where id=$1",[agency]);
    await asUser(); await submit();
    await expect(submit()).rejects.toThrow("current state");
    await db.exec("reset role");
    expect((await db.query<{ count: number }>("select count(*)::int count from public.ap_moderation_cases")).rows[0].count).toBe(1);
    expect((await db.query<{ count: number }>("select count(*)::int count from public.ap_security_audit where action='agency.submitted'")).rows[0].count).toBe(1);
  });
  it("preserves the independently reviewed curated-profile claim route", async () => {
    await seedClaim(); await submit();
  });
  it.each(["pending","rejected"])("rejects a %s claim as an alternative to a number", async status => {
    await seedClaim(status); await expect(submit()).rejects.toThrow("registration number before submitting");
  });
  it("rejects a claim from someone who is no longer the active owner", async () => {
    await seedClaim("approved",other); await expect(submit()).rejects.toThrow("registration number before submitting");
  });
  it("rejects legacy or incomplete claim evidence", async () => {
    await seedClaim(); await db.exec("reset role");
    await db.exec("update public.ap_agency_claims set reviewer_checks=null,reviewed_snapshot=null");
    await asUser(); await expect(submit()).rejects.toThrow("registration number before submitting");
  });
  it("still checks profile completeness and caller authorization", async () => {
    await seedNumber(); await db.exec("reset role");
    await db.query("update public.ap_agencies set about='short' where id=$1",[agency]);
    await asUser(); await expect(submit()).rejects.toThrow("Complete the agency");
    await asUser(other); await expect(submit()).rejects.toThrow("owner or administrator");
    await asUser(""); await expect(submit()).rejects.toThrow("Authentication required");
  });
  it("keeps the number and claim records protected against client forgery", async () => {
    await db.exec("reset role");
    for (const role of ["anon","authenticated"]) {
      for (const table of ["ap_agency_registration_numbers","ap_agency_claims"]) {
        expect((await db.query<{ permitted: boolean }>("select has_table_privilege($1,$2,'INSERT,UPDATE') permitted",[role,`public.${table}`])).rows[0].permitted).toBe(false);
      }
    }
    await db.exec("set role anon"); await expect(submit()).rejects.toThrow("permission denied");
  });
  it("runs the supplied read-only installation checks successfully", async () => {
    await db.exec("reset role");
    const preflight = await db.exec(readFileSync("database/step-03-preflight.sql","utf8"));
    expect(preflight[0].rows).toHaveLength(8);
    const verified = await db.exec(readFileSync("database/step-03-verify.sql","utf8"));
    expect(verified[0].rows).toHaveLength(8);
    for (const row of verified[0].rows as { check_name: string; passed: boolean }[]) {
      expect(row.passed, row.check_name).toBe(true);
    }
  });
  it("installing the safeguard preserves existing agencies, numbers, claims and audit records", async () => {
    await seedNumber(); await seedClaim(); await db.exec("reset role");
    const tables = ["ap_agencies","ap_agency_memberships","ap_agency_registration_numbers","ap_agency_claims","ap_security_audit"];
    const snapshot = async () => Promise.all(tables.map(table => db.query(`select * from public.${table} order by id`)));
    const before = await snapshot();
    const directory = join(process.cwd(),"supabase/migrations");
    const file = readdirSync(directory).find(name => name.endsWith("_require_registration_number_for_submission.sql"));
    if (!file) throw new Error("Missing registration submission migration");
    await db.exec(readFileSync(join(directory,file),"utf8"));
    expect(await snapshot()).toEqual(before);
  });

});
