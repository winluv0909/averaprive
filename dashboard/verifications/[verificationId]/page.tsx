import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffRole } from "@/lib/auth/authorization";
import { reviewVerification } from "../actions";

export default async function VerificationReview({ params, searchParams }: {
  params: Promise<{ verificationId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { verificationId } = await params;
  const query = await searchParams;
  const { supabase } = await requireStaffRole(["super_admin", "verification_reviewer"]);
  const { data: request } = await supabase
    .from("ap_verifications")
    .select("id,agency_id,status,evidence_private,decision_reason,submitted_at,reviewed_at,ap_agencies(name,country,publication_status,published)")
    .eq("id", verificationId).maybeSingle();
  if (!request) notFound();
  const agency = Array.isArray(request.ap_agencies) ? request.ap_agencies[0] : request.ap_agencies;
  const evidence = (request.evidence_private ?? {}) as Record<string, string>;
  const reviewable = ["pending", "needs_information"].includes(request.status);

  return <main>
    <p className="eyebrow">Verification status: {request.status.replace("_", " ")}</p>
    <h1>{agency?.name ?? "Verification review"}</h1>
    {query.error && <p className="error" role="alert">{query.error}</p>}
    {query.reviewed && <p role="status">Verification decision recorded: {query.reviewed.replace("_", " ")}.</p>}
    <section className="panel">
      <p><strong>Publication:</strong> {agency?.publication_status}; publicly visible: {agency?.published ? "yes" : "no"}</p>
      <dl className="profile-summary">
        <dt>Legal name</dt><dd>{evidence.company_legal_name || "Not provided"}</dd>
        <dt>Registration</dt><dd>{evidence.registration_number || "Not provided"}</dd>
        <dt>Country</dt><dd>{evidence.registration_country || "Not provided"}</dd>
        <dt>Website</dt><dd>{evidence.official_website || "Not provided"}</dd>
        <dt>Representative</dt><dd>{evidence.representative_name || "Not provided"}</dd>
        <dt>Title</dt><dd>{evidence.representative_title || "Not provided"}</dd>
        <dt>Business email</dt><dd>{evidence.business_email || "Not provided"}</dd>
        <dt>Evidence notes</dt><dd>{evidence.evidence_notes || "Not provided"}</dd>
      </dl>
    </section>

    {reviewable && <div className="verification-checks panel">
      <h2>Required independent checks</h2>
      <ul>
        <li>Company identity matches authoritative records</li>
        <li>Official website control is supported</li>
        <li>Representative authority is supported</li>
        <li>Active business presence is supported</li>
      </ul>
      <p>Approving records all four checks as complete. Use “request information” if any check is incomplete.</p>
    </div>}

    {reviewable && <div className="moderation-actions">
      <form className="panel" action={reviewVerification.bind(null, verificationId, "approve")}>
        <label>Evidence-based approval reason<textarea name="reviewer_reason" minLength={20} required /></label>
        <button>Approve verification</button>
      </form>
      <form className="panel" action={reviewVerification.bind(null, verificationId, "needs_information")}>
        <label>Information required<textarea name="reviewer_reason" minLength={20} required /></label>
        <button className="button-warning">Request information</button>
      </form>
      <form className="panel" action={reviewVerification.bind(null, verificationId, "reject")}>
        <label>Evidence-based rejection reason<textarea name="reviewer_reason" minLength={20} required /></label>
        <button className="button-danger">Reject verification</button>
      </form>
    </div>}
    <p><Link href="/owners/dashboard/verifications">Return to verification queue</Link></p>
  </main>;
}
