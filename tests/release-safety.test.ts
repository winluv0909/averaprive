import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Replay the real migration chain. Auth/Storage are minimal stand-ins, not live Supabase.
const db = new PGlite();
const owner = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const finance = "10000000-0000-4000-8000-000000000003";
const moderator = "10000000-0000-4000-8000-000000000004";
const agency = "20000000-0000-4000-8000-000000000001";
const requestId = "30000000-0000-4000-8000-000000000001";

async function asUser(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function trial() {
  return db.query("select public.ap_start_prive_trial($1)", [agency]);
}
async function seedSubscription(plan = "elite", status = "active") {
  await db.exec("reset role");
  await db.query(`insert into public.ap_subscriptions
    (agency_id,plan_code,status,current_period_started_at,current_period_ends_at,commercial_reference)
    values ($1,$2,$3,now(),now()+interval '1 year','paypal:fixture')`, [agency, plan, status]);
  await asUser(owner);
}
async function seedRequest() {
  await db.exec("reset role");
  await db.query(`insert into public.ap_plan_change_requests
    (id,agency_id,requested_plan,requested_by) values($1,$2,'elite',$3)`, [requestId, agency, owner]);
}
async function decide(decision: string | null = "approved", note = "Reviewed commercial reference", reference = "fixture-reference") {
  // Match the named RPC contract used by the application.
  return db.query(`select public.ap_decide_plan_request(
    request_id=>$1,decision=>$2,decision_note=>$3,commercial_ref=>$4)`, [requestId, decision, note, reference]);
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
  await db.exec("reset role; truncate public.ap_agencies, auth.users cascade");
  for (const id of [owner, other, finance, moderator]) {
    await db.query("insert into auth.users(id,email,encrypted_password) values($1,$2,'initial')", [id, `${id}@example.com`]);
  }
  await db.query("insert into public.ap_staff_roles(user_id,role) values($1,'finance'),($2,'moderator')", [finance, moderator]);
  await db.exec("update auth.users set encrypted_password='rotated' where encrypted_password='initial'");
  await db.query(`insert into public.ap_agencies(id,name,slug,country,services,about)
    values($1,'Fixture agency','fixture-agency','Philippines',array['Management'],repeat('x',80))`, [agency]);
  await db.query("insert into public.ap_agency_memberships(agency_id,user_id,role) values($1,$2,'owner')", [agency, owner]);
  // Profile submission now requires a verified number bound to its active owner.
  await db.query(`insert into public.ap_agency_registration_numbers
    (id,email,proof_hash,registration_number,delivery_status,verified_at,agency_id,owner_user_id,bound_at)
    values(gen_random_uuid(),$1,repeat('a',64),'AP-2026-0123456789ABCDEF0123','sent',now(),$2,$3,now())`,
    [`${owner}@example.com`, agency, owner]);
  await asUser(owner);
});
afterAll(async () => { await db.close(); });

