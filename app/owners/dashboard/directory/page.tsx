import { OwnerOperationsShell } from "@/app/dashboard/_components/portal-shells";
import "./directory.css";
import Link from "next/link";
import { requireStaffRole } from "@/lib/auth/authorization";
import { addAgency, reviewClaim } from "./actions";
import { claimProfileColumns, claimProfileSnapshot } from "@/lib/agencies/claim-profile";
import AgencyInformationSummary from "@/app/agency/claim/AgencyInformationSummary";
import CorrectProfileForm from "./CorrectProfileForm";
export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const { supabase, user } = await requireStaffRole(["super_admin"]);
  const [
    { data: agencies, error: agencyError },
    { data: claims, error: claimError },
  ] = await Promise.all([
    supabase.from("ap_public_agencies").select(claimProfileColumns),
    supabase
      .from("ap_agency_claims")
      .select("id,agency_id,claimant_user_id,evidence,created_at,representative_name,representative_role,business_contact,profile_confirmed,requested_corrections,profile_snapshot")
      .eq("status", "pending"),
  ]);
  return (
    <OwnerOperationsShell active="directory" email={user.email}><main className="owner-section-page owner-section-directory directory-operations">
      <Link href="/owners/dashboard">← Owner dashboard</Link>
      <h1>Agency directory and ownership claims</h1>
      {query.error && <p role="alert">{query.error}</p>}
      {query.added && (
        <p role="status">Agency published as an unclaimed listing.</p>
      )}
      {query.reviewed && <p role="status">Claim decision saved.</p>}
      {query.corrected && <p role="status">Profile corrections saved. Review the updated information before approving a claim.</p>}
      <h2>Add a legitimate agency</h2>
      <p>
        Check the official website and company identity before publishing. A
        listing does not imply independent verification.
      </p>
      <form action={addAgency} className="access-form">
        <label>
          Name
          <input name="name" required minLength={2} maxLength={160} />
        </label>
        <label>
          Official website
          <input name="website" type="url" pattern="https://.*" required />
        </label>
        <label>
          Country
          <input name="country" required />
        </label>
        <label>
          Agency information
          <textarea name="about" required minLength={40} />
        </label>
        <label>
          <input type="checkbox" required /> I reviewed the official sources and
          confirmed this is a legitimate agency.
        </label>
        <button type="submit">Publish unclaimed agency</button>
      </form>
      <h2>Published agencies</h2>
      {agencyError && <p role="alert">Could not load directory.</p>}
      <ul>
        {agencies
          ?.filter((a) => !a.demo_profile)
          .map((a) => (
            <li key={a.id}>
              <Link href={`/agency-profile.html?id=${a.slug}`}>{a.name}</Link>
              <CorrectProfileForm agency={a} />
            </li>
          ))}
      </ul>
      <h2>Pending ownership claims</h2>
      {claimError && (
        <p role="alert">
          Could not load claims. Apply the directory migration first.
        </p>
      )}
      {!claimError && !claims?.length && <p>No pending claims.</p>}
      {claims?.map((claim) => (
        <article key={claim.id}>
          <h3>
            {agencies?.find((a) => a.id === claim.agency_id)?.name ??
              claim.agency_id}
          </h3>
          <p>Claimant account: {claim.claimant_user_id}</p>
          <p>Representative: {claim.representative_name ?? "Missing — resubmission required"} · {claim.representative_role ?? "Role missing"}</p>
          <p>Business contact supplied: {claim.business_contact ?? "Missing"}. Independently confirm this address; it is not automatically verified.</p>
          <p>Corrections requested: {claim.requested_corrections || "None supplied"}</p>
          <details><summary>Profile reviewed by the claimant</summary><AgencyInformationSummary profile={claim.profile_snapshot ?? {}} /></details>
          <p>Open the current profile and check official sources. Resolve corrections before approving. If important details cannot be confirmed, keep the claim pending or decline it with an explanation.</p>
          <Link href={`/owners/dashboard/moderation/${claim.agency_id}`}>Review agency profile</Link>
          {agencies?.find((a) => a.id === claim.agency_id) && <CorrectProfileForm agency={agencies.find((a) => a.id === claim.agency_id)!} />}
          <p style={{ whiteSpace: "pre-wrap" }}>{claim.evidence}</p>
          <form>
            <input type="hidden" name="profile_snapshot" value={JSON.stringify(claimProfileSnapshot(agencies?.find((a) => a.id === claim.agency_id) ?? {}))} />
            <fieldset><legend>Required checks for approval</legend>
              <label><input name="identity" type="checkbox" /> I confirmed the agency&apos;s business identity.</label>
              <label><input name="authority" type="checkbox" /> I verified this person&apos;s authority to represent the agency.</label>
              <label><input name="contact" type="checkbox" /> I independently confirmed contact through an official agency channel.</label>
              <label><input name="information" type="checkbox" /> I reviewed current profile details and resolved missing information and corrections.</label>
            </fieldset>
            <label>
              Review explanation
              <textarea name="note" required minLength={10} />
            </label>
            <button formAction={reviewClaim.bind(null, claim.id, "approved")}>
              Approve ownership
            </button>
            <button formAction={reviewClaim.bind(null, claim.id, "rejected")}>
              Decline claim
            </button>
          </form>
        </article>
      ))}
    </main></OwnerOperationsShell>
  );
}
