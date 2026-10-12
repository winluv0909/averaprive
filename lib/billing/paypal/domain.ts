export interface PayPalOrder {
  id: string; status: string;
  purchase_units?: Array<{ reference_id?: string; custom_id?: string; invoice_id?: string;
    amount?: { currency_code: string; value: string }; payee?: { merchant_id?: string };
    payments?: { captures?: PayPalCapture[] } }>;
  links?: Array<{ rel: string; href: string }>;
}
export interface PayPalCapture {
  id: string; status: string; final_capture?: boolean;
  amount?: { currency_code: string; value: string }; payee?: { merchant_id?: string };
  supplementary_data?: { related_ids?: { order_id?: string } };
}
export interface LocalPayPalOrder {
  id: string; agency_id: string; provider: string; provider_reference: string | null; status: string;
  currency: string; total_amount: number | string; paypal_environment: string;
  paypal_merchant_id: string | null; paypal_capture_id: string | null;
  paypal_state: string; plan_code: string; billing_cycle: string; checkout_url: string | null;
  payment_expires_at: string; created_at: string;
}
export function cents(value: unknown): number {
  const text = String(value);
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(text)) throw new Error("Invalid payment amount");
  const [whole, decimal = ""] = text.split(".");
  return Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
}
export function assertOrderMatches(local: LocalPayPalOrder, remote: PayPalOrder) {
  if (remote.id !== local.provider_reference || remote.purchase_units?.length !== 1) throw new Error("Payment order mismatch");
  const unit = remote.purchase_units[0];
  if (unit.reference_id !== local.id || unit.custom_id !== local.id || unit.invoice_id !== local.id ||
    !local.paypal_merchant_id || unit.payee?.merchant_id !== local.paypal_merchant_id ||
    unit.amount?.currency_code !== local.currency || cents(unit.amount.value) !== cents(local.total_amount)) {
    throw new Error("Payment recipient, invoice, currency or amount mismatch");
  }
  return unit;
}
export function verifiedCapture(local: LocalPayPalOrder, remote: PayPalOrder, capture: PayPalCapture) {
  const unit = assertOrderMatches(local, remote);
  if (remote.status !== "COMPLETED" || capture.status !== "COMPLETED" || capture.final_capture !== true ||
    unit.payments?.captures?.length !== 1 || unit.payments.captures[0].id !== capture.id ||
    !capture.id || capture.supplementary_data?.related_ids?.order_id !== remote.id ||
    capture.amount?.currency_code !== local.currency || cents(capture.amount.value) !== cents(local.total_amount) ||
    (capture.payee?.merchant_id && capture.payee.merchant_id !== local.paypal_merchant_id)) {
    throw new Error("A completed, independently verified capture is required");
  }
  return { environment: local.paypal_environment, order_id: remote.id, capture_id: capture.id,
    merchant_id: unit.payee!.merchant_id, currency: capture.amount.currency_code, amount: capture.amount.value, status: "COMPLETED" };
}
export function approvalUrl(remote: PayPalOrder, environment: string) {
  const href = remote.links?.find(link => ["approve", "payer-action"].includes(link.rel))?.href;
  if (!href) throw new Error("PayPal approval link missing");
  const url = new URL(href);
  if (url.protocol !== "https:" || url.hostname !== (environment === "sandbox" ? "www.sandbox.paypal.com" : "www.paypal.com") || url.username || url.password || url.port) {
    throw new Error("Invalid PayPal approval link");
  }
  return url.toString();
}
