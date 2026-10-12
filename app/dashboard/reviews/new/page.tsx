import Link from "next/link";
import { requireUser } from "@/lib/auth/authorization";
import { submitReview } from "../actions";
import { AgencyWorkspaceShell } from "../../_components/portal-shells";

export default async function NewReview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase, user } = await requireUser();
  const query = await searchParams;
  const { data: agencies } = await supabase.from("ap_agencies").select("id,name,country").eq("published", true).order("name");
  return <AgencyWorkspaceShell email={user.email}><main className="workflow-main">
    <div className="workflow-breadcrumb"><Link href="/agency/dashboard">WORKSPACE</Link><span>／</span><b>SUBMIT A REVIEW</b></div>
    <header className="workflow-header"><div><p>INDEPENDENT CUSTOMER FEEDBACK</p><h1>Share a verified experience.</h1><span>Every review is screened for relationship evidence, authenticity, and policy compliance before publication.</span></div><div className="workflow-progress review"><span>PRIVATE BY DEFAULT</span><div><i /></div><small>Evidence is never public</small></div></header>
    {query.submitted ? <section className="workflow-success"><span>✓</span><p>REVIEW RECEIVED</p><h2>Thank you for contributing.</h2><div>Your submission is now private while its relationship evidence and content are reviewed by the trust team.</div><Link className="button" href="/agency/dashboard">RETURN TO WORKSPACE</Link></section> : <div className="workflow-layout">
      <form className="workflow-form" action={submitReview}>
        <div className="workflow-form-head"><span>01</span><div><h2>Your experience</h2><p>Be specific, factual, and fair in describing the agency relationship.</p></div></div>
        {query.error && <p className="workflow-alert" role="alert">{query.error}</p>}
        <label><span>AGENCY <b>REQUIRED</b></span><select name="agency_id" defaultValue={query.agencyId ?? ""} required><option value="" disabled>Select an agency</option>{agencies?.map((agency) => <option value={agency.id} key={agency.id}>{agency.name}{agency.country ? ` — ${agency.country}` : ""}</option>)}</select><small>Only published agencies can receive public reviews.</small></label>
        <label><span>OVERALL RATING</span><select name="rating" defaultValue="5" required><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Fair</option><option value="2">2 — Poor</option><option value="1">1 — Very poor</option></select></label>
        <label><span>YOUR REVIEW <b>50 CHARACTER MINIMUM</b></span><textarea name="body" minLength={50} maxLength={5000} rows={7} placeholder="Describe the work, communication, results, and any important context." required /></label>
        <div className="workflow-form-head evidence"><span>02</span><div><h2>Private relationship evidence</h2><p>This section is visible only to authorized reviewers.</p></div></div>
        <label><span>YOUR RELATIONSHIP TO THE AGENCY</span><input name="relationship" placeholder="Example: creator client, brand partner, former contractor" required /></label>
        <label><span>PRIVATE EVIDENCE NOTES</span><textarea name="evidence_notes" minLength={20} rows={5} placeholder="Explain what evidence supports this relationship and how it may be checked." required /></label>
        <div className="workflow-actions"><Link href="/agency/dashboard">CANCEL</Link><button>SUBMIT FOR MODERATION <span>→</span></button></div>
      </form>
      <aside className="workflow-aside"><p>REVIEW STANDARDS</p><ol><li><span>01</span><div><b>First-hand experience</b><small>Reviews must reflect a genuine professional relationship.</small></div></li><li><span>02</span><div><b>Evidence-based moderation</b><small>Private documentation may be requested before publication.</small></div></li><li><span>03</span><div><b>No paid influence</b><small>Payment and premium plans never affect review decisions.</small></div></li></ol><div><b>Important</b><p>Agency employees cannot review their own agency. False or misleading submissions may be rejected.</p></div></aside>
    </div>}
  </main></AgencyWorkspaceShell>;
}
