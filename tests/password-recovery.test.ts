import {afterEach,beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({reset:vi.fn(),getUser:vi.fn(),update:vi.fn(),signOut:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw new Error(path);}}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{resetPasswordForEmail:m.reset,getUser:m.getUser,updateUser:m.update,signOut:m.signOut}})}));
import {requestReset} from "@/app/forgot-password/actions";
import {savePassword} from "@/app/reset-password/actions";
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("NEXT_PUBLIC_SITE_URL","https://averaprive.vercel.app");m.reset.mockResolvedValue({error:null});m.getUser.mockResolvedValue({data:{user:{id:"user"}},error:null});m.update.mockResolvedValue({error:null});m.signOut.mockResolvedValue({error:null});});
afterEach(()=>vi.unstubAllEnvs());
function form(values:Record<string,string>){const f=new FormData();for(const [k,v]of Object.entries(values))f.set(k,v);return f;}
it("sends reset email to the isolated recovery callback",async()=>{await expect(requestReset(form({email:"person@example.com"}))).rejects.toThrow("/forgot-password?sent=1");expect(m.reset).toHaveBeenCalledWith("person@example.com",{redirectTo:"https://averaprive.vercel.app/auth/recovery"});});
it("does not expose whether the email request failed",async()=>{m.reset.mockResolvedValue({error:{message:"unknown email"}});await expect(requestReset(form({email:"person@example.com"}))).rejects.toThrow("/forgot-password?sent=1");});
it("rejects malformed emails",async()=>{await expect(requestReset(form({email:"bad"}))).rejects.toThrow("valid%20email");expect(m.reset).not.toHaveBeenCalled();});
it("requires server-verified authentication before password changes",async()=>{m.getUser.mockResolvedValue({data:{user:null},error:null});await expect(savePassword(form({password:"longpassword123",confirmation:"longpassword123"}))).rejects.toThrow("recovery%20link");expect(m.update).not.toHaveBeenCalled();});
it("rejects mismatched passwords",async()=>{await expect(savePassword(form({password:"longpassword123",confirmation:"differentpassword"}))).rejects.toThrow("do%20not%20match");expect(m.update).not.toHaveBeenCalled();});
it("revokes sessions after saving the password",async()=>{await expect(savePassword(form({password:"longpassword123",confirmation:"longpassword123"}))).rejects.toThrow("/reset-password?done=1");expect(m.update).toHaveBeenCalledWith({password:"longpassword123"});expect(m.signOut).toHaveBeenCalledWith({scope:"global"});});
it("does not report success when updating fails",async()=>{m.update.mockResolvedValue({error:{message:"policy"}});await expect(savePassword(form({password:"longpassword123",confirmation:"longpassword123"}))).rejects.toThrow("could%20not%20be%20updated");expect(m.signOut).not.toHaveBeenCalled();});
