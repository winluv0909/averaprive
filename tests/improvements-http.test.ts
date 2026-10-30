import {beforeEach, describe, expect, it, vi} from 'vitest';
import {boundedJson, RequestBodyError} from '@/lib/http/bounded-json';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/server', () => ({createClient:async()=>({rpc})}));
import {POST} from '@/app/api/marketplace/inquiry/route';
const payload = {name:'Test Person',email:'person@example.com',message:'A sufficiently detailed inquiry message.',consent:true,agencyId:'fixture',sessionId:'session_fixture'};
function request(body: unknown = payload, headers: Record<string,string> = {}) {
 return new Request('https://averaprive.vercel.app/api/marketplace/inquiry',{method:'POST',headers:{origin:'https://averaprive.vercel.app','content-type':'application/json',...headers},body:JSON.stringify(body)});
}
beforeEach(()=>{rpc.mockReset();rpc.mockResolvedValue({data:'receipt',error:null});});
describe('inquiry boundary',()=>{
 it.each([['https://attacker.example',403],['null',403]])('rejects foreign origin %s',async(origin,status)=>{expect((await POST(request(payload,{origin}))).status).toBe(status);expect(rpc).not.toHaveBeenCalled();});
 it('uses incoming Host for Next internal localhost URLs without trusting forwarded hosts',async()=>{
 const r=new Request('http://localhost:3111/api/marketplace/inquiry',{method:'POST',headers:{host:'127.0.0.1:3111',origin:'http://127.0.0.1:3111','content-type':'application/json'},body:'{}'});expect((await POST(r)).status).toBe(400);
 expect((await POST(request(payload,{'x-forwarded-host':'attacker.example',origin:'https://attacker.example'}))).status).toBe(403);
 });
 it('rejects absent origin and non-JSON',async()=>{const r=request();r.headers.delete('origin');expect((await POST(r)).status).toBe(403);expect((await POST(request(payload,{'content-type':'text/plain'}))).status).toBe(415);expect(rpc).not.toHaveBeenCalled();});
 it('rejects actual oversized bytes despite absent or false length',async()=>{for(const headers of [{} as Record<string,string>,{'content-length':'1'}]) expect((await POST(request({...payload,message:'é'.repeat(7000)},headers))).status).toBe(413);expect(rpc).not.toHaveBeenCalled();});
 it.each([null,[],{...payload,consent:false},{...payload,name:{}},{...payload,website:'spam'}])('rejects invalid payload %#',async body=>{expect((await POST(request(body))).status).toBe(400);expect(rpc).not.toHaveBeenCalled();});
 it('preserves consent and uses existing RPC',async()=>{expect((await POST(request())).status).toBe(201);expect(rpc).toHaveBeenCalledWith('ap_submit_inquiry',expect.objectContaining({contact_consent:true,contact_email:payload.email}));});
 it('does not leak backend errors',async()=>{rpc.mockResolvedValue({error:{message:'PRIVATE DATABASE DETAIL'}});const response=await POST(request());expect(response.status).toBe(400);expect(await response.text()).not.toContain('PRIVATE');});
});
describe('bounded JSON stream',()=>{
 it('cancels a chunked request as soon as limit is exceeded',async()=>{const cancel=vi.fn();const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(8));controller.enqueue(new Uint8Array(8));},cancel});const r=new Request('http://localhost',{method:'POST',body:stream,duplex:'half'} as RequestInit);await expect(boundedJson(r,10)).rejects.toMatchObject({status:413});expect(cancel).toHaveBeenCalled();});
 it('rejects invalid encoding and malformed JSON',async()=>{await expect(boundedJson(new Request('http://localhost',{method:'POST',body:'{' }),100)).rejects.toBeInstanceOf(RequestBodyError);});
});
