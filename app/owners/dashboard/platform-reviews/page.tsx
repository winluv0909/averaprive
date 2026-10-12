import Link from "next/link";
import { requireStaffRole } from "@/lib/auth/authorization";
import { OwnerOperationsShell } from "@/app/dashboard/_components/portal-shells";
import { moderatePlatformReview } from "./actions";

export default async function PlatformReviewQueue({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const status = ["pending", "approved", "rejected"].includes(query.status ?? "") ? query.status! : "pending";
  const parsed = Number(query.page ?? 1);
  const page = Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100000 ? parsed : 1;
  const { supabase, user } = await requireStaffRole(["super_admin"]);
  const { data: reviews, count, error } = await supabase.from("ap_platform_reviews")
    .select("id,display_name,audience,rating,title,body,status,revision,moderation_note,created_at", { count: "exact" })
    .eq("status", status).order("created_at", { ascending: false }).order("id").range((page - 1) * 20, page * 20 - 1);
  return <OwnerOperationsShell active="platform_reviews" email={user.email}><main className="owner-section-page owner-section-platform-reviews ops-main">
    <header className="ops-header"><div><p className="ops-kicker">PLATFORM FEEDBACK</p><h1>Avera Privé reviews.</h1>
      <p>Use the same standards for positive and negative reviews. Reject only for a documented reason such as spam, impersonation, harassment, private information or irrelevant content.</p></div></header>
    <div className="ops-toolbar"><Link href="/owners/dashboard/reviews">Agency review queue</Link><Link href="/platform-reviews" target="_blank">View published platform reviews</Link></div>
    <nav className="ops-toolbar" aria-label="Review status">{["pending", "approved", "rejected"].map(value => <Link key={value} href={`/owners/dashboard/platform-reviews?status=${value}`} aria-current={value === status ? "page" : undefined}>{value.toUpperCase()}</Link>)}</nav>
    {query.error && <p role="alert">{query.error}</p>}{query.saved && <p role="status">Decision saved. The homepage refreshes published reviews within one minute or when reloaded.</p>}
    {error ? <p role="alert">Could not load platform reviews. Apply migration 020 and try again.</p> : <>
      <section className="ops-grid">{reviews?.length ? reviews.map(review => <article className="ops-card" key={review.id}>
        <div className="ops-card-top"><span className="ops-badge">{review.status}</span><span>{review.rating}/5</span></div>
        <h2>{review.title}</h2><p>{review.display_name} · {review.audience === "business" ? "Business user" : "Creator / viewer"} (self-described)</p>
        <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{review.body}</p>
        {review.moderation_note && <p>Previous explanation: {review.moderation_note}</p>}
        <form className="moderation-actions"><input type="hidden" name="revision" value={review.revision} />
          <label>Decision explanation (shared with reviewer)<textarea name="note" required minLength={10} maxLength={1000} /></label>
          <button formAction={moderatePlatformReview.bind(null, review.id, "approved")}>Approve and publish</button>
          <button className="button-danger" formAction={moderatePlatformReview.bind(null, review.id, "rejected")}>{status === "approved" ? "Unpublish with explanation" : "Reject with explanation"}</button>
        </form></article>) : <div className="ops-empty">No {status} platform reviews on this page.</div>}</section>
      <nav className="ops-toolbar" aria-label="Queue pagination">{page > 1 && <Link href={`/owners/dashboard/platform-reviews?status=${status}&page=${page - 1}`}>Previous</Link>}
        {page * 20 < (count ?? 0) && <Link href={`/owners/dashboard/platform-reviews?status=${status}&page=${page + 1}`}>Next</Link>}</nav>
    </>}
  </main></OwnerOperationsShell>;
}
