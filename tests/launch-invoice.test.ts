import {describe,it,expect,vi} from "vitest";
import {mkdirSync,writeFileSync} from "node:fs";
vi.mock("server-only",()=>({}));
import {invoicePdf,invoiceLines,type Invoice} from "@/lib/billing/reliable/invoice";
import {invoiceState} from "@/lib/billing/reliable/invoice-state";
const base:Invoice={id:"invoice",order_id:"order",agency_id:"agency",invoice_number:"QA-ONLY-0001",status:"open",currency:"USD",subtotal:49,tax_amount:0,total_amount:49,issued_at:"2026-10-29T00:00:00Z",paid_at:null,seller_snapshot:{name:"Avera Privé",email:"averaprivemain@gmail.com"},customer_snapshot:{legal_name:"Wide International Agency — "+"WWWW Branding ".repeat(25),full_name:"QA owner",billing_email:"qa@example.invalid",billing_address:"Long address ".repeat(35)},payment_snapshot:{provider:"crypto",wallet_generation:"trust_wallet_v1",asset:"BTC",network:"BITCOIN",receiving_address:"bc1qexample-not-a-real-payment-destination",expected_crypto_amount:"0.00049",status:"awaiting_payment",expires_at:"2099-01-01T00:00:00Z"},line_items:[{description:"Privé - monthly, one-time purchase",quantity:1,amount:49}],notes:"QA ONLY. Original instructions retained for audit. Do not send funds."};
describe("launch invoice safeguards",()=>{
 it.each(["void","overdue","paid"])("never offers a payment QR for %s invoices",status=>{expect(invoiceState(status,base.payment_snapshot).canShowPaymentQr).toBe(false);});
 it("does not offer payment QR for review or expired snapshots",()=>{expect(invoiceState("open",{...base.payment_snapshot,status:"underpaid"}).canShowPaymentQr).toBe(false);expect(invoiceState("open",{...base.payment_snapshot,expires_at:"2000-01-01"}).canShowPaymentQr).toBe(false);});
 it("distinguishes recorded refunds from independently confirmed receipts",()=>{const payment={...base.payment_snapshot,refund_case_id:"case",refund_status:"refund_recorded",refund_txid:"qa-outgoing",refund_amount:"0.00048"};const lines=invoiceLines({...base,status:"void",payment_snapshot:payment}).join("\n");expect(lines).toContain("Owner-recorded refund");expect(lines).toContain("qa-outgoing");expect(invoiceState("void",payment).canShowPaymentQr).toBe(false);});
 it("renders native Bitcoin, punctuation and long billing details in real PDFs",()=>{
  mkdirSync("tmp/pdfs",{recursive:true});
  for(const [name,invoice] of Object.entries({"open-long":base,"void-refund":{...base,status:"void",payment_snapshot:{...base.payment_snapshot,refund_case_id:"case",refund_status:"refund_recorded",refund_amount:"0.00048",refund_txid:"qa-outgoing-not-a-real-transfer"}},"sandbox":{...base,invoice_number:"QA-ONLY-0002",status:"paid",payment_snapshot:{provider:"paypal",environment:"sandbox",status:"test_completed"}}})){
   const pdf=invoicePdf(invoice);expect(pdf.toString()).not.toContain("[U+2014]");expect(pdf.toString()).not.toContain("Wrapped BTC");if(name==="void-refund"){expect(pdf.toString()).toContain("REFUND RECORD");expect(pdf.toString()).not.toContain("Address QR");}writeFileSync(`tmp/pdfs/${name}.pdf`,pdf);
  }
 });
});
