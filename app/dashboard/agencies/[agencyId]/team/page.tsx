import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAgencyRole } from "@/lib/auth/authorization";
import { AgencyWorkspaceShell } from "../../../_components/portal-shells";

import {
  cancelInvitation,
  inviteMember,
  manageMember,
} from "./actions";

type Member = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  joined_at: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
};

type PageProps = {
  params: Promise<{
    agencyId: string;
  }>;

  searchParams: Promise<{
    invited?: string;
    updated?: string;
    cancelled?: string;
    error?: string;
  }>;
};

const roleDescriptions: Record<string, string> = {
  owner: "Complete workspace and team-access control.",
  admin: "Manage profiles, leads, reviews, and submissions.",
  editor: "Edit agency profile and public-facing content.",
  analyst: "View analytics, performance, and lead insights.",
  billing: "Manage plans, trials, and billing operations.",
};

const manageableRoles = [
  "admin",
  "editor",
  "analyst",
  "billing",
];

export default async function TeamManagementPage({
  params,
  searchParams,
}: PageProps) {
  const { agencyId } = await params;
  const query = await searchParams;

  const { supabase, user, role } = await requireAgencyRole(
    agencyId,
    ["owner", "admin"]
  );

  const [
    { data: agency },
    { data: memberData, error: memberError },
    { data: invitationData, error: invitationError },
  ] = await Promise.all([
    supabase
      .from("ap_agencies")
      .select("name")
      .eq("id", agencyId)
      .maybeSingle(),

    supabase.rpc("ap_agency_team", {
      target_agency: agencyId,
    }),

    supabase
      .from("ap_agency_invitations")
      .select(
        "id,email,role,status,expires_at,created_at"
      )
      .eq("agency_id", agencyId)
      .eq("status", "pending")
      .order("created_at", {
        ascending: false,
      }),
  ]);

  if (!agency) {
    notFound();
  }

  const members = (memberData ?? []) as Member[];
  const invitations =
    (invitationData ?? []) as Invitation[];

  const isOwner = role === "owner";

  const activeMembers = members.filter(
    (member) => member.status === "active"
  ).length;

  const pageError =
    query.error ||
    memberError?.message ||
    invitationError?.message;

  let successMessage = "";

  if (query.invited) {
    successMessage =
      "The team invitation was created securely.";
  }

  if (query.updated) {
    successMessage =
      "The member’s role and access status were updated.";
  }

  if (query.cancelled) {
    successMessage =
      "The pending team invitation was cancelled.";
  }

  return (
    <AgencyWorkspaceShell email={user.email}>
      <main className="team-main">
        <Link
          className="team-back-link"
          href={`/agency/dashboard/agencies/${agencyId}`}
        >
          ← AGENCY PROFILE
        </Link>

        <header className="team-hero">
          <div>
            <p className="eyebrow">TEAM &amp; ACCESS</p>

            <h1>{agency.name}</h1>

            <span>
              Invite employees and delegate work using
              the minimum access each person needs.
            </span>
          </div>

          <div className="team-summary">
            <strong>{activeMembers}</strong>
            <span>ACTIVE MEMBERS</span>

            <small>
              {invitations.length} pending invitation
              {invitations.length === 1 ? "" : "s"}
            </small>
          </div>
        </header>

        {successMessage && (
          <p className="operation-notice">
            {successMessage}
          </p>
        )}

        {pageError && (
          <p className="operation-error" role="alert">
            {pageError}
          </p>
        )}

        <section className="team-security-notice">
          <div>
            <p>ACCESS PRINCIPLE</p>

            <h2>
              Every person receives an individual account.
            </h2>

            <span>
              Never share the agency owner’s password.
              Invitations are bound to one email address,
              expire after seven days, and every access
              change is recorded in the security audit
              trail.
            </span>
          </div>

          <b>OWNER ACCESS IS PROTECTED</b>
        </section>

        <div className="team-layout">
          <section className="team-members">
            <header>
              <div>
                <p>MEMBERS</p>
                <h2>Workspace access</h2>
              </div>

              <span>
                {members.length} TOTAL
              </span>
            </header>

            <div className="team-member-list">
              {members.map((member) => {
                const accountName =
                  member.display_name ||
                  member.email.split("@")[0] ||
                  "Team member";

                const initials = accountName
                  .slice(0, 2)
                  .toUpperCase();

                const canEditMember =
                  isOwner &&
                  member.role !== "owner";

                return (
                  <article
                    className="team-member-card"
                    key={member.id}
                  >
                    <div className="team-member-identity">
                      <i>{initials}</i>

                      <div>
                        <b>{accountName}</b>
                        <span>{member.email}</span>
                      </div>
                    </div>

                    <div className="team-member-role">
                      <b>
                        {member.role.toUpperCase()}
                      </b>

                      <span>
                        {roleDescriptions[member.role] ||
                          "Agency workspace access"}
                      </span>
                    </div>

                    <em
                      className={`team-member-status ${member.status}`}
                    >
                      {member.status}
                    </em>

                    {canEditMember ? (
                      <form
                        action={manageMember.bind(
                          null,
                          agencyId,
                          member.id
                        )}
                      >
                        <label>
                          <span>ROLE</span>

                          <select
                            name="role"
                            defaultValue={member.role}
                          >
                            {manageableRoles.map(
                              (availableRole) => (
                                <option
                                  value={availableRole}
                                  key={availableRole}
                                >
                                  {availableRole}
                                </option>
                              )
                            )}
                          </select>
                        </label>

                        <label>
                          <span>STATUS</span>

                          <select
                            name="status"
                            defaultValue={member.status}
                          >
                            <option value="active">
                              Active
                            </option>

                            <option value="suspended">
                              Suspended
                            </option>

                            <option value="revoked">
                              Revoked
                            </option>
                          </select>
                        </label>

                        <button type="submit">
                          SAVE ACCESS
                        </button>
                      </form>
                    ) : (
                      <small className="team-protected">
                        {member.role === "owner"
                          ? "Protected owner"
                          : "Managed by an owner"}
                      </small>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="team-sidebar">
            {isOwner && (
              <section className="team-invite-card">
                <p>INVITE A TEAM MEMBER</p>

                <h2>Grant controlled access</h2>

                <form
                  action={inviteMember.bind(
                    null,
                    agencyId
                  )}
                >
                  <label>
                    <span>WORK EMAIL</span>

                    <input
                      name="email"
                      type="email"
                      placeholder="employee@agency.com"
                      autoComplete="email"
                      required
                    />
                  </label>

                  <label>
                    <span>ROLE</span>

                    <select
                      name="role"
                      defaultValue="editor"
                    >
                      <option value="admin">
                        Admin
                      </option>

                      <option value="editor">
                        Editor
                      </option>

                      <option value="analyst">
                        Analyst
                      </option>

                      <option value="billing">
                        Billing
                      </option>
                    </select>
                  </label>

                  <button type="submit">
                    CREATE INVITATION →
                  </button>
                </form>

                <small>
                  The employee must register or sign in
                  using this exact email address.
                </small>
              </section>
            )}

            <section className="team-role-guide">
              <p>ROLE GUIDE</p>

              <h2>What each role can do</h2>

              {Object.entries(roleDescriptions).map(
                ([roleName, description]) => (
                  <div key={roleName}>
                    <b>{roleName}</b>
                    <span>{description}</span>
                  </div>
                )
              )}
            </section>
          </aside>
        </div>

        {invitations.length > 0 && (
          <section className="team-pending">
            <header>
              <div>
                <p>PENDING INVITATIONS</p>
                <h2>Awaiting acceptance</h2>
              </div>

              <span>
                {invitations.length} PENDING
              </span>
            </header>

            <div>
              {invitations.map((invitation) => (
                <article key={invitation.id}>
                  <div>
                    <b>{invitation.email}</b>

                    <span>
                      {invitation.role.toUpperCase()}
                      {" · "}
                      EXPIRES{" "}
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

                  {isOwner && (
                    <form
                      action={cancelInvitation.bind(
                        null,
                        agencyId,
                        invitation.id
                      )}
                    >
                      <button type="submit">
                        CANCEL INVITATION
                      </button>
                    </form>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </AgencyWorkspaceShell>
  );
}