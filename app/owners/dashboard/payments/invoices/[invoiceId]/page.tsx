import {notFound} from "next/navigation";
import {requireStaffRole} from "@/lib/auth/authorization";
import {createAdminClient} from "@/lib/supabase/admin";
import {OwnerOperationsShell} from "@/app/dashboard/_components/portal-shells";
import {InvoiceDocument} from "@/app/dashboard/_components/invoice-document";
import type {Invoice} from "@/lib/billing/reliable/invoice";
export default async function OwnerInvoicePage({params}:{params:Promise<{invoiceId:string}>}) {
  const {user}=await requireStaffRole(["super_admin","finance"]);
  const {invoiceId}=await params;
  const {data,error}=await createAdminClient().from("ap_invoices").select("*").eq("id",invoiceId).single();
  if(error||!data) notFound();
  return <OwnerOperationsShell active="payments" email={user.email}><InvoiceDocument invoice={data as Invoice} ownerView/></OwnerOperationsShell>;
}
