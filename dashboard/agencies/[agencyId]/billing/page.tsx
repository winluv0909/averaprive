/* eslint-disable react-hooks/purity */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgencyRole } from "@/lib/auth/authorization";
import { AgencyWorkspaceShell } from "../../../_components/portal-shells";
import { startTrial } from "./actions";

type Plan = { code: string; name: string; monthly_price_usd: number; description: string; entitlements: Record<string, unknown> };
type Invoice = { id: string; invoice_number: string; status: string; currency: string; total_amount: number; issued_at: string; ap_payment_orders: { provider: string; plan_code: string } | { provider: string; plan_code: string }[] | null };

export default async function AgencyBillingPage({ params, searchParams }: {
  params: Promise<{ agencyId: string }>;
  searchParams: Promise<{ trial?: string; checkout?: string; error?: string }>;
}) {
  const { agencyId } = await params;
  const query = await searchParams;
  const { supabase, user } = await requireAgencyRole(agencyId, ["owner", "admin", "billing"]);
  const [{ data: agency }, { data: plans }, { data: subscription }, { data: invoices }] = await Promise.all([
    supabase.from("ap_agencies").select("name").eq("id", agencyId).maybeSingle(),
    supabase.from("ap_plans").select("*").order("display_order"),
    supabase.from("ap_subscriptions").select("*").eq("agency_id", agencyId).maybeSingle(),
    supabase.from("ap_invoices").select("id,invoice_number,status,currency,total_amount,issued_at,ap_payment_orders(provider,plan_code)").eq("agency_id", agencyId).order("issued_at", { ascending: false }).limit(10),
  ]);
  if (!agency) notFound();
  const catalog = (plans ?? []) as Plan[];
  const history = (invoices ?? []) as Invoice[];
  const current = subscription?.plan_code ?? "free";
  const trialAvailable = !subscription?.trial_started_at;
  const trialDays = subscription?.status === "trialing" && subscription.trial_ends_at ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86400000)) : 0;

  return <AgencyWorkspaceShell email={user.email}><main className="billing-main">
    <Link href={`/agency/dashboard/agencies/${agencyId}`}>← AGENCY PROFILE</Link>
    <section className="billing-hero"><div><p className="eyebrow">PLAN &amp; BILLING</p><h1>{agency.name}</h1><span>Purchase plans, manage commercial access, and keep every invoice in one secure place.</span></div><div><span>CURRENT PLAN</span><b>{current.toUpperCase()}</b><small>{subscription?.status === "trialing" ? `${trialDays} trial days remaining` : subscription?.status ?? "free forever"}</small></div></section>
    {query.trial && <p className="operation-notice">Your no-card seven-day Privé trial is active.</p>}
    {query.checkout === "return" && <p className="operation-notice">Checkout completed. Payment confirmation is being verified securely; refresh shortly to see the final status.</p>}
    {query.checkout === "cancelled" && <p className="operation-error">Checkout was cancelled. No plan access was activated.</p>}
    {query.error && <p className="operation-error">{query.error}</p>}
    <section className="billing-separation"><strong>PAYMENT BUYS VISIBILITY AND TOOLS—NEVER TRUST.</strong><p>No plan automatically creates verification, changes objective rankings, purchases positive reviews, or overrides moderation.</p></section>
    <section className="billing-plans">{catalog.map((plan) => <article className={plan.code === current ? "current" : ""} key={plan.code}><header><span>{plan.name.toUpperCase()}</span><strong>${plan.monthly_price_usd}<small>{plan.code === "free" ? " / forever" : " / month"}</small></strong><p>{plan.description}</p></header><ul>{Object.entries(plan.entitlements).slice(0, 8).map(([key, value]) => <li key={key}><b>✓</b><span>{key.replaceAll("_", " ")}{typeof value === "string" ? `: ${value}` : ""}</span></li>)}</ul><footer>{plan.code === current ? <b>CURRENT PLAN</b> : plan.code === "free" ? <span>Free access remains after any cancellation.</span> : <Link className="billing-purchase" href={`/agency/dashboard/agencies/${agencyId}/billing/checkout?plan=${plan.code}`}>CHOOSE {plan.name.toUpperCase()} <span>→</span></Link>}</footer></article>)}</section>
    {trialAvailable && current === "free" && <section className="billing-trial"><div><p>NO CREDIT CARD REQUIRED</p><h2>Try Privé for seven days.</h2><span>Explore enhanced profile, portfolio, inquiries, analytics, and lead tools. Your Free profile remains when the trial ends.</span></div><form action={startTrial.bind(null, agencyId)}><button>START 7-DAY PRIVÉ TRIAL →</button></form></section>}
    <section className="invoice-history"><header><div><p>DOCUMENT CENTER</p><h2>Invoices &amp; payment history</h2></div><span>Downloadable PDF records stay available on any signed-in device.</span></header>{history.length ? <div>{history.map((invoice) => { const order = Array.isArray(invoice.ap_payment_orders) ? invoice.ap_payment_orders[0] : invoice.ap_payment_orders; return <Link href={`/agency/dashboard/agencies/${agencyId}/billing/invoices/${invoice.id}`} key={invoice.id}><span className={invoice.status}>{invoice.status}</span><p><b>{invoice.invoice_number}</b><small>{String(order?.plan_code || "plan").toUpperCase()} · {String(order?.provider || "payment").toUpperCase()}</small></p><strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency }).format(invoice.total_amount)}</strong><time>{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(invoice.issued_at))}</time><em>VIEW →</em></Link>; })}</div> : <p className="invoice-empty">No invoices yet. Your first invoice will be created when you begin checkout.</p>}</section>
  </main></AgencyWorkspaceShell>;
}
