import Link from "next/link";
import { requireUser } from "@/lib/auth/authorization";
import { AgencyWorkspaceShell } from "./_components/portal-shells";
import { acceptInvitation } from "./invitation-actions";

type Membership = { agency_id: string; role: string; status: string; ap_agencies: { name: string; publication_status: string } | { name: string; publication_status: string }[] | null };
type Invitation = {
  id: string;
  agency_id: string;
  role: string;
  expires_at: string;
  ap_agencies:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    invite_error?: string;
  }>;
}) {
  const query = await searchParams;
  const { supabase, user } = await requireUser();
  const [
  { data: membershipData },
  { data: invitationData },
] = await Promise.all([
  supabase
    .from("ap_agency_memberships")
    .select(
      "agency_id,role,status,ap_agencies(name,publication_status)"
    )
    .eq("user_id", user.id)
    .eq("status", "active"),

  supabase
    .from("ap_agency_invitations")
    .select(
      "id,agency_id,role,expires_at,ap_agencies(name)"
    )
    .eq(
      "email",
      (user.email || "").toLowerCase()
    )
    .eq("status", "pending")
    .gt(
      "expires_at",
      new Date().toISOString()
    ),
]);

const memberships =
  (membershipData ?? []) as Membership[];

const invitations =
  (invitationData ?? []) as Invitation[];
  return <AgencyWorkspaceShell email={user.email}>
    <main className="agency-main">
      <section className="agency-hero"><div><p className="eyebrow">AGENCY WORKSPACE</p><h1>Your agency command center.</h1><p>Manage profiles, submit evidence, monitor trust status, and keep your agency information current.</p></div><Link className="button agency-primary-action" href="/agency/dashboard/agencies/new">CREATE AGENCY PROFILE</Link></section>
      {query.invite_error && (
  <p className="operation-error" role="alert">
    {query.invite_error}
  </p>
)}

{invitations.length > 0 && (
  <section className="workspace-invitations">
    <div className="workspace-invitations-heading">
      <p>TEAM INVITATIONS</p>

      <h2>
        You have been invited to an agency workspace.
      </h2>

      <span>
        Accept only invitations from an agency that
        you recognize.
      </span>
    </div>

    <div className="workspace-invitation-list">
      {invitations.map((invitation) => {
        const agency = Array.isArray(
          invitation.ap_agencies
        )
          ? invitation.ap_agencies[0]
          : invitation.ap_agencies;

        return (
          <article key={invitation.id}>
            <div>
              <b>
                {agency?.name ||
                  "Agency workspace"}
              </b>

              <span>
                {invitation.role.toUpperCase()}
                {" ACCESS · EXPIRES "}

                {new Intl.DateTimeFormat(
                  "en-PH",
                  {
                    dateStyle: "medium",
                    timeZone: "Asia/Manila",
                  }
                ).format(
                  new Date(
                    invitation.expires_at
                  )
                )}
              </span>
            </div>

            <form
              action={acceptInvitation.bind(
                null,
                invitation.id
              )}
            >
              <button type="submit">
                ACCEPT INVITATION →
              </button>
            </form>
          </article>
        );
      })}
    </div>
  </section>
)}
      <div className="agency-overview-grid">
        <section className="agency-panel"><div className="agency-panel-head"><div><p>YOUR ORGANIZATIONS</p><h2>Agency access</h2></div><span>{memberships.length} PROFILE{memberships.length === 1 ? "" : "S"}</span></div>
          <div className="agency-list">{memberships.length ? memberships.map((item) => { const agency = Array.isArray(item.ap_agencies) ? item.ap_agencies[0] : item.ap_agencies; return <Link href={`/agency/dashboard/agencies/${item.agency_id}`} key={item.agency_id}><div><b>{agency?.name ?? "Agency profile"}</b><small>{item.role.toUpperCase()} · {(agency?.publication_status ?? "draft").replace("_", " ").toUpperCase()}</small></div><span>MANAGE →</span></Link>; }) : <div className="agency-empty"><h3>No agency profile yet.</h3><p>Create a private draft to begin building your directory profile. Nothing becomes public until it passes moderation and is separately published.</p><Link className="button" href="/agency/dashboard/agencies/new">START PRIVATE DRAFT</Link></div>}</div>
        </section>
        <aside className="agency-panel agency-quick"><p>QUICK ACTIONS</p><h2>What would you like to do?</h2><Link href="/agency/dashboard/agencies/new">Create a new profile <span>→</span></Link><Link href="/agency/dashboard/reviews/new">Submit an independent review <span>→</span></Link><Link href="/agencies.html" target="_blank">Browse the public directory <span>↗</span></Link></aside>
      </div>
      <section className="agency-guide"><article><span>01</span><h3>Complete your profile</h3><p>Add accurate company details, services, regions, and positioning information.</p></article><article><span>02</span><h3>Submit for moderation</h3><p>Your profile is reviewed for quality and policy compliance before approval.</p></article><article><span>03</span><h3>Build independent trust</h3><p>Verification and reviews use separate evidence-based processes.</p></article></section>
    </main>
  </AgencyWorkspaceShell>;
}
