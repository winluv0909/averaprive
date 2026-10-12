import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const owner = "10000000-0000-4000-8000-000000000001";
const claimant = "10000000-0000-4000-8000-000000000002";
const other = "10000000-0000-4000-8000-000000000003";
const agency = "20000000-0000-4000-8000-000000000001";
let db: PGlite;
async function actor(id: string) {
  await db.query("select set_config('test.user',$1,false)", [id]);
}
async function request(id = agency) {
  const result = await db.query<{ id: string }>(
    "select public.ap_request_agency_claim($1,$2) as id",
    [
      id,
      "I represent this company and provide official domain ownership and company records for the reviewer.",
    ],
  );
  return result.rows[0].id;
}
describe("curated agency ownership database workflow", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
 create role anon; create role authenticated;
 create schema auth; create schema ap_private;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
 create table public.ap_agencies(id uuid primary key default gen_random_uuid(),name text,slug text unique,website_url text,country text,about text,status text,published boolean,publication_status text,approved_at timestamptz,published_at timestamptz,demo_profile boolean default false,accepting_inquiries boolean default false);
 create table public.ap_agency_memberships(agency_id uuid references public.ap_agencies(id) on delete cascade,user_id uuid references auth.users(id),role text,status text,updated_at timestamptz,unique(agency_id,user_id));
 create table public.ap_staff_roles(user_id uuid,role text);
 create table public.ap_security_audit(actor_user_id uuid,agency_id uuid,action text,target_type text,target_id text);
 create function ap_private.is_staff(required_roles text[] default null) returns boolean language sql stable security definer as $$ select exists(select 1 from public.ap_staff_roles where user_id=auth.uid() and (required_roles is null or role=any(required_roles))) $$;
 grant usage on schema auth,ap_private to authenticated;
 insert into auth.users values('${owner}'),('${claimant}'),('${other}');
 insert into public.ap_staff_roles values('${owner}','super_admin');
 insert into public.ap_agencies(id,name,slug,status,published,publication_status,demo_profile) values('${agency}','Real Agency','real-agency','approved',true,'published',false),('20000000-0000-4000-8000-000000000099','Demo Agency','demo-agency','approved',true,'published',true);
 `);
    await db.exec(
      readFileSync(
        "supabase/migrations/202610100018_curated_directory_claims.sql",
        "utf8",
      ),
    );
  }, 30000);
  afterAll(async () => {
    await db.close();
  });
  it("removes marked demos and preserves legitimate agencies", async () => {
    const { rows } = await db.query("select name from public.ap_agencies");
    expect(rows).toEqual([{ name: "Real Agency" }]);
  });
  it("rejects anonymous claims and staff claiming agency access", async () => {
    await actor("");
    await expect(request()).rejects.toThrow("Sign in");
    await actor(owner);
    await expect(request()).rejects.toThrow("separate agency account");
  });
  it("keeps claims private and never grants membership on submission", async () => {
    await actor(claimant);
    await request();
    expect(
      (await db.query("select * from public.ap_agency_memberships")).rows,
    ).toHaveLength(0);
    await db.exec("set role authenticated");
    expect(
      (await db.query("select evidence from public.ap_agency_claims")).rows,
    ).toHaveLength(1);
    await actor(other);
    expect(
      (await db.query("select evidence from public.ap_agency_claims")).rows,
    ).toHaveLength(0);
    await expect(
      db.query("update public.ap_agency_claims set status='approved'"),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role");
  });
  it("rejects duplicate pending claims and non-owner approval", async () => {
    await actor(claimant);
    await expect(request()).rejects.toThrow("duplicate key");
    const { rows } = await db.query<{ id: string }>(
      "select id from public.ap_agency_claims limit 1",
    );
    await expect(
      db.query(
        "select ap_review_agency_claim($1,'approved','Reviewed official ownership documents')",
        [rows[0].id],
      ),
    ).rejects.toThrow("Owner reviewer");
  });
  it("approves only one owner and preserves the existing profile", async () => {
    await actor(other);
    const second = await request();
    const { rows } = await db.query<{ id: string }>(
      "select id from public.ap_agency_claims where claimant_user_id=$1",
      [claimant],
    );
    await actor(owner);
    await db.query(
      "select ap_review_agency_claim($1,'approved','Reviewed official ownership documents')",
      [rows[0].id],
    );
    expect(
      (
        await db.query(
          "select agency_id,user_id,role,status from public.ap_agency_memberships",
        )
      ).rows,
    ).toEqual([
      { agency_id: agency, user_id: claimant, role: "owner", status: "active" },
    ]);
    await expect(
      db.query(
        "select ap_review_agency_claim($1,'approved','Reviewed official ownership documents')",
        [second],
      ),
    ).rejects.toThrow("already has an owner");
    expect(
      (await db.query("select id from public.ap_agencies")).rows,
    ).toHaveLength(1);
    await db.query(
      "select ap_review_agency_claim($1,'rejected','The ownership evidence was not sufficient')",
      [second],
    );
    expect(
      (await db.query("select * from public.ap_agency_memberships")).rows,
    ).toHaveLength(1);
  });
  it("only allows owners to publish curated unclaimed listings", async () => {
    await actor(claimant);
    await expect(
      db.query(
        "select ap_add_curated_agency('Another Agency','another-agency','https://example.org','Philippines','An official description with sufficient agency details.')",
      ),
    ).rejects.toThrow("Owner access");
    await actor(owner);
    await db.query(
      "select ap_add_curated_agency('Another Agency','another-agency','https://example.org','Philippines','An official description with sufficient agency details.')",
    );
    expect(
      (
        await db.query(
          "select published,demo_profile from public.ap_agencies where slug='another-agency'",
        )
      ).rows,
    ).toEqual([{ published: true, demo_profile: false }]);
    expect(
      (await db.query("select * from public.ap_agency_memberships")).rows,
    ).toHaveLength(1);
  });
});
