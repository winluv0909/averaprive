import Link from "next/link";
import { requireStaffRole } from "@/lib/auth/authorization";
import { OwnerOperationsShell } from "@/app/dashboard/_components/portal-shells";

type AuditRow = { id: number; actor_user_id: string | null; action: string; target_type: string; target_id: string | null; metadata: Record<string, unknown> | null; created_at: string; ap_agencies: { name: string } | { name: string }[] | null };

const labels: Record<string, string> = {
  "agency.created": "Agency created", "agency.profile_updated": "Profile updated", "agency.submitted": "Profile submitted",
  "agency.moderation_decision": "Moderation decision", "agency.published": "Agency published", "verification.submitted": "Verification submitted",
  "verification.decision": "Verification decision", "review.submitted": "Review submitted", "review.moderation_decision": "Review decision",
  "review.reported": "Review reported", "review.dispute_opened": "Dispute opened", "report.decision": "Report decision",
  "dispute.decision": "Dispute decision", "review_response.moderation_decision": "Response decision",
};
const humanize = (value: string) => labels[value] ?? value.replaceAll(".", " · ").replaceAll("_", " ");
const actor = (value: string | null) => value ? value.slice(0, 8).toUpperCase() : "SYSTEM";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = await searchParams;
  const { supabase, user } = await requireStaffRole(["super_admin"]);
  let request = supabase.from("ap_security_audit").select("id,actor_user_id,action,target_type,target_id,metadata,created_at,ap_agencies(name)").order("created_at", { ascending: false }).limit(100);
  if (filters.type && filters.type !== "all") request = request.eq("target_type", filters.type);
  if (filters.action?.trim()) request = request.ilike("action", `%${filters.action.trim()}%`);
  const { data } = await request;
  const rows = (data ?? []) as AuditRow[];
  const uniqueActors = new Set(rows.map((row) => row.actor_user_id).filter(Boolean)).size;

  return <OwnerOperationsShell active="audit" email={user.email}><main className="audit-main">
    <header className="ops-header"><div><p className="ops-kicker">GOVERNANCE &amp; ACCOUNTABILITY</p><h1>Audit log.</h1><p>A chronological record of administrative and trust actions. Entries are read-only and attributable to the responsible account.</p></div><div className="ops-summary"><span>VISIBLE RECORDS</span><strong>{rows.length}</strong><small>{uniqueActors} identifiable actors</small></div></header>
    <form className="audit-filters"><label><span>ACTION SEARCH</span><input name="action" defaultValue={filters.action ?? ""} placeholder="Example: verification or dispute" /></label><label><span>RECORD TYPE</span><select name="type" defaultValue={filters.type ?? "all"}><option value="all">All record types</option><option value="agency">Agency</option><option value="verification">Verification</option><option value="review">Review</option><option value="report">Report</option><option value="dispute">Dispute</option><option value="review_response">Review response</option></select></label><button>APPLY FILTERS</button><Link href="/owners/dashboard/audit">RESET</Link></form>
    <section className="audit-panel"><div className="audit-table-head"><span>DATE &amp; TIME</span><span>ACTION</span><span>ACTOR</span><span>AGENCY / TARGET</span><span>DETAILS</span></div>
      {rows.length ? rows.map((row) => { const agency = Array.isArray(row.ap_agencies) ? row.ap_agencies[0] : row.ap_agencies; const details = row.metadata && Object.keys(row.metadata).length ? JSON.stringify(row.metadata) : "No additional metadata"; return <article className="audit-row" key={row.id}><time>{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(row.created_at))}</time><span><b>{humanize(row.action)}</b><small>{row.target_type.toUpperCase()}</small></span><span><b>{actor(row.actor_user_id)}</b><small>{row.actor_user_id ? "AUTHENTICATED USER" : "SYSTEM ACTION"}</small></span><span><b>{agency?.name ?? "Platform record"}</b><small>{row.target_id?.slice(0, 12) ?? "NO TARGET ID"}</small></span><details><summary>VIEW</summary><pre>{details}</pre></details></article>; }) : <div className="ops-empty"><strong>No matching audit records.</strong><span>Adjust the filters or return after platform actions have been recorded.</span></div>}
    </section><p className="audit-note">Showing the 100 most recent matching records. Audit entries cannot be edited from the owner portal.</p>
  </main></OwnerOperationsShell>;
}
