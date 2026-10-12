import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/authorization";
import { OwnerOperationsShell } from "../../../_components/portal-shells";
import { CaseHistory } from "../../../_components/case-history";
import { decideReport } from "../../actions";

export default async function ReportDecision({params,searchParams}:{params:Promise<{reportId:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
  const {reportId}=await params; const query=await searchParams;
  const {supabase,user}=await requireStaffRole(["super_admin","moderator","support"]);
  const {data:item}=await supabase.from("ap_reports").select("id,agency_id,category,reason,evidence_private,created_at,ap_agencies(name),ap_reviews(rating,body),ap_report_decisions(id,decision,reason)").eq("id",reportId).maybeSingle();
  if(!item) notFound();
  const {data:history}=await supabase.from("ap_security_audit").select("id,action,actor_user_id,metadata,created_at").eq("target_id",reportId).order("created_at");
  const agency=Array.isArray(item.ap_agencies)?item.ap_agencies[0]:item.ap_agencies; const review=Array.isArray(item.ap_reviews)?item.ap_reviews[0]:item.ap_reviews;
  const evidence=(item.evidence_private??{}) as Record<string,string>; const decisions=Array.isArray(item.ap_report_decisions)?item.ap_report_decisions:item.ap_report_decisions?[item.ap_report_decisions]:[]; const open=decisions.length===0;
  return <OwnerOperationsShell active="trust" email={user.email}><main className="case-main"><nav className="workflow-breadcrumb"><Link href="/owners/dashboard/trust">TRUST QUEUE</Link><span>/</span><b>REPORT CASE</b></nav><header className="case-header"><div><p>REPORT · {(item.category??"other").toUpperCase()}</p><h1>{agency?.name??"Reported content"}</h1><span>Review submitted evidence, record a defensible decision, and preserve a traceable case history.</span></div><div><small>CASE ID</small><b>{reportId.slice(0,8).toUpperCase()}</b><span className={open?"open":"resolved"}>{open?"OPEN":"RESOLVED"}</span></div></header>
    {query.error&&<p className="profile-flash error" role="alert">{query.error}</p>}{query.reviewed&&<p className="profile-flash" role="status">Report decision recorded: {query.reviewed.replace("_"," ")}.</p>}
    <div className="case-layout"><div><section className="case-evidence"><div className="case-section-head"><p>SUBMITTED MATERIAL</p><h2>Report evidence</h2></div><dl><div><dt>REPORTED REVIEW</dt><dd>{review?`${review.rating}/5 — ${review.body}`:"Agency-level report"}</dd></div><div><dt>REPORT REASON</dt><dd>{item.reason}</dd></div><div><dt>PRIVATE EVIDENCE</dt><dd>{evidence.evidence_notes||"Not provided"}</dd></div>{decisions.map(d=><div key={d.id}><dt>FINAL DECISION</dt><dd><b>{d.decision.replace("_"," ")}</b><br/>{d.reason}</dd></div>)}</dl></section><CaseHistory events={history??[]} openedAt={item.created_at} openedLabel="report opened" /></div>
    <aside>{open?<section className="case-actions"><p>REVIEW DECISION</p><h2>Resolve this report</h2><ReportForm reportId={reportId} decision="action_taken" label="RECORD ACTION TAKEN"/><ReportForm reportId={reportId} decision="dismissed" label="DISMISS REPORT" danger/></section>:<section className="case-closed"><span>✓</span><h2>Case resolved</h2><p>This report has a recorded decision and is no longer awaiting action.</p></section>}</aside></div></main></OwnerOperationsShell>;
}
function ReportForm({reportId,decision,label,danger=false}:{reportId:string;decision:"action_taken"|"dismissed";label:string;danger?:boolean}){return <form action={decideReport.bind(null,reportId,decision)}><label><span>{decision==="action_taken"?"ACTION & RATIONALE":"DISMISSAL RATIONALE"}</span><textarea name="reason" minLength={20} required placeholder="Record the evidence reviewed and reason for this decision."/></label><button className={danger?"danger":undefined}>{label} <b>→</b></button></form>}
