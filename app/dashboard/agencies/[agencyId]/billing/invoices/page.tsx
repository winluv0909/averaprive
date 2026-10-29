import Link from "next/link";
import {requireAgencyRole} from "@/lib/auth/authorization";
import {createAdminClient} from "@/lib/supabase/admin";
import {AgencyWorkspaceShell} from "@/app/dashboard/_components/portal-shells";
export default async function InvoicesPage({params}:{params:Promise<{agencyId:string}>}) {
  const {agencyId}=await params,{user}=await requireAgencyRole(agencyId,["owner","admin","billing"]);
  const {data,error}=await createAdminClient().from("ap_invoices").select("id,invoice_number,status,total_amount,currency,issued_at,payment_snapshot").eq("agency_id",agencyId).order("issued_at",{ascending:false}).limit(100);
  if(error) throw new Error("Invoices could not be loaded");
  const root=`/agency/dashboard/agencies/${agencyId}/billing`;
  return <AgencyWorkspaceShell email={user.email}><main className="reliable-billing"><header><p>BILLING RECORDS</p><h1>Invoices</h1><Link href={root}>Back to billing</Link></header><section className="reliable-card"><div className="invoice-list-scroll" role="region" aria-label="Invoice history" tabIndex={0}><table><thead><tr><th scope="col">Invoice</th><th scope="col">Issued</th><th scope="col">Status</th><th scope="col">Total</th></tr></thead><tbody>{data?.map(invoice=><tr key={invoice.id}><td><Link href={`${root}/invoices/${invoice.id}`}>{invoice.invoice_number}</Link></td><td>{new Date(invoice.issued_at).toLocaleDateString("en-US",{timeZone:"UTC"})}</td><td>{invoice.status}{invoice.payment_snapshot?.environment === "sandbox" ? " (sandbox test)" : ""}</td><td>{invoice.currency} {Number(invoice.total_amount).toFixed(2)}</td></tr>)}</tbody></table></div>{!data?.length&&<p>No invoices yet.</p>}</section></main></AgencyWorkspaceShell>;
}
