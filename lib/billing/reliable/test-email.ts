import "server-only";
import { invoiceLines, invoicePdf, type Invoice } from "./invoice";

export async function sendSandboxInvoiceTest(invoice: Invoice, userEmail: string) {
  const payment = invoice.payment_snapshot;
  if (payment.provider !== "paypal" || payment.environment !== "sandbox" ||
      payment.status !== "test_completed" || invoice.status !== "paid") {
    throw new Error("Only completed sandbox invoices can be tested");
  }
  const recipients = (process.env.PAYMENT_ADMIN_EMAILS || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  // The recipient comes from server configuration and must belong to the signed-in tester.
  if (recipients.length !== 1 || recipients[0] !== userEmail.trim().toLowerCase()) {
    throw new Error("The signed-in email must match the single configured test recipient");
  }
  const apiKey = process.env.RESEND_API_KEY, from = process.env.PAYMENT_EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Test email sender is not configured");
  const filename = invoice.invoice_number.replace(/[^A-Za-z0-9_-]/g, "_");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `sandbox-invoice-test-${invoice.id}` },
    body: JSON.stringify({
      from, to: recipients,
      subject: `SANDBOX TEST - NOT A REAL RECEIPT - ${invoice.invoice_number}`,
      text: "SANDBOX TEST ONLY. No real money received. Live subscription unchanged.\n\n" + invoiceLines(invoice).join("\n"),
      attachments: [{ filename: `SANDBOX-TEST-${filename}.pdf`, content: invoicePdf(invoice).toString("base64") }],
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Email provider rejected the test (HTTP ${response.status})`);
}
