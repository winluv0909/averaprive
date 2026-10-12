import { OperationsRecords } from "../_components/operations-records";
import Link from "next/link";
import { requireStaffRole } from "@/lib/auth/authorization";
import { OwnerOperationsShell } from "../_components/portal-shells";

export default async function ModerationQueue() {
  const { supabase, user } = await requireStaffRole(["super_admin", "moderator"]);
  const { data: agencies } = await supabase.from("ap_agencies").select("id,name,country,publication_status,submitted_at").in("publication_status", ["submitted", "approved"]).order("submitted_at", { ascending: true });
  return <OwnerOperationsShell active="moderation" email={user.email}><main className="owner-section-page owner-section-moderation ops-main"><header className="ops-header"><div><p className="ops-kicker">TRUST OPERATIONS</p><h1>Moderation queue.</h1><p>Review agency profiles for completeness and policy compliance. Approval and publication remain separate decisions.</p></div><div className="ops-summary"><span>PROFILES WAITING</span><strong>{agencies?.length ?? 0}</strong><small>Oldest submissions first</small></div></header><div className="ops-toolbar"><span>Profiles requiring an owner decision</span><Link href="/owners/dashboard">RETURN TO OVERVIEW</Link></div><OperationsRecords title="Agency submissions" records={(agencies ?? []).map(agency => ({ id: agency.id, name: agency.name, summary: agency.country || "Country not provided", status: agency.publication_status, date: agency.submitted_at, href: `/owners/dashboard/moderation/${agency.id}`, action: "Review profile" }))} emptyTitle="Moderation is clear" emptyDescription="No agency profiles are currently awaiting approval or publication." /></main></OwnerOperationsShell>;
}
