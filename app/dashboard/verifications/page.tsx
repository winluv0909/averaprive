import { OperationsRecords } from "../_components/operations-records";
import Link from "next/link";
import { requireStaffRole } from "@/lib/auth/authorization";
import { OwnerOperationsShell } from "../_components/portal-shells";

export default async function VerificationQueue() {
  const { supabase, user } = await requireStaffRole(["super_admin", "verification_reviewer"]);
  const { data: requests } = await supabase.from("ap_verifications").select("id,agency_id,status,submitted_at,ap_agencies(name,country)").in("status", ["pending", "needs_information"]).order("submitted_at", { ascending: true });
  return <OwnerOperationsShell active="verification" email={user.email}><main className="owner-section-page owner-section-verifications ops-main"><header className="ops-header"><div><p className="ops-kicker">INDEPENDENT TRUST REVIEW</p><h1>Verification queue.</h1><p>Review private business evidence independently from billing, visibility, ranking, and publication decisions.</p></div><div className="ops-summary"><span>REQUESTS WAITING</span><strong>{requests?.length ?? 0}</strong><small>Evidence review required</small></div></header><div className="ops-toolbar"><span>Secure evidence is visible only to authorized reviewers</span><Link href="/owners/dashboard">RETURN TO OVERVIEW</Link></div><OperationsRecords title="Business evidence requests" records={(requests ?? []).map(request => { const agency = Array.isArray(request.ap_agencies) ? request.ap_agencies[0] : request.ap_agencies; return { id: request.id, name: agency?.name ?? "Agency", summary: agency?.country ?? "Country not provided", status: request.status, date: request.submitted_at, href: `/owners/dashboard/verifications/${request.id}`, action: "Review evidence" }; })} emptyTitle="Verification is clear" emptyDescription="No business-evidence requests are currently awaiting independent review." /></main></OwnerOperationsShell>;
}
