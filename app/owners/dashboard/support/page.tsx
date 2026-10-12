import Link from "next/link";
import { requireStaffRole } from "@/lib/auth/authorization";
import { OwnerOperationsShell } from "@/app/dashboard/_components/portal-shells";

export const metadata = {
  title: "Support | Avera Privé",
};

type SupportTicket = {
  id: string;
  ticket_number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function SupportPage() {
  const { supabase, user } = await requireStaffRole([
    "super_admin",
    "support",
  ]);

  const { data, error } = await supabase
    .from("ap_support_tickets")
    .select(
      "id,ticket_number,subject,category,priority,status,created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      `Unable to load support tickets: ${error.message}`
    );
  }

  const tickets = (data ?? []) as SupportTicket[];

  const openCount = tickets.filter(
    (ticket) => ticket.status === "open"
  ).length;

  const pendingCount = tickets.filter(
    (ticket) => ticket.status === "pending"
  ).length;

  const resolvedCount = tickets.filter(
    (ticket) => ticket.status === "resolved"
  ).length;

  const closedCount = tickets.filter(
    (ticket) => ticket.status === "closed"
  ).length;

  const activeCount = openCount + pendingCount;

  return (
    <OwnerOperationsShell
      active="support"
      email={user.email}
    >
      <main className="owner-section-page owner-section-support admin-main support-page">
        <section className="admin-welcome support-welcome">
          <div>
            <p className="admin-kicker">
              SUPPORT OPERATIONS
            </p>

            <h1>Support tickets.</h1>

            <p>
              Review account questions, agency assistance
              requests, technical issues, and platform
              support conversations from one queue.
            </p>

            <div className="support-live-meta">
              <span className="support-live-indicator">
                <i />
                LIVE SUPPORT QUEUE
              </span>

              <span>
                {tickets.length} TOTAL{" "}
                {tickets.length === 1
                  ? "TICKET"
                  : "TICKETS"}
              </span>
            </div>
          </div>

          <div
            className={`admin-date-card support-active-card ${
              activeCount > 0
                ? "support-active-card--attention"
                : ""
            }`}
          >
            <div className="support-active-card-head">
              <span>ACTIVE QUEUE</span>

              <i>
                {activeCount > 0 ? "LIVE" : "CLEAR"}
              </i>
            </div>

            <b>{activeCount}</b>

            <small>
              {activeCount === 1
                ? "Ticket requiring attention"
                : "Tickets requiring attention"}
            </small>

            <div className="support-active-breakdown">
              <span>
                <strong>{openCount}</strong>
                OPEN
              </span>

              <span>
                <strong>{pendingCount}</strong>
                PENDING
              </span>
            </div>
          </div>
        </section>

        <section
          className="admin-stats support-stats"
          aria-label="Support ticket totals"
        >
          <article>
            <span>01</span>
            <p>All tickets</p>
            <strong>{tickets.length}</strong>
            <small>Total support requests</small>
          </article>

          <article
            className={
              openCount > 0
                ? "support-stat-open"
                : ""
            }
          >
            <span>02</span>
            <p>Open</p>
            <strong>{openCount}</strong>
            <small>Awaiting support review</small>
          </article>

          <article
            className={
              pendingCount ? "attention" : ""
            }
          >
            <span>03</span>
            <p>Pending</p>
            <strong>{pendingCount}</strong>
            <small>Active conversations</small>
          </article>

          <article>
            <span>04</span>
            <p>Resolved</p>
            <strong>{resolvedCount}</strong>
            <small>
              {closedCount
                ? `${closedCount} additionally closed`
                : "Completed support requests"}
            </small>
          </article>
        </section>

        <section className="admin-section admin-submissions support-queue-section">
          <div className="admin-section-heading support-queue-heading">
            <div>
              <p>SUPPORT QUEUE</p>

              <h2>All tickets</h2>

              <small className="support-queue-description">
                Review and manage incoming support requests
                across Avera Privé.
              </small>
            </div>

            <div className="support-queue-count">
              <span
                className={
                  activeCount > 0
                    ? "support-queue-count--active"
                    : ""
                }
              >
                <i />
                {activeCount} REQUIRE ATTENTION
              </span>

              <small>
                {tickets.length} TOTAL{" "}
                {tickets.length === 1
                  ? "REQUEST"
                  : "REQUESTS"}
              </small>
            </div>
          </div>

          <div
            className="admin-table support-table"
            role="table"
            aria-label="Support tickets"
          >
            <div
              className="admin-table-row head support-table-head"
              role="row"
            >
              <span>TICKET</span>
              <span>CATEGORY</span>
              <span>PRIORITY</span>
              <span>STATUS</span>
              <span>ACTION</span>
            </div>

            {tickets.length ? (
              tickets.map((ticket) => (
                <div
                  className="admin-table-row support-ticket-row"
                  role="row"
                  key={ticket.id}
                >
                  <span className="support-ticket-main">
                    <i className="support-ticket-mark">
                      AP
                    </i>

                    <span className="support-ticket-copy">
                      <b>{ticket.subject}</b>

                      <small>
                        {ticket.ticket_number} ·{" "}
                        {formatDate(ticket.created_at)}
                      </small>
                    </span>
                  </span>

                  <span
                    className="support-ticket-field"
                    data-label="CATEGORY"
                  >
                    <b className="support-mobile-label">
                      CATEGORY
                    </b>

                    {ticket.category
                      .replaceAll("_", " ")
                      .toUpperCase()}
                  </span>

                  <span
                    className="support-ticket-field"
                    data-label="PRIORITY"
                  >
                    <b className="support-mobile-label">
                      PRIORITY
                    </b>

                    <i
                      className={`support-priority support-priority-${ticket.priority.toLowerCase()}`}
                    >
                      <span />

                      {ticket.priority.toUpperCase()}
                    </i>
                  </span>

                  <span
                    className="support-ticket-field"
                    data-label="STATUS"
                  >
                    <b className="support-mobile-label">
                      STATUS
                    </b>

                    <i
                      className={`admin-status ${ticket.status} support-status`}
                    >
                      <span />

                      {ticket.status.replaceAll("_", " ")}
                    </i>
                  </span>

                  <span className="support-ticket-action-wrap">
                    <Link
                      className="support-ticket-action"
                      href={`/owners/dashboard/support/${ticket.id}`}
                    >
                      <b>OPEN TICKET</b>
                      <i>→</i>
                    </Link>
                  </span>
                </div>
              ))
            ) : (
              <div className="admin-empty support-empty">
                <i className="support-empty-mark">
                  AP
                </i>

                <p>SUPPORT QUEUE</p>

                <b>No support tickets.</b>

                <span>
                  New support requests will appear here
                  automatically.
                </span>
              </div>
            )}
          </div>
        </section>

        <div className="support-page-footer">
          <span>Avera Privé</span>

          <small>
            PRIVATE PLATFORM CONTROL · SUPPORT OPERATIONS
          </small>
        </div>
      </main>
    </OwnerOperationsShell>
  );
}