describe("subscription trial protection", () => {
  it("starts exactly one seven-day trial for a new eligible agency and audits it", async () => {
    await trial();
    const row = (await db.query<{ plan_code: string; status: string; days: number }>(`select plan_code,status,
      extract(epoch from (trial_ends_at-trial_started_at))/86400 as days
      from public.ap_subscriptions where agency_id=$1`, [agency])).rows[0];
    expect(row.plan_code).toBe("prive"); expect(row.status).toBe("trialing"); expect(Number(row.days)).toBe(7);
    await expect(trial()).rejects.toThrow("already been used");
    await db.exec("reset role");
    expect((await db.query<{ count: number }>("select count(*)::integer as count from public.ap_security_audit where action='subscription.trial_started'")).rows[0].count).toBe(1);
  });
  it("allows an untouched free subscription without replacing its ID", async () => {
    await db.exec("reset role");
    const id = (await db.query<{ id: string }>("insert into public.ap_subscriptions(agency_id) values($1) returning id", [agency])).rows[0].id;
    await asUser(owner); await trial();
    expect((await db.query<{ id: string }>("select id from public.ap_subscriptions where agency_id=$1", [agency])).rows[0].id).toBe(id);
  });
  it.each(["prive", "select", "elite"])("preserves an active paid %s subscription, dates and payment reference", async plan => {
    await seedSubscription(plan);
    const before = (await db.query("select * from public.ap_subscriptions where agency_id=$1", [agency])).rows[0];
    await expect(trial()).rejects.toThrow("before a paid subscription");
    expect((await db.query("select * from public.ap_subscriptions where agency_id=$1", [agency])).rows[0]).toEqual(before);
  });
  it("does not turn a cancelled paid subscription into a trial", async () => {
    await seedSubscription("elite", "cancelled");
    await expect(trial()).rejects.toThrow("before a paid subscription");
  });
  it("keeps prior trial usage even after returning to Free", async () => {
    await db.exec("reset role");
    await db.query(`insert into public.ap_subscriptions(agency_id,trial_started_at,trial_ends_at)
      values($1,now()-interval '1 month',now()-interval '23 days')`, [agency]);
    await asUser(owner); await expect(trial()).rejects.toThrow("already been used");
  });
  it("rejects another account and platform staff even if staff have an agency membership", async () => {
    await asUser(other); await expect(trial()).rejects.toThrow("Agency billing access required");
    await db.exec("reset role");
    await db.query("insert into public.ap_agency_memberships(agency_id,user_id,role) values($1,$2,'billing')", [agency, finance]);
    await asUser(finance); await expect(trial()).rejects.toThrow("Agency billing access required");
  });
  it("gives a billing member trial access but rejects an editor", async () => {
    await db.exec("reset role");
    await db.query("insert into public.ap_agency_memberships(agency_id,user_id,role) values($1,$2,'editor')", [agency, other]);
    await asUser(other); await expect(trial()).rejects.toThrow("Agency billing access required");
    await db.exec("reset role"); await db.query("update public.ap_agency_memberships set role='billing' where user_id=$1", [other]);
    await asUser(other); await trial();
  });
});

describe("manual subscription decisions", () => {
  it("allows finance approval using existing named arguments, stores its note and audits once", async () => {
    await seedRequest(); await asUser(finance); await decide();
    const row = (await db.query<{ status: string; decision_note: string; decided_by: string }>("select status,decision_note,decided_by from public.ap_plan_change_requests where id=$1", [requestId])).rows[0];
    expect(row).toEqual({ status: "approved", decision_note: "Reviewed commercial reference", decided_by: finance });
    const subscription = (await db.query<{ plan_code: string; status: string; commercial_reference: string }>("select plan_code,status,commercial_reference from public.ap_subscriptions where agency_id=$1", [agency])).rows[0];
    expect(subscription).toEqual({ plan_code: "elite", status: "active", commercial_reference: "fixture-reference" });
    await expect(decide()).rejects.toThrow("Pending request not found");
    expect((await db.query<{ count: number }>("select count(*)::integer as count from public.ap_security_audit where action='subscription.plan_decided'")).rows[0].count).toBe(1);
  });
  it("declines without altering an existing paid subscription", async () => {
    await seedSubscription(); await seedRequest(); await asUser(finance);
    const before = (await db.query("select * from public.ap_subscriptions where agency_id=$1", [agency])).rows[0];
    await decide("declined");
    expect((await db.query("select * from public.ap_subscriptions where agency_id=$1", [agency])).rows[0]).toEqual(before);
  });
  it("rejects agency accounts, moderators, invalid decisions and short notes", async () => {
    await seedRequest(); await asUser(owner); await expect(decide()).rejects.toThrow("operations access required");
    await asUser(moderator); await expect(decide()).rejects.toThrow("operations access required");
    await asUser(finance); await expect(decide(null)).rejects.toThrow("valid decision");
    await expect(decide("approved", "short")).rejects.toThrow("valid decision");
  });
});

