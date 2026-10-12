import Link from "next/link";
import { requireAgencyRole } from "@/lib/auth/authorization";
import { openReviewDispute, submitAgencyResponse, submitReviewReport } from "@/app/dashboard/reviews/actions";

export default async function AgencyReviews({ params, searchParams }: { params: Promise<{agencyId:string}>; searchParams: Promise<Record<string,string|undefined>> }) {
  const { agencyId } = await params; const query = await searchParams;
  const { supabase, role } = await requireAgencyRole(agencyId,["owner","admin","editor","analyst"]);
  const { data: agency } = await supabase.from("ap_agencies").select("name").eq("id",agencyId).maybeSingle();
  const { data: reviews } = await supabase.from("ap_reviews").select("id,rating,body,status,moderation_reason,created_at,ap_review_responses(id,response_body,status,moderation_reason)").eq("agency_id",agencyId).order("created_at",{ascending:false});
  const canAct = ["owner","admin"].includes(role);
  return <main><p className="eyebrow">Credibility and response management</p><h1>{agency?.name ?? "Agency"} reviews</h1>
    {query.error && <p className="error" role="alert">{query.error}</p>}
    {query.responded && <p role="status">Response submitted for moderation.</p>}{query.reported && <p role="status">Report submitted to trust operations.</p>}{query.disputed && <p role="status">Dispute opened for independent review.</p>}
    <p className="lede">Responses, reports, and disputes are recorded separately. Agencies cannot edit customer reviews or publish their own responses.</p>
    <div className="stack">{reviews?.length ? reviews.map(review => {
      const responses = Array.isArray(review.ap_review_responses)
  ? review.ap_review_responses
  : review.ap_review_responses
    ? [review.ap_review_responses]
    : [];
      return <article className="moderation-card" key={review.id}><p className="eyebrow">{review.status}</p><h2>{review.rating}/5</h2><p>{review.body}</p>
        {review.moderation_reason && <p><strong>Moderation record:</strong> {review.moderation_reason}</p>}
        {responses.map(response => <div className="response" key={response.id}><p><strong>Agency response ({response.status})</strong></p><p>{response.response_body}</p>{response.moderation_reason && <p><strong>Moderation record:</strong> {response.moderation_reason}</p>}</div>)}
        {canAct && review.status === "published" && responses.length === 0 && <form action={submitAgencyResponse.bind(null,agencyId,review.id)}><label>Public agency response<textarea name="response_text" minLength={10} maxLength={3000} required /></label><button>Submit response</button></form>}
        {canAct && review.status === "published" && <details><summary>Report or dispute this review</summary>
          <form action={submitReviewReport.bind(null,agencyId,review.id)}><label>Report reason<textarea name="report_reason" minLength={20} required /></label><label>Private evidence notes<textarea name="evidence_notes" /></label><button className="button-warning">Submit report</button></form>
          <form action={openReviewDispute.bind(null,agencyId,review.id)}><label>Dispute reason<textarea name="dispute_reason" minLength={20} required /></label><label>Private evidence notes<textarea name="evidence_notes" /></label><button className="button-danger">Open formal dispute</button></form>
        </details>}
      </article>;
    }) : <p>No reviews have been submitted for this agency.</p>}</div>
    <p><Link href={`/agency/dashboard/agencies/${agencyId}`}>Return to agency profile</Link></p>
  </main>;
}
