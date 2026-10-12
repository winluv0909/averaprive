import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({local:{} as Record<string,unknown>,rpc:vi.fn(),request:vi.fn()}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({
  from:()=>{const q={select:()=>q,eq:()=>q,single:async()=>({data:m.local,error:null})};return q;},rpc:m.rpc
})}));
vi.mock('../lib/billing/paypal/client',()=>({paypalRequest:m.request,PayPalApiError:class extends Error{}}));
import {resumePayPalCheckout} from '../lib/billing/paypal/service';
beforeEach(()=>{
  vi.stubEnv('PAYPAL_ENV','sandbox');vi.stubEnv('PAYPAL_CLIENT_ID','client');vi.stubEnv('PAYPAL_CLIENT_SECRET','test-secret');vi.stubEnv('PAYPAL_MERCHANT_ID','');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://site.example');
  m.local={id:'local',agency_id:'agency',provider:'paypal',status:'created',paypal_state:'created',paypal_environment:'sandbox',currency:'USD',total_amount:49,plan_code:'prive',billing_cycle:'monthly',payment_expires_at:new Date(Date.now()+3600000).toISOString()};
  m.rpc.mockImplementation(async(name)=>{if(name==='ap_prepare_paypal_checkout')m.local={...m.local,status:'pending'};return {error:null};});
  m.request.mockResolvedValue({id:'REMOTE123',status:'CREATED',links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token=REMOTE123'}],purchase_units:[{reference_id:'local',custom_id:'local',invoice_id:'local',payee:{merchant_id:'MERCHANT'},amount:{currency_code:'USD',value:'49.00'}}]});
});
afterEach(()=>{vi.unstubAllEnvs();vi.resetAllMocks();});
describe('PayPal checkout recovery',()=>{
  it('reuses the existing invoice and stable PayPal key after recovery',async()=>{
    const result=await resumePayPalCheckout('local','agency','actor');
    expect(result.id).toBe('local');expect(result.url).toContain('sandbox.paypal.com');
    expect(m.rpc).toHaveBeenCalledWith('ap_prepare_paypal_checkout',{target_order:'local',target_agency:'agency',actor_user:'actor'});
    expect(m.request.mock.calls[0][3]).toBe('clocal');
    expect(m.rpc.mock.calls.some(([name])=>name==='ap_create_paypal_invoice'||name==='ap_record_paypal_capture')).toBe(false);
    expect(m.rpc).toHaveBeenCalledWith('ap_attach_paypal_order',expect.objectContaining({target_order:'local',remote_id:'REMOTE123'}));
  });
  it.each(['paid','cancelled','failed'])('does not restart a %s order',async(status)=>{
    m.local.status=status;await expect(resumePayPalCheckout('local','agency','actor')).rejects.toThrow();expect(m.request).not.toHaveBeenCalled();
  });
  it('rejects mismatched environment and expired orders before provider calls',async()=>{
    m.local.paypal_environment='live';await expect(resumePayPalCheckout('local','agency','actor')).rejects.toThrow('environment');
    m.local.paypal_environment='sandbox';m.local.payment_expires_at=new Date(0).toISOString();
    await expect(resumePayPalCheckout('local','agency','actor')).rejects.toThrow('expired');expect(m.request).not.toHaveBeenCalled();
  });
  it('fails closed when database preparation fails',async()=>{
    m.rpc.mockResolvedValue({error:{message:'denied'}});await expect(resumePayPalCheckout('local','agency','actor')).rejects.toThrow('prepared');expect(m.request).not.toHaveBeenCalled();
  });
  it('reuses a linked pending checkout without creating another provider order',async()=>{
    Object.assign(m.local,{status:'pending',provider_reference:'REMOTE123',checkout_url:'https://www.sandbox.paypal.com/checkoutnow?token=REMOTE123'});
    expect((await resumePayPalCheckout('local','agency','actor')).url).toContain('sandbox.paypal.com');expect(m.request).not.toHaveBeenCalled();
  });
});
