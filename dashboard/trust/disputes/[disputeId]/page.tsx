import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/authorization";
import { OwnerOperationsShell } from "../../../_components/portal-shells";
import { CaseHistory } from "../../../_components/case-history";
import { resolveDispute } from "../../actions";

export default async function DisputeDecision({params,searchParams}:{params:Promise<{disputeId:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
  const {disputeId}=await params; const query=await searchParams;
  const {supabase,user}=await requireStaffRole(["super_admin","moderator","support"]);
  const {data:item}=await supabase.from("ap_disputes").select("id,agency_id,reason,evidence_private,status,resolution,created_at,ap_agencies(name),ap_reviews(rating,body,status)").eq("id",disputeId).maybeSingle();
  if(!item) notFound();
  const {data:history}=await supabase.from("ap_security_audit").select("id,action,actor_user_id,metadata,created_at").eq("target_id",disputeId).order("created_at");
  const agency=Array.isArray(item.ap_agencies)?item.ap_agencies[0]:item.ap_agencies; const review=Array.isArray(item.ap_reviews)?item.ap_reviews[0]:item.ap_reviews; const evidence=(item.evidence_private??{}) as Record<string,string>; const open=["open","investigating"].includes(item.status);
  return <OwnerOperationsShell active="trust" email={user.email}><main className="case-main"><nav className="workflow-breadcrumb"><Link href="/owners/dashboard/trust">TRUST QUEUE</Link><span>/</span><b>DISPUTE CASE</b></nav><header className="case-header"><div><p>FORMAL DISPUTE</p><h1>{agency?.name??"Review dispute"}</h1><span>Assess the original review, private evidence, and case record before issuing a final resolution.</span></div><div><small>CASE ID</small><b>{disputeId.slice(0,8).toUpperCase()}</b><span className={open?"open":"resolved"}>{item.status.toUpperCase()}</span></div></header>
    {query.error&&<p className="profile-flash error" role="alert">{query.error}</p>}{query.reviewed&&<p className="profile-flash" role="status">Dispute decision recorded: {query.reviewed}.</p>}
    <div className="case-layout"><div><section className="case-evidence"><div className="case-section-head"><p>CASE MATERIAL</p><h2>Dispute evidence</h2></div><dl><div><dt>CONTESTED REVIEW</dt><dd>{review?`${review.rating}/5 (${review.status}) — ${review.body}`:"Review unavailable"}</dd></div><div><dt>DISPUTE REASON</dt><dd>{item.reason}</dd></div><div><dt>PRIVATE EVIDENCE</dt><dd>{evidence.evidence_notes||"Not provided"}</dd></div>{item.resolution&&<div><dt>FINAL RESOLUTION</dt><dd>{item.resolution}</dd></div>}</dl></section><CaseHistory events={history??[]} openedAt={item.created_at} openedLabel="dispute opened" /></div>
    <aside>{open?<section className="case-actions"><p>FINAL RESOLUTION</p><h2>Decide this dispute</h2><DisputeForm disputeId={disputeId} decision="upheld" label="UPHOLD DISPUTE"/><DisputeForm disputeId={disputeId} decision="denied" label="DENY DISPUTE" danger/></section>:<section className="case-closed"><span>✓</span><h2>Dispute resolved</h2><p>The resolution and its supporting reason are preserved in the case record.</p></section>}</aside></div></main></OwnerOperationsShell>;
}
function DisputeForm({disputeId,decision,label,danger=false}:{disputeId:string;decision:"upheld"|"denied";label:string;danger?:boolean}){return <form action={resolveDispute.bind(null,disputeId,decision)}><label><span>{decision==="upheld"?"UPHOLDING RATIONALE":"DENIAL RATIONALE"}</span><textarea name="reason" minLength={20} required placeholder="Record the evidence reviewed and reason for this resolution."/></label><button className={danger?"danger":undefined}>{label} <b>→</b></button></form>}
