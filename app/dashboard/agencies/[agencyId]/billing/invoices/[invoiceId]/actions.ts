"use server";
import { redirect } from "next/navigation";
import { requireAgencyRole } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Invoice } from "@/lib/billing/reliable/invoice";
import { sendSandboxInvoiceTest } from "@/lib/billing/reliable/test-email";

export async function sendTestInvoiceEmail(agencyId: string, invoiceId: string) {
  const { user } = await requireAgencyRole(agencyId, ["owner", "admin", "billing"]);
  const { data, error } = await createAdminClient().from("ap_invoices").select("*").eq("agency_id", agencyId).eq("id", invoiceId).single();
  let result = "sent";
  if (error || !data) result = "unavailable";
  else {
    try { await sendSandboxInvoiceTest(data as Invoice, user.email || ""); }
    catch { result = "failed"; }
  }
  redirect(`/agency/dashboard/agencies/${agencyId}/billing/invoices/${invoiceId}?testEmail=${result}`);
}
