import "server-only";
export interface Invoice {
  id:string; invoice_number:string; agency_id:string; order_id:string; status:string;
  currency:string; subtotal:number; tax_amount:number; total_amount:number; issued_at:string; paid_at:string|null;
  seller_snapshot:Record<string,unknown>; customer_snapshot:Record<string,unknown>; payment_snapshot:Record<string,unknown>;
  line_items:Array<{description:string;quantity:number;amount:number}>; notes:string|null;
}
export function invoiceLines(invoice: Invoice): string[] {
  const c = invoice.customer_snapshot, p = invoice.payment_snapshot, s = invoice.seller_snapshot;
  const paypal = p.provider === "paypal", sandbox = paypal && p.environment === "sandbox";
  const payment = paypal ? ["Payment method: PayPal", `Environment: ${p.environment || ""}`, `Payment state: ${p.status || ""}`,
    `PayPal order: ${p.paypal_order_id || p.order_id || "Not recorded"}`, `PayPal capture: ${p.capture_id || "Not confirmed"}`,
    `Receiving merchant: ${p.merchant_id || "Not recorded"}`, "One-time purchase. No automatic renewal."] :
    [`Asset / network: ${p.asset || ""} / ${p.network || ""}`, `Amount: ${p.expected_crypto_amount || p.amount || ""}`,
      `Destination: ${p.receiving_address || p.destination || ""}`, `Verified TXID: ${p.verified_transaction_hash || "Not confirmed"}`];
  return [String(s.name || "Avera Prive"), String(s.address || ""), String(s.email || ""), `INVOICE ${invoice.invoice_number}`,
    ...(sandbox ? ["SANDBOX TEST ONLY - NO REAL MONEY RECEIVED - LIVE PLAN UNCHANGED"] : []),
    `Status: ${invoice.status.toUpperCase()}`, `Issued: ${invoice.issued_at}`, `Paid: ${invoice.paid_at || "Not paid"}`, "",
    `Customer: ${c.legal_name || c.company_name || ""}`, `Contact: ${c.full_name || ""}`, `Email: ${c.billing_email || ""}`,
    `Address: ${c.billing_address || ""}`, `Tax ID: ${c.tax_id || ""}`, "",
    ...invoice.line_items.map(item => `${item.description} x${item.quantity}: ${invoice.currency} ${Number(item.amount).toFixed(2)}`),
    `Subtotal: ${invoice.currency} ${Number(invoice.subtotal).toFixed(2)}`, `Tax: ${invoice.currency} ${Number(invoice.tax_amount).toFixed(2)}`,
    `Total: ${invoice.currency} ${Number(invoice.total_amount).toFixed(2)}`, "", `Payment ID: ${invoice.order_id}`, ...payment, ...(p.matching_adjustment!==undefined?[`Matching adjustment (included): ${p.matching_adjustment} ${p.asset}`]:[]), invoice.notes || ""];
}
// The same renderer serves invoice downloads and email attachments.
export {premiumInvoicePdf as invoicePdf} from "./invoice-design";
