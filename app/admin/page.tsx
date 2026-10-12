import Link from "next/link";
import { signOutAdmin } from "@/app/login/actions";
import { requireStaffRole } from "@/lib/auth/authorization";

export const metadata = { title: "Owner operations" };

type QueueAgency = {
  id: string;
  name: string;
  country: string | null;
  publication_status: string;
  submitted_at: string | null;
};

function initials(email: string | undefined) {
  return (email?.split("@")[0] ?? "AP")
    .split(/[._-]/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value: string | null) {
  if (!value) return "Awaiting timestamp";

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AdminDashboardPage() {
  const { supabase, user } = await requireStaffRole(["super_admin"]);

  const [
    agenciesResult,
    usersResult,
    moderationResult,
    verificationResult,
    reviewsResult,
    reportsResult,
    disputesResult,
    fraudResult,
    supportResult,
    recentResult,
  ] = await Promise.all([
    supabase
      .from("ap_agencies")
      .select("id", { count: "exact", head: true }),

    supabase
      .from("ap_user_profiles")
      .select("user_id", { count: "exact", head: true }),

    supabase
      .from("ap_agencies")
      .select("id", { count: "exact", head: true })
      .in("publication_status", ["submitted", "approved"]),

    supabase
      .from("ap_verifications")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "needs_information"]),

    supabase
      .from("ap_reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),

    supabase
      .from("ap_reports")
      .select("id", { count: "exact", head: true }),

    supabase
      .from("ap_disputes")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "investigating"]),

    supabase
      .from("ap_fraud_investigations")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "investigating"]),

    supabase
      .from("ap_support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "pending"]),

    supabase
      .from("ap_agencies")
      .select(
        "id,name,country,publication_status,submitted_at"
      )
      .in("publication_status", ["submitted", "approved"])
      .order("submitted_at", { ascending: true })
      .limit(5),
  ]);

  const counts = {
    agencies: agenciesResult.count ?? 0,
    users: usersResult.count ?? 0,
    moderation: moderationResult.count ?? 0,
    verification: verificationResult.count ?? 0,
    reviews: reviewsResult.count ?? 0,
    reports: reportsResult.count ?? 0,
    disputes: disputesResult.count ?? 0,
    fraud: fraudResult.count ?? 0,
    support: supportResult.count ?? 0,
  };

  const urgentTotal =
    counts.moderation +
    counts.verification +
    counts.reviews +
    counts.disputes +
    counts.fraud;

  const recentAgencies = (recentResult.data ?? []) as QueueAgency[];

  return (
    <div className="admin-shell owner-premium">
      <aside className="admin-sidebar">
        <Link
          className="admin-brand"
          href="/owners/dashboard"
        >
          <span className="admin-brand-mark">
            AP<i>✦</i>
          </span>

          <span>
            <b>Avera Privé</b>
            <small>OWNER OPERATIONS</small>
          </span>
        </Link>

        <nav
          className="admin-nav"
          aria-label="Owner portal navigation"
        >
          <p>WORKSPACE</p>

          <Link
            className="active"
            href="/owners/dashboard"
          >
            <span>⌂</span>
            Overview
          </Link>

          <p>TRUST OPERATIONS</p>

          <Link href="/owners/dashboard/moderation">
            <span>◇</span>
            Moderation
            <b>{counts.moderation}</b>
          </Link>

          <Link href="/owners/dashboard/verifications">
            <span>✓</span>
            Verification
            <b>{counts.verification}</b>
          </Link>

          <Link href="/owners/dashboard/directory">
            <span>▤</span>
            Directory &amp; claims
          </Link>

          <Link href="/owners/dashboard/platform-reviews">
            <span>☆</span>
            Platform reviews
          </Link>

          <Link href="/owners/dashboard/reviews">
            <span>☆</span>
            Review queue
            <b>{counts.reviews}</b>
          </Link>

          <Link href="/owners/dashboard/trust">
            <span>!</span>
            Reports &amp; disputes
            <b>{counts.reports + counts.disputes}</b>
          </Link>

          <Link href="/owners/dashboard/fraud">
            <span>⌁</span>
            Fraud review
            <b>{counts.fraud}</b>
          </Link>

          {/* SUPPORT SYSTEM */}
          <p>SUPPORT</p>

          <Link href="/owners/dashboard/support">
            <span>?</span>
            Support tickets
            <b>{counts.support}</b>
          </Link>

          <p>COMMERCIAL</p>

          <Link href="/owners/dashboard/placements">
            <span>◆</span>
            Sponsored placements
          </Link>

          <Link href="/owners/dashboard/analytics">
            <span>↗</span>
            Marketplace analytics
          </Link>

          <Link href="/owners/dashboard/inquiries">
            <span>✉</span>
            Inquiry operations
          </Link>

          <Link href="/owners/dashboard/subscriptions">
            <span>$</span>
            Subscriptions
          </Link>

          <p>EDITORIAL</p>

          <Link href="/owners/dashboard/editorial">
            <span>¶</span>
            The Privé Edit
          </Link>

          <p>GOVERNANCE</p>

          <Link href="/owners/dashboard/audit">
            <span>≡</span>
            Audit log
          </Link>

          <p>QUICK ACCESS</p>

          <Link href="/" target="_blank">
            <span>◎</span>
            View public website
          </Link>
        </nav>

        <div className="admin-sidebar-account">
          <span>{initials(user.email)}</span>

          <div>
            <b>Platform owner</b>
            <small>{user.email}</small>
          </div>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <span className="admin-mobile-brand">AP</span>
            <p className="owner-breadcrumb">Owner portal <span>/</span> Overview</p>
          </div>

          <div className="admin-top-actions">
            <Link className="owner-public-link" href="/" target="_blank" rel="noopener noreferrer">
              View public website <span aria-hidden="true">↗</span>
            </Link>

            <form action={signOutAdmin}>
              <button type="submit">Log out</button>
            </form>
          </div>
        </header>

        <main className="admin-main">
          <section className="admin-welcome">
            <div>
              <p className="admin-kicker">
                OWNER OVERVIEW
              </p>

              <h1>Platform operations</h1>

              <p>
                Manage agencies, ownership claims and trust decisions.
              </p>
            </div>

            <div className="admin-date-card">
              <span>ACCESS LEVEL</span>
              <b>SUPER ADMIN</b>
              <small>Full platform operations</small>
            </div>
          </section>

          <section
            className="admin-stats"
            aria-label="Platform totals"
          >
            <article>
              <span aria-hidden="true">♙</span>
              <p>Total agencies</p>
              <strong>{counts.agencies}</strong>
              <small>All registered profiles</small>
            </article>

            <article>
              <span aria-hidden="true">♙</span>
              <p>Registered accounts</p>
              <strong>{counts.users}</strong>
              <small>Owners, teams, and staff</small>
            </article>

            <article
              className={urgentTotal ? "attention" : ""}
            >
              <span aria-hidden="true">≡</span>
              <p>Actions waiting</p>
              <strong>{urgentTotal}</strong>
              <small>Across operational queues</small>
            </article>

            <article>
              <span aria-hidden="true">◇</span>
              <p>Open trust cases</p>
              <strong>
                {counts.reports + counts.disputes}
              </strong>
              <small>Reports and disputes</small>
            </article>
          </section>

          <div className="admin-content-grid">
            <section className="admin-section admin-queues">
              <div className="admin-section-heading">
                <div>
                  <p>PRIORITY WORK</p>
                  <h2>Operations queue</h2>
                </div>

                <span>{urgentTotal} items need attention</span>
              </div>

              <div className="admin-queue-list">
                <Link href="/owners/dashboard/moderation">
                  <i className="gold">◇</i>

                  <div>
                    <b>Agency moderation</b>
                    <small>
                      Review profile submissions and
                      publication readiness.
                    </small>
                  </div>

                  <strong>{counts.moderation} pending</strong>
                  <span className="owner-review-action">Review <i aria-hidden="true">→</i></span>
                </Link>

                <Link href="/owners/dashboard/verifications">
                  <i className="green">✓</i>

                  <div>
                    <b>Independent verification</b>
                    <small>
                      Assess private business evidence and
                      identity records.
                    </small>
                  </div>

                  <strong>{counts.verification} pending</strong>
                  <span className="owner-review-action">Review <i aria-hidden="true">→</i></span>
                </Link>

                <Link href="/owners/dashboard/reviews">
                  <i className="blue">☆</i>

                  <div>
                    <b>Review moderation</b>
                    <small>
                      Validate relationship evidence before
                      publication.
                    </small>
                  </div>

                  <strong>{counts.reviews} pending</strong>
                  <span className="owner-review-action">Review <i aria-hidden="true">→</i></span>
                </Link>

                <Link href="/owners/dashboard/trust">
                  <i className="red">!</i>

                  <div>
                    <b>Reports and disputes</b>
                    <small>
                      Resolve open safety, accuracy, and trust
                      cases.
                    </small>
                  </div>

                  <strong>
                    {counts.reports + counts.disputes} pending
                  </strong>

                  <span className="owner-review-action">Review <i aria-hidden="true">→</i></span>
                </Link>

                <Link href="/owners/dashboard/fraud">
                  <i className="red">⌁</i>

                  <div>
                    <b>Fraud investigations</b>
                    <small>
                      Review duplicate content and suspicious
                      submission patterns.
                    </small>
                  </div>

                  <strong>{counts.fraud} pending</strong>
                  <span className="owner-review-action">Review <i aria-hidden="true">→</i></span>
                </Link>

                {/* SUPPORT QUEUE */}
                <Link href="/owners/dashboard/support">
                  <i className="blue">?</i>

                  <div>
                    <b>Customer support</b>
                    <small>
                      Review technical issues, account
                      questions, and agency support requests.
                    </small>
                  </div>

                  <strong>{counts.support} pending</strong>
                  <span className="owner-review-action">Review <i aria-hidden="true">→</i></span>
                </Link>
              </div>
            </section>

            <aside className="admin-section admin-principles">
              <p>OPERATING PRINCIPLES</p>

              <h2>Trust principles</h2>

              <ul>
                <li>
                  <span>01</span>

                  <div>
                    <b>Approval is not publication</b>
                    <small>
                      Every visibility decision remains
                      deliberate.
                    </small>
                  </div>
                </li>

                <li>
                  <span>02</span>

                  <div>
                    <b>Verification is independent</b>
                    <small>
                      Payment never determines verified
                      status.
                    </small>
                  </div>
                </li>

                <li>
                  <span>03</span>

                  <div>
                    <b>Every action is attributable</b>
                    <small>
                      Administrative decisions remain
                      auditable.
                    </small>
                  </div>
                </li>
              </ul>
            </aside>
          </div>

          <section className="admin-section owner-quick-access" aria-labelledby="ownerQuickAccessTitle">
            <div className="admin-section-heading">
              <div><p>COMMON TASKS</p><h2 id="ownerQuickAccessTitle">Quick access</h2></div>
            </div>
            <div className="owner-quick-grid">
              <Link href="/owners/dashboard/directory"><span aria-hidden="true">▤</span><div><b>Agency directory</b><small>Manage agencies and public information</small></div><i aria-hidden="true">→</i></Link>
              <Link href="/owners/dashboard/directory"><span aria-hidden="true">◇</span><div><b>Ownership claims</b><small>Review agency ownership requests</small></div><i aria-hidden="true">→</i></Link>
              <Link href="/owners/dashboard/platform-reviews"><span aria-hidden="true">☆</span><div><b>Platform reviews</b><small>Moderate feedback about Avera Privé</small></div><i aria-hidden="true">→</i></Link>
              <Link href="/owners/dashboard/support"><span aria-hidden="true">?</span><div><b>Support tickets</b><small>View and respond to support requests</small></div><i aria-hidden="true">→</i></Link>
            </div>
          </section>

          <section className="admin-section admin-submissions">
            <div className="admin-section-heading">
              <div>
                <p>MODERATION PIPELINE</p>
                <h2>Oldest agency submissions</h2>
              </div>

              <Link href="/owners/dashboard/moderation">
                VIEW FULL QUEUE →
              </Link>
            </div>

            <div
              className="admin-table"
              role="table"
              aria-label="Agency submissions"
            >
              <div
                className="admin-table-row head"
                role="row"
              >
                <span>AGENCY</span>
                <span>LOCATION</span>
                <span>STATUS</span>
                <span>SUBMITTED</span>
                <span>ACTION</span>
              </div>

              {recentAgencies.length ? (
                recentAgencies.map((agency) => (
                  <div
                    className="admin-table-row"
                    role="row"
                    key={agency.id}
                  >
                    <span>
                      <b>{agency.name}</b>
                      <small>
                        {agency.id.slice(0, 8)}
                      </small>
                    </span>

                    <span>
                      {agency.country || "Not provided"}
                    </span>

                    <span>
                      <i
                        className={`admin-status ${agency.publication_status}`}
                      >
                        {agency.publication_status.replace(
                          "_",
                          " "
                        )}
                      </i>
                    </span>

                    <span>
                      {formatDate(agency.submitted_at)}
                    </span>

                    <span>
                      <Link
                        href={`/owners/dashboard/moderation/${agency.id}`}
                      >
                        REVIEW →
                      </Link>
                    </span>
                  </div>
                ))
              ) : (
                <div className="admin-empty">
                  <b>All caught up.</b>
                  <span>
                    No agency profiles are currently awaiting
                    moderation.
                  </span>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}