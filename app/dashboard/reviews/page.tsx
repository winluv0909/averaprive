import { OperationsRecords } from "../_components/operations-records";
import Link from "next/link";
import { requireStaffRole } from "@/lib/auth/authorization";
import { OwnerOperationsShell } from "../_components/portal-shells";

export default async function ReviewQueue() {
  const { supabase, user } = await requireStaffRole(["super_admin", "moderator"]);
  const { data: reviews } = await supabase.from("ap_reviews").select("id,rating,body,status,created_at,ap_agencies(name,country)").eq("status", "pending").order("created_at");
  return <OwnerOperationsShell active="reviews" email={user.email}><main className="owner-section-page owner-section-reviews ops-main"><header className="ops-header"><div><p className="ops-kicker">RELATIONSHIP EVIDENCE</p><h1>Review queue.</h1><p>Moderate submitted reviews and validate relationship evidence before any review becomes publicly visible.</p></div><div className="ops-summary"><span>REVIEWS WAITING</span><strong>{reviews?.length ?? 0}</strong><small>Publication decisions needed</small></div></header><div className="ops-toolbar"><span>Pending reviews ordered by submission time</span><Link href="/owners/dashboard">RETURN TO OVERVIEW</Link></div><OperationsRecords title="Submitted agency reviews" records={(reviews ?? []).map(review => { const agency = Array.isArray(review.ap_agencies) ? review.ap_agencies[0] : review.ap_agencies; return { id: review.id, name: agency?.name ?? "Agency", summary: `${review.rating}/5 rating · ${agency?.country ?? "Country not provided"} · ${review.body}`, status: review.status, date: review.created_at, href: `/owners/dashboard/reviews/${review.id}`, action: "Review submission" }; })} emptyTitle="Review moderation is clear" emptyDescription="No independent reviews are currently awaiting a decision." /></main></OwnerOperationsShell>;
}
