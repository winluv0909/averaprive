import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const m=vi.hoisted(()=>({create:vi.fn(),exchange:vi.fn(),verify:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:m.create}));
import {GET} from "@/app/auth/recovery/route";
beforeEach(()=>{vi.resetAllMocks();m.create.mockResolvedValue({auth:{exchangeCodeForSession:m.exchange,verifyOtp:m.verify}});m.exchange.mockResolvedValue({data:{user:{id:"u"}},error:null});m.verify.mockResolvedValue({data:{user:{id:"u"}},error:null});});
describe("recovery callback",()=>{
 it("rejects missing or wrong-type tokens before initializing auth",async()=>{for(const path of ["/auth/recovery","/auth/recovery?token_hash=hash&type=signup"]){expect((await GET(new NextRequest('https://averaprive.vercel.app'+path))).headers.get('location')).toContain('/forgot-password?error=');}expect(m.create).not.toHaveBeenCalled();});
 it("exchanges PKCE codes through the recovery route",async()=>{expect((await GET(new NextRequest('https://averaprive.vercel.app/auth/recovery?code=valid'))).headers.get('location')).toBe('https://averaprive.vercel.app/reset-password');expect(m.exchange).toHaveBeenCalledWith('valid');});
 it("verifies a recovery token without relying on the initiating browser",async()=>{expect((await GET(new NextRequest('https://averaprive.vercel.app/auth/recovery?token_hash=hash&type=recovery'))).headers.get('location')).toContain('/reset-password');expect(m.verify).toHaveBeenCalledWith({token_hash:'hash',type:'recovery'});});
 it("returns a usable recovery error if auth throws",async()=>{m.exchange.mockRejectedValue(new Error('outage'));expect((await GET(new NextRequest('https://averaprive.vercel.app/auth/recovery?code=bad'))).headers.get('location')).toContain('/forgot-password?error=');});
});
