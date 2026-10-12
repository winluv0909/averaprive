import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgencyRole } from "@/lib/auth/authorization";
import { AgencyWorkspaceShell } from "../../_components/portal-shells";
import { saveAgencyProfile, submitAgencyProfile } from "../actions";

const statusContent: Record<string, { label: string; title: string; copy: string }> = {
  draft: { label: "PRIVATE DRAFT", title: "Complete your agency profile", copy: "Your profile is private and can be edited until you submit it for moderation." },
  changes_requested: { label: "CHANGES REQUESTED", title: "Update and resubmit your profile", copy: "Review the moderator note, make the requested updates, and submit the profile again." },
  submitted: { label: "IN MODERATION", title: "Your profile is being reviewed", copy: "Editing is temporarily locked while the moderation team reviews your submission." },
  approved: { label: "APPROVED · PRIVATE", title: "Your profile has been approved", copy: "Approval is complete. Publication remains a separate platform-owner decision." },
  published: { label: "LIVE IN DIRECTORY", title: "Your public profile is live", copy: "Keep your trust information current and monitor reviews from this workspace." },
  rejected: { label: "NOT APPROVED", title: "Your submission needs attention", copy: "Review the moderator decision before preparing a new submission." },
};

export default async function AgencyEditor({ params, searchParams }: { params: Promise<{ agencyId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { agencyId } = await params;
  const query = await searchParams;
  const { supabase, user, role } = await requireAgencyRole(agencyId, ["owner", "admin", "editor", "analyst", "billing"]);
  const { data: agency } = await supabase.from("ap_agencies").select("*").eq("id", agencyId).maybeSingle();
  if (!agency) notFound();
  const editable = ["draft", "changes_requested"].includes(agency.publication_status) && ["owner", "admin", "editor"].includes(role);
  const canSubmit = editable && ["owner", "admin"].includes(role);
  const canManageTrust = ["owner", "admin"].includes(role);
  const join = (values: string[] | null) => values?.join(", ") ?? "";
  const completed = [agency.name, agency.positioning_statement, agency.country, agency.city, agency.website_url, agency.about, agency.services?.length, agency.creator_niches?.length, agency.regions_served?.length].filter(Boolean).length;
  const completion = Math.round((completed / 9) * 100);
  const status = statusContent[agency.publication_status] ?? { label: agency.publication_status.replaceAll("_", " ").toUpperCase(), title: "Manage your agency profile", copy: "Review your profile details and current platform status." };

  return <AgencyWorkspaceShell email={user.email}>
    <main className="profile-manage-main">
      <nav className="workflow-breadcrumb" aria-label="Breadcrumb"><Link href="/agency/dashboard">WORKSPACE</Link><span>/</span><b>AGENCY PROFILE</b></nav>
      <header className="profile-manage-header"><div><p>{status.label}</p><h1>{agency.name}</h1><span>{status.copy}</span></div><div className="profile-completion"><span>PROFILE COMPLETION</span><strong>{completion}%</strong><div><i style={{ width: `${completion}%` }} /></div><small>{completed} of 9 profile sections completed</small></div></header>
      {(query.saved || query.submitted || query.error) && <div className={`profile-flash ${query.error ? "error" : ""}`} role={query.error ? "alert" : "status"}>{query.error ?? (query.submitted ? "Your profile was submitted for moderation." : "Your private draft was saved.")}</div>}
      <section className="profile-status-card"><div><span className={`profile-status-dot ${agency.publication_status}`} /><div><small>CURRENT WORKFLOW STATUS</small><h2>{status.title}</h2><p>{status.copy}</p></div></div><dl><div><dt>YOUR ROLE</dt><dd>{role.toUpperCase()}</dd></div><div><dt>VISIBILITY</dt><dd>{agency.published ? "PUBLIC" : "PRIVATE"}</dd></div><div><dt>PROFILE ID</dt><dd>{agencyId.slice(0, 8).toUpperCase()}</dd></div></dl></section>
      {agency.moderation_note && <aside className="profile-moderator-note"><span>!</span><div><b>MODERATOR NOTE</b><p>{agency.moderation_note}</p></div></aside>}
      <div className="profile-manage-layout">
        <section className="profile-manage-panel"><div className="profile-manage-panel-head"><div><p>PROFILE INFORMATION</p><h2>{editable ? "Edit agency details" : "Agency details"}</h2></div><span>{editable ? "EDITABLE" : "READ ONLY"}</span></div>
          {editable ? <form className="profile-edit-form" action={saveAgencyProfile.bind(null, agencyId)}><div className="profile-field-grid">
            <label className="wide"><span>AGENCY NAME <b>REQUIRED</b></span><input name="name" defaultValue={agency.name} required /></label>
            <label className="wide"><span>POSITIONING STATEMENT</span><input name="positioning_statement" defaultValue={agency.positioning_statement ?? ""} placeholder="Describe who you serve and what makes your agency distinct" /></label>
            <label><span>COUNTRY <b>REQUIRED</b></span><input name="country" defaultValue={agency.country ?? ""} required /></label><label><span>CITY</span><input name="city" defaultValue={agency.city ?? ""} /></label>
            <label className="wide"><span>WEBSITE URL</span><input name="website_url" type="url" defaultValue={agency.website_url ?? ""} placeholder="https://" /></label>
            <label className="wide"><span>ABOUT <b>MINIMUM 80 CHARACTERS</b></span><textarea name="about" defaultValue={agency.about ?? ""} minLength={80} required rows={7} /></label>
            <label className="wide"><span>SERVICES <b>COMMA-SEPARATED</b></span><input name="services" defaultValue={join(agency.services)} required /></label>
            <label className="wide"><span>CREATOR NICHES <b>COMMA-SEPARATED</b></span><input name="creator_niches" defaultValue={join(agency.creator_niches)} /></label>
            <label className="wide"><span>REGIONS SERVED <b>COMMA-SEPARATED</b></span><input name="regions_served" defaultValue={join(agency.regions_served)} /></label>
          </div><div className="profile-save-row"><small>Changes remain private until moderation and publication are complete.</small><button className="button">SAVE PRIVATE DRAFT <span>→</span></button></div></form> : <dl className="profile-detail-list">
            <div><dt>POSITIONING</dt><dd>{agency.positioning_statement || "Not provided"}</dd></div><div><dt>LOCATION</dt><dd>{[agency.city, agency.country].filter(Boolean).join(", ") || "Not provided"}</dd></div>
            <div><dt>WEBSITE</dt><dd>{agency.website_url ? <a href={agency.website_url} target="_blank" rel="noreferrer">{agency.website_url} ↗</a> : "Not provided"}</dd></div><div><dt>ABOUT</dt><dd>{agency.about || "Not provided"}</dd></div>
            <div><dt>SERVICES</dt><dd>{join(agency.services) || "Not provided"}</dd></div><div><dt>CREATOR NICHES</dt><dd>{join(agency.creator_niches) || "Not provided"}</dd></div><div><dt>REGIONS SERVED</dt><dd>{join(agency.regions_served) || "Not provided"}</dd></div>
          </dl>}
        </section>
        <aside className="profile-manage-side">
          {canSubmit && <section className="profile-submit-card"><p>NEXT STEP</p><h2>Ready for review?</h2><span>Submit only when every public-facing detail is accurate and complete.</span><form action={submitAgencyProfile.bind(null, agencyId)}><button>SUBMIT FOR MODERATION <b>→</b></button></form></section>}
          <section className="profile-submit-card"><p>PLAN &amp; BILLING</p><h2>Visibility and tools</h2><span>Manage your Free profile, no-card Privé trial, paid tools, and plan requests.</span><Link className="button" href={`/agency/dashboard/agencies/${agencyId}/billing`}>OPEN PLAN CENTER →</Link></section>
          <section className="profile-submit-card"><p>LEADS &amp; PERFORMANCE</p><h2>Marketplace activity</h2><span>Review protected inquiries and understand how discovery becomes contact.</span><Link className="button" href={`/agency/dashboard/agencies/${agencyId}/leads`}>OPEN LEAD INBOX →</Link><Link className="button" href={`/agency/dashboard/agencies/${agencyId}/analytics`}>VIEW ANALYTICS →</Link></section>
          {["owner", "admin"].includes(role) && (
  <section className="profile-submit-card">
    <p>TEAM &amp; ACCESS</p>

    <h2>Manage your workspace</h2>

    <span>
      Invite employees, assign focused roles, and
      review active access without sharing the agency
      owner’s password.
    </span>

    <Link
      className="button"
      href={`/agency/dashboard/agencies/${agencyId}/team`}
    >
      MANAGE TEAM →
    </Link>
  </section>
)}
          <section className="profile-tools-card"><p>TRUST &amp; REPUTATION</p><h2>Agency tools</h2>{canManageTrust && <Link href={`/agency/dashboard/agencies/${agencyId}/verification`}><span>✓</span><div><b>Verification center</b><small>Submit and monitor private evidence</small></div><i>→</i></Link>}<Link href={`/agency/dashboard/agencies/${agencyId}/reviews`}><span>☆</span><div><b>Reviews &amp; trust</b><small>View reviews and agency responses</small></div><i>→</i></Link>{agency.published && <Link href="/agencies.html" target="_blank"><span>↗</span><div><b>View public profile</b><small>Open the public directory</small></div><i>↗</i></Link>}</section>
          <section className="profile-help-card"><span>?</span><div><b>NEED HELP?</b><p>Contact platform support if your profile status or moderation instructions are unclear.</p></div></section>
        </aside>
      </div>
    </main>
  </AgencyWorkspaceShell>;
}
