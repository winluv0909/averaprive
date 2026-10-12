import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/authorization";
import { moderateResponse } from "../../actions";

export default async function ResponseDecision({params,searchParams}:{params:Promise<{responseId:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
  const {responseId}=await params; const query=await searchParams;
  const {supabase}=await requireStaffRole(["super_admin","moderator"]);
  const {data:item}=await supabase.from("ap_review_responses").select("id,response_body,status,moderation_reason,ap_agencies(name),ap_reviews(rating,body)").eq("id",responseId).maybeSingle();
  if(!item) notFound();
  const agency=Array.isArray(item.ap_agencies)?item.ap_agencies[0]:item.ap_agencies;
  const review=Array.isArray(item.ap_reviews)?item.ap_reviews[0]:item.ap_reviews;
  const reviewable=["pending","published"].includes(item.status);
  return <main><p className="eyebrow">Response status: {item.status}</p><h1>{agency?.name ?? "Agency response"}</h1>
    {query.error&&<p className="error" role="alert">{query.error}</p>}{query.reviewed&&<p role="status">Response decision recorded: {query.reviewed}.</p>}
    <section className="panel"><p><strong>Original review ({review?.rating}/5)</strong></p><p>{review?.body}</p><div className="response"><p><strong>Proposed agency response</strong></p><p>{item.response_body}</p></div></section>
    {reviewable&&<div className="moderation-actions"><DecisionForm responseId={responseId} decision="publish" label="Publish response"/><DecisionForm responseId={responseId} decision="reject" label="Reject response" danger/>{item.status==="published"&&<DecisionForm responseId={responseId} decision="hide" label="Hide response"/>}</div>}
    <p><Link href="/owners/dashboard/trust">Return to trust queue</Link></p>
  </main>;
}
function DecisionForm({responseId,decision,label,danger=false}:{responseId:string;decision:"publish"|"reject"|"hide";label:string;danger?:boolean}){return <form className="panel" action={moderateResponse.bind(null,responseId,decision)}><label>Evidence-based reason<textarea name="reason" minLength={20} required/></label><button className={danger?"button-danger":undefined}>{label}</button></form>}
