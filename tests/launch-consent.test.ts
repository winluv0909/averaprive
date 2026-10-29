import {afterAll,beforeAll,describe,it,expect} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
const db=new PGlite();
const id="10000000-0000-4000-8000-000000000001";
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema ap_private;create table ap_agencies(id uuid,published boolean,demo_profile boolean);create table ap_marketplace_events(agency_id uuid,event_type text,session_id text,page_path text,source text,consent_state text,occurred_at timestamptz default now());insert into ap_agencies values('${id}',true,false);create function ap_assign_shared_crypto_deposit(text,text,uuid,text) returns void language sql as $$select$$;grant execute on function ap_assign_shared_crypto_deposit(text,text,uuid,text) to authenticated;`);
 await db.exec(readFileSync("database/step-09-install.sql","utf8"));
},30000);
afterAll(async()=>{await db.close();});
describe("optional analytics database boundary",()=>{
 it("ignores absent or rejected consent, records opt-in once",async()=>{
  for(const consent of [null,false])await db.query("select ap_record_marketplace_event($1,'profile_view','visitor_session_1234','/profile','organic',$2)",[id,consent]);
  expect((await db.query("select * from ap_marketplace_events")).rows).toHaveLength(0);
  for(let i=0;i<2;i++)await db.query("select ap_record_marketplace_event($1,'profile_view','visitor_session_1234','/profile','organic',true)",[id]);
  expect((await db.query("select consent_state from ap_marketplace_events")).rows).toEqual([{consent_state:"analytics"}]);
 });
 it("revokes retired client payment controls",async()=>{expect((await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','ap_assign_shared_crypto_deposit(text,text,uuid,text)','EXECUTE') allowed")).rows[0].allowed).toBe(false);});
});
