import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgencyRole } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { localPayPalOrder } from "@/lib/billing/paypal/service";
import { AgencyWorkspaceShell } from "@/app/dashboard/_components/portal-shells";
import { confirmPayPalPayment } from "./actions";
import AutoConfirm from "./AutoConfirm";
import "@/app/dashboard/agencies/[agencyId]/billing/invoices/[invoiceId]/invoice-premium.css";
const labels: Record<string, string> = { created: "Awaiting PayPal approval", pending: "Payment pending — not confirmed", completed: "Payment confirmed", test_completed: "Sandbox payment verified", denied: "Payment declined", refunded: "Payment refunded", partially_refunded: "Partial refund — billing review", reversed: "Payment reversed", verification_error: "Verification requires retry" };
export default async function PayPalPaymentPage({ params, searchParams }: { params: Promise<{ agencyId: string; orderId: string }>; searchParams: Promise<{ token?: string; cancelled?: string; error?: string; checked?: string }> }) {
  const { agencyId, orderId } = await params, query = await searchParams;
  const { user } = await requireAgencyRole(agencyId, ["owner", "admin", "billing"]);
  let order;
  try { order = await localPayPalOrder(orderId, agencyId); } catch { notFound(); }
  const { data: invoice } = await createAdminClient().from("ap_invoices").select("id,invoice_number").eq("order_id", orderId).eq("agency_id", agencyId).single();
  const root = `/agency/dashboard/agencies/${agencyId}/billing`;
  const returned = query.token === order.provider_reference && order.status === "pending" && !query.checked && !query.error && !query.cancelled;
  const sandbox = order.paypal_environment === "sandbox";
  return <AgencyWorkspaceShell email={user.email}><main className="ap-payment-page">
    <div className="ap-invoice-toolbar"><div><p className="ap-billing-eyebrow">BILLING / {sandbox ? "SANDBOX TEST" : "PAYMENT STATUS"}</p><h1>{invoice?.invoice_number || "Payment details"}</h1></div><nav aria-label="Billing navigation"><Link className="ap-billing-link" href={root}>← Back to billing</Link><Link className="ap-billing-outline" href={`${root}/invoices`}>All invoices</Link>{invoice && <Link className="ap-billing-primary" href={`${root}/invoices/${invoice.id}`}>View invoice →</Link>}</nav></div>
    {sandbox && <div className="ap-billing-test"><b>Sandbox test payment</b><span>No real money has been received. Your live subscription is unchanged.</span></div>}
    {query.error && <div className="ap-payment-alert" role="alert">{query.error}</div>}
    {query.cancelled && <div className="ap-payment-alert" role="status">You left PayPal checkout. If you already paid, verify the payment below before trying again.</div>}
    <div className="ap-payment-grid"><section className="ap-payment-card"><span className="ap-payment-state">{labels[order.paypal_state] || order.paypal_state}</span><p className="ap-billing-eyebrow">YOUR SELECTED PLAN</p><h2>{order.plan_code === "prive" ? "Privé" : order.plan_code === "select" ? "Select" : "Elite"}</h2><p className="ap-payment-plan">{order.billing_cycle === "annual" ? "One year" : "One month"} of agency workspace access</p>
      <strong className="ap-payment-amount">{order.currency} {Number(order.total_amount).toFixed(2)}</strong><p>One-time purchase. No automatic renewal.</p>
      {returned && <AutoConfirm agencyId={agencyId} orderId={orderId} />}
      {order.status === "pending" && <form action={confirmPayPalPayment.bind(null, agencyId, orderId)}><button className="ap-billing-primary">Verify payment status →</button></form>}
      {order.status === "pending" && order.paypal_state === "created" && order.checkout_url && !returned && !query.checked && !query.error && <a className="ap-billing-outline" href={order.checkout_url}>Continue to PayPal{sandbox ? " Sandbox" : ""}</a>}
      <p className="ap-payment-caption">Already paid? Verify your payment or contact support. Please do not pay again while verification is pending.</p>
    </section><section className="ap-payment-card"><p className="ap-billing-eyebrow">SECURE PAYMENT RECORD</p><h2>Payment information</h2><p>Your payment is matched to this invoice and checked with PayPal.</p><dl>
      <div><dt>Payment method</dt><dd>PayPal · {sandbox ? "Sandbox test environment" : "Live environment"}</dd></div>
      <div><dt>Payment ID</dt><dd>{orderId}</dd></div><div><dt>PayPal order</dt><dd>{order.provider_reference || "Not yet created"}</dd></div>
      <div><dt>PayPal capture</dt><dd>{order.paypal_capture_id || "Not yet confirmed"}</dd></div>
    </dl><p className="ap-payment-caption">Approval alone does not activate access. A completed payment must be verified for the correct invoice, amount, currency and receiving merchant.</p></section></div>
  </main></AgencyWorkspaceShell>;
}
