import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgencyRole } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgencyWorkspaceShell } from "@/app/dashboard/_components/portal-shells";
import type { Invoice } from "@/lib/billing/reliable/invoice";
import "./invoice-premium.css";
import { sendTestInvoiceEmail } from "./actions";
function date(value: string | null) {
  if (!value) return "Not paid";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(parsed);
}
export default async function InvoicePage({ params, searchParams }: { params: Promise<{ agencyId: string; invoiceId: string }>; searchParams: Promise<{ testEmail?: string }> }) {
  const { agencyId, invoiceId } = await params;
  const { testEmail } = await searchParams;
  const { user } = await requireAgencyRole(agencyId, ["owner", "admin", "billing"]);
  const { data } = await createAdminClient().from("ap_invoices").select("*").eq("agency_id", agencyId).eq("id", invoiceId).single();
  if (!data) notFound();
  const invoice = data as Invoice, customer = invoice.customer_snapshot, seller = invoice.seller_snapshot, payment = invoice.payment_snapshot;
  const root = `/agency/dashboard/agencies/${agencyId}/billing`, sandbox = payment.environment === "sandbox", paypal = payment.provider === "paypal", wallet = payment.wallet_generation === "trust_wallet_v1";
  const refunded = ["refunded", "reversed", "partially_refunded"].includes(String(payment.status));
  const status = refunded ? String(payment.status).replaceAll("_", " ") : invoice.status;
  const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency }).format(Number(value));
  const references = paypal ? [["PayPal order", payment.paypal_order_id || payment.order_id || "Not yet created"], ["PayPal capture", payment.capture_id || "Not yet confirmed"], ["Receiving merchant", payment.merchant_id || "Not yet recorded"]] : [["Asset / network", `${payment.asset || ""} / ${payment.network || ""}`], ["Verified transaction", payment.verified_transaction_hash || "Not confirmed"], [wallet ? "Trust Wallet receiving address" : "Historical receiving address", payment.receiving_address || payment.destination || "Not recorded"], ...(wallet ? [["Exact crypto amount", `${payment.expected_crypto_amount} ${payment.asset}`], ["Matching adjustment (included)", `${payment.matching_adjustment || "0"} ${payment.asset}`], ["Token contract", payment.token_contract || "BTC"]] : [])];
  return <AgencyWorkspaceShell email={user.email}><main className="ap-invoice-page">
    <div className="ap-invoice-toolbar"><div><p className="ap-billing-eyebrow">BILLING / DOCUMENT CENTER</p><h1>Your invoice</h1></div>
      <nav aria-label="Invoice actions"><Link href={`${root}/invoices`} className="ap-billing-link">← All invoices</Link><Link href={paypal ? `${root}/paypal/${invoice.order_id}` : `${root}/payments/${invoice.order_id}`} className="ap-billing-outline">Payment details</Link><a href={`${root}/invoices/${invoiceId}/pdf`} className="ap-billing-primary">Download PDF <span aria-hidden="true">↓</span></a></nav>
    </div>
    {sandbox && <div className="ap-billing-test"><b>Sandbox test invoice</b><span>No real money has been received. This record does not activate your live subscription.</span></div>}
    {sandbox && paypal && invoice.status === "paid" && payment.status === "test_completed" && <div className="ap-billing-test"><form action={sendTestInvoiceEmail.bind(null, agencyId, invoiceId)}><button className="ap-billing-primary" type="submit">Send test invoice email</button></form><span>Sends a sandbox PDF to your configured admin email, which must match your signed-in email. Not a real receipt.</span></div>}
    {testEmail && <div role="status" className="ap-billing-test">{testEmail === "sent" ? "Test email accepted by the email provider. Check your inbox and Spam folder." : "Test email could not be sent. Check the sender settings, your signed-in email against PAYMENT_ADMIN_EMAILS, and Resend logs."}</div>}
    <article className="ap-invoice-paper" aria-label={`Invoice ${invoice.invoice_number}`}>
      <header className="ap-invoice-masthead"><div className="ap-invoice-brand"><Image src="/assets/invoice/monogram.jpg" alt="Avera Privé monogram" width={72} height={72} unoptimized /><div><strong>{String(seller.name || "Avera Privé")}</strong><span>AGENCY SERVICES &amp; SUBSCRIPTIONS</span></div></div><div className="ap-invoice-title"><span>INVOICE</span><b className={`ap-invoice-badge ${invoice.status === "paid" && !refunded ? "is-paid" : ""}`}>{sandbox ? "TEST · " : ""}{status}</b></div></header>
      <section className="ap-invoice-meta"><div><span>Invoice number</span><strong>{invoice.invoice_number}</strong></div><div><span>Issued · UTC</span><strong>{date(invoice.issued_at)}</strong></div><div><span>{invoice.paid_at ? "Paid · UTC" : "Payment"}</span><strong>{invoice.paid_at ? date(invoice.paid_at) : "Awaiting confirmation"}</strong></div></section>
      <section className="ap-invoice-parties"><div><h2>Billed from</h2><strong>{String(seller.name || "Avera Privé")}</strong>{seller.address ? <p>{String(seller.address)}</p> : null}{seller.email ? <p>{String(seller.email)}</p> : null}{seller.taxId ? <p>Tax ID: {String(seller.taxId)}</p> : null}</div>
        <div><h2>Billed to</h2><strong>{String(customer.legal_name || customer.company_name || "Agency")}</strong>{customer.full_name ? <p>{String(customer.full_name)}</p> : null}{customer.billing_email ? <p>{String(customer.billing_email)}</p> : null}{customer.billing_address ? <p>{String(customer.billing_address)}</p> : null}{customer.tax_id ? <p>Tax ID: {String(customer.tax_id)}</p> : null}</div></section>
      <section className="ap-invoice-items" aria-label="Invoice items"><table><thead><tr><th scope="col">Description</th><th scope="col">Qty</th><th scope="col">Amount</th></tr></thead><tbody>{invoice.line_items.map((item, index) => <tr key={index}><td><strong>{item.description}</strong><span>Agency workspace access</span></td><td>{item.quantity}</td><td>{money(item.amount)}</td></tr>)}</tbody></table></section>
      <section className="ap-invoice-settlement"><div className="ap-invoice-payment"><span className="ap-billing-eyebrow">PAYMENT METHOD</span><strong>{paypal ? "PayPal" : wallet ? `Crypto · ${payment.asset}` : "Historical crypto payment"}</strong><p>{sandbox ? "Sandbox environment · test record" : refunded ? "Payment adjustment recorded" : invoice.status === "paid" ? "Payment independently verified" : "Payment has not been confirmed"}</p><p className="ap-invoice-renewal">{paypal || wallet ? "One-time purchase. No automatic renewal." : "Historical payment information is retained for your records."}</p></div>
        <dl className="ap-invoice-totals"><div><dt>Subtotal</dt><dd>{money(invoice.subtotal)}</dd></div><div><dt>Tax</dt><dd>{money(invoice.tax_amount)}</dd></div><div className="ap-invoice-grand-total"><dt>{sandbox ? "Test total" : "Total"}</dt><dd>{money(invoice.total_amount)}</dd></div></dl></section>
      <details className="ap-invoice-references"><summary>Payment references <span aria-hidden="true">+</span></summary><dl>{[["Payment ID", invoice.order_id], ["Invoice ID", invoice.id], ...references].map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd>{String(value)}</dd></div>)}</dl></details>
      {invoice.notes && <section className="ap-invoice-notes"><h2>Invoice notes</h2><p>{invoice.notes}</p></section>}
      <footer className="ap-invoice-footer"><span>AVERA PRIVÉ</span><p>{sandbox ? "Test document · no real payment" : "Keep this invoice for your business records."}</p></footer>
    </article>
  </main></AgencyWorkspaceShell>;
}
