import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaffRole } from "@/lib/auth/authorization";
import { publishAgency, reviewAgencySubmission } from "../actions";

export default async function ModerationReview({ params, searchParams }: { params: Promise<{agencyId:string}>; searchParams: Promise<Record<string,string|undefined>> }) {
  const { agencyId } = await params;
  const query = await searchParams;
  const { supabase } = await requireStaffRole(["super_admin", "moderator"]);
  const { data: agency } = await supabase.from("ap_agencies").select("*").eq("id", agencyId).maybeSingle();
  if (!agency) notFound();
  const join = (values: string[] | null) => values?.join(", ") || "Not provided";
  const submitted = agency.publication_status === "submitted";
  const approved = agency.publication_status === "approved";

  return <main>
    <p className="eyebrow">Moderation status: {agency.publication_status}</p>
    <h1>{agency.name}</h1>
    <section className="panel">
      {query.error && <p className="error" role="alert">{query.error}</p>}
      {query.reviewed && <p role="status">Moderation decision recorded: {query.reviewed.replace("_", " ")}.</p>}
      {query.published && <p role="status">Profile published.</p>}
      <dl className="profile-summary">
        <dt>Positioning</dt><dd>{agency.tagline || "Not provided"}</dd>
        <dt>Location</dt><dd>{[agency.city,agency.country].filter(Boolean).join(", ") || "Not provided"}</dd>
        <dt>Website</dt><dd>{agency.website_url || "Not provided"}</dd>
        <dt>About</dt><dd>{agency.about || "Not provided"}</dd>
        <dt>Services</dt><dd>{join(agency.services)}</dd>
        <dt>Creator niches</dt><dd>{join(agency.creator_niches)}</dd>
        <dt>Regions served</dt><dd>{join(agency.regions_served)}</dd>
        <dt>Published</dt><dd>{agency.published ? "Yes" : "No"}</dd>
      </dl>
    </section>

    {submitted && <div className="moderation-actions">
      <form className="panel" action={reviewAgencySubmission.bind(null,agencyId,"approve")}>
        <label>Approval note<textarea name="reviewer_note" minLength={10} required placeholder="Explain what was reviewed and why it passed."/></label>
        <button>Approve profile</button>
      </form>
      <form className="panel" action={reviewAgencySubmission.bind(null,agencyId,"request_changes")}>
        <label>Requested changes<textarea name="reviewer_note" minLength={10} required placeholder="Explain exactly what the agency must correct."/></label>
        <button className="button-warning">Request changes</button>
      </form>
      <form className="panel" action={reviewAgencySubmission.bind(null,agencyId,"reject")}>
        <label>Rejection reason<textarea name="reviewer_note" minLength={10} required placeholder="Record the evidence-based reason for rejection."/></label>
        <button className="button-danger">Reject submission</button>
      </form>
    </div>}

    {approved && <form className="panel" action={publishAgency.bind(null,agencyId)} style={{marginTop:20}}>
      <p><strong>Approved but still private.</strong> Publishing is a separate staff action.</p>
      <button>Publish approved profile</button>
    </form>}
    <p><Link href="/owners/dashboard/moderation">Return to moderation queue</Link></p>
  </main>;
}
