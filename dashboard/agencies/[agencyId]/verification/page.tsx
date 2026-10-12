import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgencyRole } from "@/lib/auth/authorization";
import { submitVerificationRequest } from "./actions";

export default async function VerificationCenter({ params, searchParams }: {
  params: Promise<{ agencyId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { agencyId } = await params;
  const query = await searchParams;
  const { supabase, role } = await requireAgencyRole(agencyId, ["owner", "admin", "editor", "analyst", "billing"]);
  const [{ data: agency }, { data: requests }] = await Promise.all([
    supabase.from("ap_agencies").select("id,name,publication_status,published").eq("id", agencyId).maybeSingle(),
    supabase.from("ap_verifications").select("id,status,decision_reason,submitted_at,reviewed_at").eq("agency_id", agencyId).order("created_at", { ascending: false }),
  ]);
  if (!agency) notFound();
  const active = requests?.find((item) => ["pending", "needs_information", "approved"].includes(item.status));
  const canSubmit = ["owner", "admin"].includes(role) && !active;

  return <main>
    <p className="eyebrow">Independent trust review</p>
    <h1>Verification center</h1>
    <p className="lede">Verification confirms independently reviewed business evidence. It is not purchased and does not affect objective ranking.</p>

    <section className="panel verification-status">
      <h2>{agency.name}</h2>
      <p><strong>Profile:</strong> {agency.publication_status}</p>
      <p><strong>Verification:</strong> {active?.status?.replace("_", " ") ?? "not requested"}</p>
      {active?.decision_reason && <p><strong>Reviewer note:</strong> {active.decision_reason}</p>}
      {query.submitted && <p role="status">Verification request submitted securely.</p>}
      {query.error && <p className="error" role="alert">{query.error}</p>}
    </section>

    {canSubmit && <form className="panel verification-form" action={submitVerificationRequest.bind(null, agencyId)}>
      <h2>Submit business evidence</h2>
      <p>These details are private and visible only to authorized verification reviewers.</p>
      <label>Legal company name<input name="company_legal_name" required /></label>
      <label>Registration number<input name="registration_number" /></label>
      <label>Registration country<input name="registration_country" required /></label>
      <label>Official website<input name="official_website" type="url" /></label>
      <label>Authorized representative<input name="representative_name" required /></label>
      <label>Representative title<input name="representative_title" /></label>
      <label>Business email<input name="business_email" type="email" required /></label>
      <label>Evidence notes<textarea name="evidence_notes" rows={6} placeholder="Explain the documents and public records the reviewer should check." /></label>
      <button>Submit verification request</button>
    </form>}

    {active?.status === "pending" && <section className="panel"><p><strong>Your request is awaiting independent review.</strong></p><p>The profile remains unverified until a reviewer completes every required check.</p></section>}
    {active?.status === "needs_information" && <section className="panel"><p><strong>More information is required.</strong></p><p>A follow-up evidence form will be added in the next workflow iteration.</p></section>}
    {active?.status === "approved" && <section className="panel"><p><strong>Verification approved.</strong></p><p>This result remains separate from subscription, placement, ranking, and profile publication.</p></section>}
    <p><Link href={`/agency/dashboard/agencies/${agencyId}`}>Return to agency profile</Link></p>
  </main>;
}
