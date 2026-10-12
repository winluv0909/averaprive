import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({required:vi.fn(),signIn:vi.fn(),update:vi.fn(),signOut:vi.fn()}));
vi.mock("@/lib/auth/authorization",()=>({requireStaffRole:m.required}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw new Error(`redirect:${path}`)}}));
import { changePassword } from "../app/owners/account/actions";
function form(current="temporary password",password="my new private password",confirmation=password){const f=new FormData();f.set("current_password",current);f.set("password",password);f.set("confirmation",confirmation);return f;}
beforeEach(()=>{vi.resetAllMocks();m.required.mockResolvedValue({user:{id:"owner",email:"owner@example.test"},supabase:{auth:{signInWithPassword:m.signIn,updateUser:m.update,signOut:m.signOut}}});m.signIn.mockResolvedValue({data:{user:{id:"owner"}},error:null});m.update.mockResolvedValue({error:null});m.signOut.mockResolvedValue({error:null});});
describe("password change action",()=>{
 it("requires authorization before touching auth APIs",async()=>{m.required.mockRejectedValue(new Error("forbidden"));await expect(changePassword(form())).rejects.toThrow("forbidden");expect(m.signIn).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled();});
 it("rejects mismatched passwords without updating the account",async()=>{await expect(changePassword(form("temporary password","my new private password","different"))).rejects.toThrow("redirect:/owners/account?error=");expect(m.update).not.toHaveBeenCalled();});
 it("does not update a password when current-password verification fails",async()=>{m.signIn.mockResolvedValue({error:{message:"invalid"},data:{user:null}});await expect(changePassword(form())).rejects.toThrow("redirect:/owners/account?error=");expect(m.update).not.toHaveBeenCalled();});
 it("signs out globally only after a successful verified password change",async()=>{await expect(changePassword(form())).rejects.toThrow("redirect:/owners/login?changed=1");expect(m.update).toHaveBeenCalledWith({password:"my new private password"});expect(m.signOut).toHaveBeenCalledWith({scope:"global"});});
 it("keeps password setup available when Supabase rejects the update",async()=>{m.update.mockResolvedValue({error:{message:"policy"}});await expect(changePassword(form())).rejects.toThrow("redirect:/owners/account?error=");expect(m.signOut).not.toHaveBeenCalled();});
});
