import { describe, it, expect } from "vitest";
import { cents, approvalUrl, assertOrderMatches, verifiedCapture, type LocalPayPalOrder, type PayPalOrder, type PayPalCapture } from "../lib/billing/paypal/domain";
const local = { id: "local-id", provider_reference: "REMOTE123", paypal_merchant_id: "MERCHANT123", total_amount: 49, currency: "USD", paypal_environment: "sandbox" } as LocalPayPalOrder;
const capture: PayPalCapture = { id: "CAPTURE123", status: "COMPLETED", final_capture: true, amount: { currency_code: "USD", value: "49.00" }, supplementary_data: { related_ids: { order_id: "REMOTE123" } } };
const remote: PayPalOrder = { id: "REMOTE123", status: "COMPLETED", purchase_units: [{ reference_id: "local-id", custom_id: "local-id", invoice_id: "local-id", payee: { merchant_id: "MERCHANT123" }, amount: { currency_code: "USD", value: "49.00" }, payments: { captures: [capture] } }] };
describe("PayPal independent evidence", () => {
  it("accepts completed capture with correct recipient, amount and invoice", () => {
    expect(verifiedCapture(local, remote, capture)).toMatchObject({ capture_id: "CAPTURE123", merchant_id: "MERCHANT123", environment: "sandbox" });
  });
  it.each(["APPROVED", "CREATED", "PAYER_ACTION_REQUIRED"])("never treats %s order as proof of payment", status => {
    expect(() => verifiedCapture(local, { ...remote, status }, capture)).toThrow();
  });
  it.each(["PENDING", "DENIED", "REFUNDED", "PARTIALLY_REFUNDED"])("never activates %s capture", status => {
    expect(() => verifiedCapture(local, remote, { ...capture, status })).toThrow();
  });
  it.each(["48.99", "49.01"])("rejects mismatched amount %s", value => {
    expect(() => verifiedCapture(local, remote, { ...capture, amount: { currency_code: "USD", value } })).toThrow();
  });
  it("rejects another invoice, receiving account, currency and order", () => {
    for (const change of [{ custom_id: "another" }, { invoice_id: "another" }, { reference_id: "another" }, { payee: { merchant_id: "other" } }, { amount: { currency_code: "EUR", value: "49.00" } }]) {
      expect(() => assertOrderMatches(local, { ...remote, purchase_units: [{ ...remote.purchase_units![0], ...change }] })).toThrow();
    }
    expect(() => verifiedCapture(local, remote, { ...capture, supplementary_data: { related_ids: { order_id: "OTHER123" } } })).toThrow();
  });
  it("rejects split and non-final captures", () => {
    expect(() => verifiedCapture(local, remote, { ...capture, final_capture: false })).toThrow();
    expect(() => verifiedCapture(local, { ...remote, purchase_units: [{ ...remote.purchase_units![0], payments: { captures: [capture, capture] } }] }, capture)).toThrow();
  });
  it("handles cents exactly and rejects scientific notation / extra precision", () => {
    expect(cents("49.01")).toBe(4901); expect(cents(49)).toBe(4900);
    for (const value of ["1e2", "49.001", "NaN", "-1"]) expect(() => cents(value)).toThrow();
  });
  it("rejects approval links outside the selected PayPal environment", () => {
    const link = (href: string) => ({ ...remote, links: [{ rel: "approve", href }] });
    expect(approvalUrl(link("https://www.sandbox.paypal.com/checkoutnow?token=A"), "sandbox")).toContain("sandbox.paypal.com");
    for (const href of ["https://evil.example/", "https://www.paypal.com/", "http://www.sandbox.paypal.com/", "https://www.sandbox.paypal.com:444/"]) expect(() => approvalUrl(link(href), "sandbox")).toThrow();
  });
});
