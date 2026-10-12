import { describe, expect, it, beforeEach, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { platformHome, needsPasswordChange, passwordError } from "../lib/auth/platform-access";

const mocks=vi.hoisted(()=>({user:{id:"u",app_metadata:{} as Record<string,unknown>},roles:[{role:"super_admin"}],error:null as unknown}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:mocks.user}})},from:()=>({select:()=>({eq:async()=>({data:mocks.roles,error:mocks.error})})})})}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw new Error(`redirect:${path}`)}}));
import { requireStaffRole } from "../lib/auth/authorization";

describe("platform permission boundaries",()=>{
 beforeEach(()=>{mocks.user={id:"u",app_metadata:{}};mocks.roles=[{role:"super_admin"}];mocks.error=null;});
 it("blocks pending owners even with their real role",async()=>{mocks.user.app_metadata.platform_password_change_required=true;await expect(requireStaffRole(["super_admin"])).rejects.toThrow("redirect:/owners/account");});
 it("allows the password setup page without allowing the dashboard",async()=>{mocks.user.app_metadata.platform_password_change_required=true;expect((await requireStaffRole(["super_admin"],{allowPasswordSetup:true})).user.id).toBe("u");});
 it("does not let moderators invoke owner-only operations",async()=>{mocks.roles=[{role:"moderator"}];await expect(requireStaffRole(["super_admin"])).rejects.toThrow("redirect:/forbidden");});
 it("fails closed when the role lookup errors",async()=>{mocks.error={message:"unavailable"};await expect(requireStaffRole(["super_admin"])).rejects.toThrow("redirect:/forbidden");});
 it("allows moderators their own operations",async()=>{mocks.roles=[{role:"moderator"}];expect((await requireStaffRole(["super_admin","moderator"])).role).toBe("moderator");});
 it("routes supported staff to permitted landing pages",()=>{expect(platformHome(["support"])).toBe("/owners/dashboard/support");expect(platformHome(["finance"])).toBe("/owners/dashboard/payments");expect(platformHome(["moderator"])).toBe("/owners/dashboard/moderation");expect(platformHome(["verification_reviewer"])).toBe("/owners/dashboard/verifications");expect(platformHome(["moderator","super_admin"])).toBe("/owners/dashboard");});
 it("ignores user-editable metadata for the setup decision",()=>{expect(needsPasswordChange({platform_password_change_required:true})).toBe(true);expect(needsPasswordChange({})).toBe(false);expect(passwordError("short","short")).toBeTruthy();expect(passwordError("a private long password","different")).toBeTruthy();});
});

describe("database password setup enforcement",()=>{
 it("requires setup, blocks database staff privileges, and unlocks only after a password change",async()=>{
  const db=new PGlite();
  try {
   await db.exec(`create schema auth; create schema ap_private; create role anon; create role authenticated;
    create table auth.users(id uuid primary key,encrypted_password text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
    create table public.ap_staff_roles(id uuid primary key,user_id uuid references auth.users(id),role text);
    create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
    insert into auth.users(id,encrypted_password) values ('00000000-0000-0000-0000-000000000001','temporary-hash');
    insert into ap_staff_roles values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','super_admin');`);
   await db.exec(readFileSync(new URL("../supabase/migrations/202610120027_platform_password_setup.sql",import.meta.url),"utf8"));
   expect((await db.query<{allowed:boolean}>("select ap_private.is_staff(array['super_admin']) allowed")).rows[0].allowed).toBe(false);
   await db.exec("update auth.users set raw_user_meta_data=jsonb_build_object('platform_password_change_required',false)");
   expect((await db.query<{allowed:boolean}>("select ap_private.is_staff(null) allowed")).rows[0].allowed).toBe(false);
   await db.exec("update auth.users set encrypted_password='private-new-hash'");
   expect((await db.query<{allowed:boolean}>("select ap_private.is_staff(array['super_admin']) allowed")).rows[0].allowed).toBe(true);
   expect((await db.query<{allowed:boolean}>("select ap_private.is_staff(array['finance']) allowed")).rows[0].allowed).toBe(false);
   await db.exec(`insert into auth.users(id,encrypted_password) values ('00000000-0000-0000-0000-000000000003','staff-temp');
    insert into ap_staff_roles values ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','moderator');`);
   expect((await db.query<{pending:boolean}>("select (raw_app_meta_data->>'platform_password_change_required')::boolean pending from auth.users where id='00000000-0000-0000-0000-000000000003'")).rows[0].pending).toBe(true);
  }finally{await db.close();}
 },60000);
});
