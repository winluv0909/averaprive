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
describe("reviewed claim profile workflow", () => {
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
    await db.exec(`
 alter table public.ap_agencies add column city text,add column services text[] default '{}',add column social_links jsonb default '{}',add column updated_at timestamptz,add column tagline text,add column positioning_statement text,add column logo_url text,add column cover_image_url text,add column creator_niches text[],add column regions_served text[],add column category text,add column founded_year integer,add column employee_count_range text,add column languages text[],add column ideal_client text,add column minimum_requirements text,add column demo_reputation_score numeric,add column demo_review_count integer;
 alter table public.ap_security_audit add column metadata jsonb;
 create table public.ap_verifications(agency_id uuid,status text);
 create table public.ap_reviews(agency_id uuid,status text,rating numeric);
 create table public.ap_external_ratings(agency_id uuid,platform text,rating numeric,review_count integer,rating_status text,is_demo boolean);
 `);
    await db.exec(readFileSync("supabase/migrations/202610100019_claim_profile_review.sql","utf8"));
  }, 30000);
  afterAll(async () => {
    await db.close();
  });

  async function snapshot() {
    return (await db.query<{ profile: Record<string,unknown> }>("select ap_private.claim_profile_snapshot($1) profile",[agency])).rows[0].profile;
  }
  async function submit(profile: unknown, confirmed = true) {
    return (await db.query<{id:string}>("select ap_request_agency_claim_reviewed($1,$2,'Jane Doe','Director','jane@agency.example',$3,'',$4) id",[agency,"Official domain ownership evidence and authority documents are supplied for independent review.",confirmed,profile])).rows[0].id;
  }
  const checks={identity:true,authority:true,contact:true,information:true};
  let claimId:string;
  it("blocks legacy calls, unconfirmed profiles and stale submission snapshots",async()=>{
    await actor(claimant);
    await expect(db.query("select ap_request_agency_claim($1,'old evidence')",[agency])).rejects.toThrow("updated claim form");
    await expect(submit(await snapshot(),false)).rejects.toThrow("Review and confirm");
    await expect(submit({})).rejects.toThrow("profile changed");
    claimId=await submit(await snapshot());
    expect((await db.query("select * from ap_agency_memberships")).rows).toHaveLength(0);
  });
  it("requires owner access and every approval check, including when calling the legacy reviewer",async()=>{
    await expect(db.query("select ap_review_agency_claim_checked($1,'approved','Checked the official evidence',$2,$3)",[claimId,checks,await snapshot()])).rejects.toThrow("Owner reviewer");
    await actor(owner);
    await expect(db.query("select ap_review_agency_claim($1,'approved','Checked the official evidence')",[claimId])).rejects.toThrow("four reviewer checks");
    await expect(db.query("select ap_review_agency_claim_checked($1,'approved','Checked the official evidence',$2,$3)",[claimId,{...checks,contact:false},await snapshot()])).rejects.toThrow("all four");
    await expect(db.query("select ap_review_agency_claim_checked($1,'approved','Checked the official evidence',$2,'{}')",[claimId,checks])).rejects.toThrow("Profile changed");
  });
  it("protects correction writes and records reviewed corrections without granting ownership",async()=>{
    const profile=await snapshot();
    const changes={name:'Real Agency',website_url:'https://agency.example',about:'Reviewed agency description supported by official business sources.',country:'United States',city:'',services:['Creator management'],directory_information:{legal_name:'Real Agency LLC'}};
    await actor(other);
    await expect(db.query("select ap_correct_curated_profile($1,$2,$3,'https://agency.example/about','Confirmed official source')",[agency,changes,profile])).rejects.toThrow("Owner reviewer");
    await actor(owner);
    await expect(db.query("select ap_correct_curated_profile($1,null,$2,null,'Confirmed official source')",[agency,profile])).rejects.toThrow("Valid profile details");
    await db.query("select ap_correct_curated_profile($1,$2,$3,'https://agency.example/about','Confirmed official source')",[agency,changes,profile]);
    expect((await snapshot()).directory_information).toMatchObject({legal_name:'Real Agency LLC',owner_reviewed_source:'https://agency.example/about'});
    expect((await db.query("select * from ap_agency_memberships")).rows).toHaveLength(0);
    await expect(db.query("select ap_review_agency_claim_checked($1,'approved','Checked the official evidence',$2,$3)",[claimId,checks,profile])).rejects.toThrow("Profile changed");
  });
  it("approves the existing profile only after current information and all checks are confirmed",async()=>{
    await actor(owner);
    await db.query("select ap_review_agency_claim_checked($1,'approved','Business identity, authority, contact and profile were independently checked',$2,$3)",[claimId,checks,await snapshot()]);
    expect((await db.query("select user_id,role,status from ap_agency_memberships")).rows).toEqual([{user_id:claimant,role:'owner',status:'active'}]);
    expect((await db.query("select * from ap_verifications")).rows).toHaveLength(0);
    expect((await db.query("select id from ap_agencies")).rows).toHaveLength(1);
  });
  it("imports reviewed candidates idempotently, withholds the template listing and preserves owned information",async()=>{
    const add=readFileSync("research/add-50-agencies.sql","utf8");
    const enrich=readFileSync("research/enrich-researched-profiles.sql","utf8");
    await db.exec(add);
    await db.exec(enrich);
    expect((await db.query("select id from ap_agencies where slug='toagency'")).rows).toHaveLength(0);
    expect((await db.query("select id from ap_agencies")).rows).toHaveLength(50);
    expect((await db.query<{d:Record<string,unknown>}>("select directory_information d from ap_agencies where slug='fem-management'")).rows[0].d.public_email).toBe('info@fem-management.com');
    await db.exec("update ap_agencies set directory_information='{}' where slug='creators-inc'; insert into ap_agency_memberships(agency_id,user_id,role,status) select id,'10000000-0000-4000-8000-000000000003','owner','active' from ap_agencies where slug='creators-inc'");
    await db.exec(add);
    await db.exec(enrich);
    expect((await db.query("select directory_information from ap_agencies where slug='creators-inc'")).rows).toEqual([{directory_information:{}}]);
    expect((await db.query("select id from ap_agencies")).rows).toHaveLength(50);
  });
});
