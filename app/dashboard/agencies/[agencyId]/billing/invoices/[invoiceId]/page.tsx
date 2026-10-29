import {notFound} from "next/navigation";
import {requireAgencyRole} from "@/lib/auth/authorization";
import {createAdminClient} from "@/lib/supabase/admin";
import {AgencyWorkspaceShell} from "@/app/dashboard/_components/portal-shells";
import {InvoiceDocument} from "@/app/dashboard/_components/invoice-document";
import type {Invoice} from "@/lib/billing/reliable/invoice";
export default async function InvoicePage({params}:{params:Promise<{agencyId:string;invoiceId:string}>}) {
  const {agencyId,invoiceId}=await params;
  const {user}=await requireAgencyRole(agencyId,["owner","admin","billing"]);
  const {data}=await createAdminClient().from("ap_invoices").select("*").eq("agency_id",agencyId).eq("id",invoiceId).single();
  if(!data) notFound();
  return <AgencyWorkspaceShell email={user.email}><InvoiceDocument invoice={data as Invoice} root={`/agency/dashboard/agencies/${agencyId}/billing`}/></AgencyWorkspaceShell>;
}
