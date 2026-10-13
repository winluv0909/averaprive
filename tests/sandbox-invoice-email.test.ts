import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {sendSandboxInvoiceTest} from '../lib/billing/reliable/test-email';
import type {Invoice} from '../lib/billing/reliable/invoice';
const invoice:Invoice={id:'invoice-test',invoice_number:'AP-TEST',agency_id:'agency',order_id:'order',status:'paid',currency:'USD',subtotal:49,tax_amount:0,total_amount:49,issued_at:'2026-10-12',paid_at:'2026-10-12',customer_snapshot:{},seller_snapshot:{},payment_snapshot:{provider:'paypal',environment:'sandbox',status:'test_completed'},line_items:[],notes:null};
beforeEach(()=>{vi.stubEnv('RESEND_API_KEY','test');vi.stubEnv('PAYMENT_EMAIL_FROM','Avera <onboarding@resend.dev>');vi.stubEnv('PAYMENT_ADMIN_EMAILS','tester@example.com');});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('sandbox invoice test email',()=>{
 it('sends an explicitly labeled sandbox PDF to the configured signed-in tester',async()=>{
  const request=vi.fn().mockResolvedValue({ok:true});vi.stubGlobal('fetch',request);
  await sendSandboxInvoiceTest(invoice,'tester@example.com');
  const args=request.mock.calls[0][1];const body=JSON.parse(args.body);
  expect(body.to).toEqual(['tester@example.com']);expect(body.subject).toContain('NOT A REAL RECEIPT');expect(body.text).toContain('Live subscription unchanged');
  expect(body.attachments[0].filename).toContain('SANDBOX-TEST');expect(Buffer.from(body.attachments[0].content,'base64').subarray(0,4).toString()).toBe('%PDF');
  expect(args.headers['Idempotency-Key']).toBe('sandbox-invoice-test-invoice-test');
 });
 it.each([{...invoice,payment_snapshot:{provider:'paypal',environment:'live',status:'completed'}},{...invoice,status:'open'},{...invoice,payment_snapshot:{provider:'paypal',environment:'sandbox',status:'refunded'}}])('rejects live, unpaid and refunded records',async(record)=>{
  const request=vi.fn();vi.stubGlobal('fetch',request);await expect(sendSandboxInvoiceTest(record,'tester@example.com')).rejects.toThrow();expect(request).not.toHaveBeenCalled();
 });
 it('rejects a different user or multiple configured recipients',async()=>{
  const request=vi.fn();vi.stubGlobal('fetch',request);await expect(sendSandboxInvoiceTest(invoice,'other@example.com')).rejects.toThrow();
  vi.stubEnv('PAYMENT_ADMIN_EMAILS','tester@example.com,other@example.com');await expect(sendSandboxInvoiceTest(invoice,'tester@example.com')).rejects.toThrow();expect(request).not.toHaveBeenCalled();
 });
 it('reports provider rejection instead of success',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:403}));await expect(sendSandboxInvoiceTest(invoice,'tester@example.com')).rejects.toThrow('HTTP 403');});
});