describe("agency column permissions", () => {
  it("allows signup provisioning fields and normal profile editing with SELECT * still available", async () => {
    await db.query(`update public.ap_agencies set name='Edited agency',country='Philippines',city='Manila',
      website_url='https://example.com',logo_url='https://example.com/logo.png',services=array['Management'],
      creator_niches=array['Fitness'],regions_served=array['Asia'],employee_count_range='1–5',founded_year=2020,
      languages=array['English'],positioning_statement='Independent management services',about=repeat('x',80),
      social_links='{}',updated_at=now() where id=$1 returning id`, [agency]);
    expect((await db.query<{ name: string }>("select * from public.ap_agencies where id=$1", [agency])).rows[0].name).toBe("Edited agency");
  });
  it.each(["status", "approved_at", "publication_status", "published", "directory_information", "slug", "id", "demo_profile"])("denies direct updates to %s", async column => {
    await expect(db.query(`update public.ap_agencies set ${column}=${column} where id=$1`, [agency])).rejects.toThrow(/permission denied/i);
  });
  it("keeps RLS boundaries for unrelated users and submitted profiles", async () => {
    await asUser(other);
    expect((await db.query("update public.ap_agencies set name='Unrelated edit' where id=$1 returning id", [agency])).rows).toHaveLength(0);
    await asUser(owner); await db.query("select public.ap_submit_agency_for_review($1)", [agency]);
    expect((await db.query("update public.ap_agencies set name='Late edit' where id=$1 returning id", [agency])).rows).toHaveLength(0);
  });
  it("keeps trusted moderation, publication and server updates working", async () => {
    await db.query("select public.ap_submit_agency_for_review($1)", [agency]);
    await asUser(moderator);
    await db.query("select public.ap_review_agency_submission($1,'approve','Reviewed agency information')", [agency]);
    await db.query("select public.ap_publish_agency($1)", [agency]);
    expect((await db.query<{ published: boolean }>("select published from public.ap_agencies where id=$1", [agency])).rows[0].published).toBe(true);
    await db.exec("reset role; set role service_role");
    await db.query("update public.ap_agencies set directory_information=$2 where id=$1", [agency, { owner_reviewed_source: "https://example.com" }]);
  });
  it("denies anonymous writes and anonymous execution of subscription operations", async () => {
    await db.exec("reset role; set role anon");
    await expect(db.query("update public.ap_agencies set name='Anonymous' where id=$1", [agency])).rejects.toThrow(/permission denied/i);
    await expect(trial()).rejects.toThrow(/permission denied/i);
    await expect(decide()).rejects.toThrow(/permission denied/i);
  });
  it("removes legacy column grants on reapplication without changing stored records", async () => {
    await seedSubscription(); await seedRequest(); await db.exec("reset role");
    const before = (await db.query("select row_to_json(a) as record from public.ap_agencies a where id=$1", [agency])).rows;
    const beforeSubscription = (await db.query("select row_to_json(s) as record from public.ap_subscriptions s where agency_id=$1", [agency])).rows;
    await db.exec("grant update(directory_information) on public.ap_agencies to authenticated");
    const directory = join(process.cwd(), "supabase/migrations");
    for (const name of readdirSync(directory).filter(name => /_(protect_subscription_trials_and_decisions|restrict_agency_profile_update_columns)\.sql$/.test(name)).sort()) {
      await db.exec(readFileSync(join(directory, name), "utf8"));
    }
    expect((await db.query("select row_to_json(a) as record from public.ap_agencies a where id=$1", [agency])).rows).toEqual(before);
    expect((await db.query("select row_to_json(s) as record from public.ap_subscriptions s where agency_id=$1", [agency])).rows).toEqual(beforeSubscription);
    await asUser(owner);
    await expect(db.query("update public.ap_agencies set directory_information='{}' where id=$1", [agency])).rejects.toThrow(/permission denied/i);
  });
});
