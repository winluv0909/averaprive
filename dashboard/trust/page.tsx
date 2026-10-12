import Link from "next/link";
import { requireStaffRole } from "@/lib/auth/authorization";
import { OwnerOperationsShell } from "../_components/portal-shells";

type QueueItem = { id: string; status?: string | null; category?: string | null; response_body?: string | null; reason?: string | null; created_at?: string | null; ap_agencies?: { name: string } | { name: string }[] | null };

function TrustCard({ item, href, action }: { item: QueueItem; href: string; action: string }) {
  const agency = Array.isArray(item.ap_agencies) ? item.ap_agencies[0] : item.ap_agencies;
  return <article className="ops-card"><div className="ops-card-top"><span className="ops-badge">{item.status ?? item.category ?? "pending"}</span><span className="ops-card-id">{item.id.slice(0, 8)}</span></div><h2>{agency?.name ?? "Agency"}</h2><p>{item.response_body ?? item.reason ?? "No summary supplied."}</p><div className="ops-card-footer"><small>{item.created_at ? new Date(item.created_at).toLocaleDateString("en-PH") : "Date unavailable"}</small><Link className="ops-action" href={href}>{action.toUpperCase()} →</Link></div></article>;
}

export default async function TrustQueue() {
  const { supabase, user } = await requireStaffRole(["super_admin", "moderator", "support"]);
  const [{ data: responses }, { data: reports }, { data: disputes }] = await Promise.all([
    supabase.from("ap_review_responses").select("id,response_body,status,created_at,ap_agencies(name)").eq("status", "pending").order("created_at"),
    supabase.from("ap_reports").select("id,category,reason,created_at,ap_agencies(name),ap_report_decisions(id)").order("created_at"),
    supabase.from("ap_disputes").select("id,reason,status,created_at,ap_agencies(name)").in("status", ["open", "investigating"]).order("created_at"),
  ]);
  const undecidedReports = reports?.filter((report) => { const decisions = Array.isArray(report.ap_report_decisions) ? report.ap_report_decisions : report.ap_report_decisions ? [report.ap_report_decisions] : []; return decisions.length === 0; }) ?? [];
  const total = (responses?.length ?? 0) + undecidedReports.length + (disputes?.length ?? 0);
  return <OwnerOperationsShell active="trust" email={user.email}><main className="ops-main"><header className="ops-header"><div><p className="ops-kicker">SAFETY &amp; ACCOUNTABILITY</p><h1>Reports &amp; disputes.</h1><p>Resolve agency responses, community reports, and open disputes through traceable evidence-based decisions.</p></div><div className="ops-summary"><span>OPEN TRUST CASES</span><strong>{total}</strong><small>Across three workflows</small></div></header><div className="ops-toolbar"><span>Cases are separated by workflow and decision type</span><Link href="/owners/dashboard">RETURN TO OVERVIEW</Link></div>
    <section className="ops-group"><div className="ops-group-head"><h2>Agency responses</h2><span>{responses?.length ?? 0} WAITING</span></div><div className="ops-grid">{responses?.length ? responses.map((item) => <TrustCard key={item.id} item={item} href={`/owners/dashboard/trust/responses/${item.id}`} action="Moderate response" />) : <div className="ops-empty"><strong>No pending responses.</strong><span>Agency review responses are currently up to date.</span></div>}</div></section>
    <section className="ops-group"><div className="ops-group-head"><h2>Community reports</h2><span>{undecidedReports.length} WAITING</span></div><div className="ops-grid">{undecidedReports.length ? undecidedReports.map((item) => <TrustCard key={item.id} item={item} href={`/owners/dashboard/trust/reports/${item.id}`} action="Review report" />) : <div className="ops-empty"><strong>No undecided reports.</strong><span>Every submitted report currently has an owner decision.</span></div>}</div></section>
    <section className="ops-group"><div className="ops-group-head"><h2>Open disputes</h2><span>{disputes?.length ?? 0} WAITING</span></div><div className="ops-grid">{disputes?.length ? disputes.map((item) => <TrustCard key={item.id} item={item} href={`/owners/dashboard/trust/disputes/${item.id}`} action="Resolve dispute" />) : <div className="ops-empty"><strong>No active disputes.</strong><span>There are no open or investigating disputes at this time.</span></div>}</div></section>
  </main></OwnerOperationsShell>;
}
