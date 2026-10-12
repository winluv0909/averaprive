import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({updates:[] as Record<string,unknown>[],paid:true,kind:"customer",attempts:0}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({
  rpc:async()=>({data:[{id:"notice-id",order_id:"order-id",kind:mocks.kind,recipient:"customer@example.com",event:"confirmed",attempts:mocks.attempts}],error:null}),
  from:(name:string)=>{
    const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:async()=>({data:[],error:null}),single:async()=>({error:null,data:name==="ap_payment_orders"?{status:mocks.paid?"paid":"pending"}:{id:"invoice-id",order_id:"order-id",invoice_number:"INV-TEST",agency_id:"agency-id",status:mocks.paid?"paid":"open",currency:"USD",subtotal:49,tax_amount:0,total_amount:49,issued_at:"2026-10-11",paid_at:mocks.paid?"2026-10-11":null,seller_snapshot:{name:"Avera Prive"},customer_snapshot:{legal_name:"Test agency",billing_email:"customer@example.com"},payment_snapshot:{asset:"USDT",network:"BEP20",expected_crypto_amount:"49.00"},line_items:[{description:"Prive monthly",quantity:1,amount:49}],notes:null}}),update:(value:Record<string,unknown>)=>{mocks.updates.push(value);return chain;}};
    return chain;
  },
})}));
import {deliverNotifications} from "../lib/billing/reliable/notifications";
import {invoicePdf,type Invoice} from "../lib/billing/reliable/invoice";
beforeEach(()=>{mocks.updates=[];mocks.paid=true;mocks.kind="customer";mocks.attempts=0;vi.stubEnv("RESEND_API_KEY","test-key");vi.stubEnv("PAYMENT_EMAIL_FROM","billing@example.com");vi.stubEnv("PAYMENT_ADMIN_EMAILS","admin@example.com");});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe("durable invoice email delivery",()=>{
  it("sends paid PDF to the invoice customer with a stable idempotency key",async()=>{
    const request=vi.fn(async()=>({ok:true}));vi.stubGlobal("fetch",request);
    expect(await deliverNotifications()).toEqual({sent:1,failed:0});
    const options=request.mock.calls[0] as unknown as [string,{headers:Record<string,string>;body:string}];
    expect(options[1].headers["Idempotency-Key"]).toBe("notice-id");
    const body=JSON.parse(options[1].body);expect(body.to).toEqual(["customer@example.com"]);expect(Buffer.from(body.attachments[0].content,"base64").toString().startsWith("%PDF")).toBe(true);
    expect(mocks.updates[0].status).toBe("sent");
  });
  it("never sends a paid receipt for a pending invoice",async()=>{
    mocks.paid=false;const request=vi.fn();vi.stubGlobal("fetch",request);expect(await deliverNotifications()).toEqual({sent:0,failed:1});expect(request).not.toHaveBeenCalled();expect(mocks.updates[0].status).toBe("pending");
  });
  it("keeps rejected emails queued for retry without changing payment status",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>({ok:false,status:503})));expect(await deliverNotifications()).toEqual({sent:0,failed:1});expect(mocks.updates[0]).toMatchObject({status:"pending",locked_until:null});expect(mocks.updates[0]).not.toHaveProperty("current_crypto_status");
  });
  it("queues email when sender configuration is missing",async()=>{
    vi.stubEnv("RESEND_API_KEY","");const request=vi.fn();vi.stubGlobal("fetch",request);await deliverNotifications();expect(request).not.toHaveBeenCalled();expect(mocks.updates[0].status).toBe("pending");
  });
  it("preserves accented and Unicode customer data in PDF text",()=>{
    const invoice={invoice_number:"INV-UNICODE",order_id:"id",status:"paid",currency:"USD",subtotal:49,total_amount:49,tax_amount:0,issued_at:"today",paid_at:"today",seller_snapshot:{name:"Avera Privé"},customer_snapshot:{legal_name:"Müller 中文"},payment_snapshot:{},line_items:[]} as unknown as Invoice;
    const pdf=invoicePdf(invoice).toString();expect(pdf).toContain("Priv\\351");expect(pdf).toContain("/ActualText");expect(pdf).toContain("[U+4E2D]");
  });
  it("paginates long invoices without discarding customer details",()=>{
    const invoice={invoice_number:"INV-LONG",order_id:"id",status:"paid",currency:"USD",subtotal:49,total_amount:49,tax_amount:0,issued_at:"today",paid_at:"today",seller_snapshot:{},customer_snapshot:{billing_address:"Long address ".repeat(300)},payment_snapshot:{},line_items:[]} as unknown as Invoice;
    const pdf=invoicePdf(invoice).toString();expect(Number(pdf.match(/\/Count (\d+)/)?.[1])).toBeGreaterThan(1);expect(pdf).toContain("startxref");
  });
});
