import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/authorization";
import { moderateReview } from "../actions";
import { flagReviewForFraud } from "../../fraud/actions";
import { OwnerOperationsShell } from "../../_components/portal-shells";

export default async function ReviewDecision({ params, searchParams }: { params: Promise<{reviewId:string}>; searchParams: Promise<Record<string,string|undefined>> }) {
  const { reviewId } = await params; const query = await searchParams;
  const { supabase, user } = await requireStaffRole(["super_admin","moderator"]);
  const { data: review } = await supabase.from("ap_reviews")
    .select("id,agency_id,reviewer_id,rating,body,status,relationship_evidence_private,relationship_checked,moderation_reason,ap_agencies(name,country,published)")
    .eq("id",reviewId).maybeSingle();
  if (!review) notFound();
  const { data: investigations } = await supabase.from("ap_fraud_investigations").select("id,severity,status,signal_type").eq("target_type","review").eq("target_id",reviewId).in("status",["open","investigating"]);
  const agency = Array.isArray(review.ap_agencies) ? review.ap_agencies[0] : review.ap_agencies;
  const evidence = (review.relationship_evidence_private ?? {}) as Record<string,string>;
  const reviewable = ["pending","published"].includes(review.status);
  return <OwnerOperationsShell active="reviews" email={user.email}><main className="review-decision-main"><nav className="workflow-breadcrumb"><Link href="/owners/dashboard/reviews">REVIEW QUEUE</Link><span>/</span><b>SUBMISSION</b></nav><p className="eyebrow">Review status: {review.status}</p><h1>{agency?.name ?? "Review decision"}</h1>
    {query.error && <p className="error" role="alert">{query.error}</p>}{query.reviewed && <p role="status">Review decision recorded: {query.reviewed}.</p>}{query.flagged && <p className="profile-flash" role="status">Fraud investigation opened for independent review.</p>}
    {!!investigations?.length && <aside className="fraud-review-alert"><span>⌁</span><div><b>{investigations.length} OPEN INTEGRITY SIGNAL{investigations.length===1?"":"S"}</b><p>This review requires an independent fraud assessment before publication.</p></div><Link href={`/owners/dashboard/fraud/${investigations[0].id}`}>OPEN INVESTIGATION →</Link></aside>}
    <section className="panel"><p><strong>Rating:</strong> {review.rating}/5</p><p>{review.body}</p><dl className="profile-summary"><dt>Relationship</dt><dd>{evidence.relationship || "Not provided"}</dd><dt>Evidence notes</dt><dd>{evidence.evidence_notes || "Not provided"}</dd><dt>Agency visible</dt><dd>{agency?.published ? "Yes" : "No"}</dd></dl></section>
    {reviewable && <div className="moderation-actions">
      <form className="panel" action={moderateReview.bind(null,reviewId,"publish")}><label className="checkbox-label"><input type="checkbox" name="relationship_verified" required /> Relationship evidence independently verified</label><label>Publication reason<textarea name="reviewer_reason" minLength={20} required /></label><button>Publish review</button></form>
      <form className="panel" action={moderateReview.bind(null,reviewId,"reject")}><label>Rejection reason<textarea name="reviewer_reason" minLength={20} required /></label><button className="button-danger">Reject review</button></form>
      {review.status === "published" && <form className="panel" action={moderateReview.bind(null,reviewId,"hide")}><label>Evidence-based removal reason<textarea name="reviewer_reason" minLength={20} required /></label><button className="button-warning">Hide published review</button></form>}
    </div>}
    {!investigations?.length && <details className="manual-fraud-flag"><summary>Flag suspicious activity for fraud review</summary><form action={flagReviewForFraud.bind(null,reviewId)}><label>Risk severity<select name="severity" defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label>Evidence-based concern<textarea name="summary" minLength={10} required placeholder="Describe the suspicious pattern or integrity concern."/></label><button className="button-warning">Open fraud investigation</button></form></details>}
    <p><Link href="/owners/dashboard/reviews">Return to review queue</Link></p>
  </main></OwnerOperationsShell>;
}
