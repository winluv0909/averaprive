import { describe, it, expect, vi } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
vi.mock("server-only", () => ({}));
import { invoiceLines, invoicePdf, type Invoice } from "../lib/billing/reliable/invoice";
const invoice: Invoice = { id: "11111111-1111-4111-8111-111111111111", order_id: "22222222-2222-4222-8222-222222222222", agency_id: "agency", invoice_number: "INV-SAMPLE-PAYPAL", status: "paid", currency: "USD", subtotal: 49, tax_amount: 0, total_amount: 49, issued_at: "2026-10-11T12:00:00Z", paid_at: "2026-10-11T12:02:00Z", seller_snapshot: { name: "Avera Privé", address: "Philippines", email: "billing@example.com" }, customer_snapshot: { legal_name: "Example Agency", full_name: "Example Owner", billing_email: "owner@example.com", billing_address: "123 Example Street, Example City" }, payment_snapshot: { provider: "paypal", environment: "sandbox", status: "test_completed", paypal_order_id: "TESTORDER123", capture_id: "TESTCAPTURE123", merchant_id: "TESTMERCHANT" }, line_items: [{ description: "Privé - monthly access (no automatic renewal)", quantity: 1, amount: 49 }], notes: "SANDBOX TEST ONLY. No real money received. Live plan unchanged." };
describe("PayPal invoice", () => {
  it("labels sandbox records clearly and renders a PayPal PDF", () => {
    const lines = invoiceLines(invoice).join("\n"); expect(lines).toContain("SANDBOX TEST ONLY"); expect(lines).toContain("PayPal capture: TESTCAPTURE123"); expect(lines).not.toContain("Asset / network");
    const pdf = invoicePdf(invoice); expect(pdf.toString()).toContain("SANDBOX TEST"); expect(pdf.toString()).not.toContain("Token contract / mint");
    const out = join(tmpdir(), "avera-paypal-qa"); mkdirSync(out, { recursive: true }); writeFileSync(join(out, "invoice.pdf"), pdf);
  });
});
