import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/authorization";
import { AgencyWorkspaceShell } from "../../_components/portal-shells";

export const metadata = {
  title: "Support Ticket | Avera Privé",
};

type Ticket = {
  id: string;
  ticket_number: string;
  user_id: string;
  agency_id: string | null;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string | null;
};

type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  is_internal: boolean;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function displayValue(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

/* =========================================================
   SERVER ACTION — CUSTOMER REPLY
========================================================= */

async function sendCustomerReply(formData: FormData) {
  "use server";

  const ticketId = String(
    formData.get("ticketId") ?? ""
  );

  const message = String(
    formData.get("message") ?? ""
  ).trim();

  if (!ticketId || !message) {
    return;
  }

  const { supabase, user } = await requireUser();

  /*
   * Security check:
   * the logged-in user must own this support ticket.
   */
  const { data: ticket, error: ticketError } =
    await supabase
      .from("ap_support_tickets")
      .select("id,status,user_id")
      .eq("id", ticketId)
      .eq("user_id", user.id)
      .maybeSingle();

  if (ticketError) {
    throw new Error(
      `Unable to verify support ticket: ${ticketError.message}`
    );
  }

  if (!ticket) {
    return;
  }

  /*
   * Closed tickets cannot receive additional
   * customer replies.
   */
  if (ticket.status === "closed") {
    return;
  }

  const { error: messageError } = await supabase
    .from("ap_support_messages")
    .insert({
      ticket_id: ticketId,
      sender_id: user.id,
      sender_type: "user",
      message,
      is_internal: false,
    });

  if (messageError) {
    throw new Error(
      `Unable to send support reply: ${messageError.message}`
    );
  }

  /*
   * A customer reply means the ticket requires
   * staff attention again.
   *
   * Pending tickets return to open.
   * Resolved tickets can also be reopened when
   * the customer replies.
   */
  if (
    ticket.status === "pending" ||
    ticket.status === "resolved"
  ) {
    const { error: statusError } = await supabase
      .from("ap_support_tickets")
      .update({
        status: "open",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId)
      .eq("user_id", user.id);

    if (statusError) {
      throw new Error(
        `Your reply was saved, but the ticket status could not be updated: ${statusError.message}`
      );
    }
  }

  revalidatePath(
    `/agency/dashboard/support/${ticketId}`
  );

  revalidatePath("/agency/dashboard/support");

  revalidatePath(
    `/owners/dashboard/support/${ticketId}`
  );

  revalidatePath("/owners/dashboard/support");
}

/* =========================================================
   PAGE
========================================================= */

export default async function AgencySupportTicketPage({
  params,
}: {
  params: Promise<{
    ticketId: string;
  }>;
}) {
  const { ticketId } = await params;

  const { supabase, user } = await requireUser();

  /* =======================================================
     LOAD TICKET
  ======================================================= */

  const {
    data: ticketData,
    error: ticketError,
  } = await supabase
    .from("ap_support_tickets")
    .select(
      `
      id,
      ticket_number,
      user_id,
      agency_id,
      subject,
      category,
      priority,
      status,
      created_at,
      updated_at
      `
    )
    .eq("id", ticketId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (ticketError) {
    throw new Error(
      `Unable to load support ticket: ${ticketError.message}`
    );
  }

  if (!ticketData) {
    notFound();
  }

  const ticket = ticketData as Ticket;

  /* =======================================================
     LOAD PUBLIC MESSAGES ONLY
  ======================================================= */

  const {
    data: messageData,
    error: messageError,
  } = await supabase
    .from("ap_support_messages")
    .select(
      `
      id,
      ticket_id,
      sender_id,
      sender_type,
      message,
      is_internal,
      created_at
      `
    )
    .eq("ticket_id", ticketId)
    .eq("is_internal", false)
    .order("created_at", {
      ascending: true,
    });

  if (messageError) {
    throw new Error(
      `Unable to load ticket messages: ${messageError.message}`
    );
  }

  const messages =
    (messageData ?? []) as SupportMessage[];

  /* =======================================================
     LOAD RELATED AGENCY
  ======================================================= */

  let agencyName = "No agency attached";

  if (ticket.agency_id) {
    /*
     * Only resolve an agency name if the current
     * user has active access to that agency.
     */
    const { data: membership } = await supabase
      .from("ap_agency_memberships")
      .select(
        `
        agency_id,
        ap_agencies(name)
        `
      )
      .eq("agency_id", ticket.agency_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (membership?.ap_agencies) {
      const agency = Array.isArray(
        membership.ap_agencies
      )
        ? membership.ap_agencies[0]
        : membership.ap_agencies;

      if (agency?.name) {
        agencyName = agency.name;
      }
    }
  }

  const isClosed = ticket.status === "closed";

  return (
    <AgencyWorkspaceShell
      active="support"
      email={user.email}
    >
      <main className="agency-main">
        {/* =================================================
            HEADER
        ================================================= */}

        <section className="agency-hero">
          <div>
            <p className="eyebrow">
              SUPPORT REQUEST
            </p>

            <h1>{ticket.subject}</h1>

            <p>
              Ticket {ticket.ticket_number}
            </p>
          </div>

          <Link
            className="button"
            href="/agency/dashboard/support"
          >
            ← BACK TO SUPPORT
          </Link>
        </section>

        {/* =================================================
            TICKET SUMMARY
        ================================================= */}

        <div className="agency-overview-grid">
          <section className="agency-panel">
            <div className="agency-panel-head">
              <div>
                <p>TICKET INFORMATION</p>

                <h2>{ticket.ticket_number}</h2>
              </div>

              <span>
                {displayValue(ticket.status)}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "1px",
              }}
            >
              <div
                style={{
                  padding: "22px",
                }}
              >
                <small>CATEGORY</small>

                <p>
                  <b>
                    {displayValue(
                      ticket.category
                    )}
                  </b>
                </p>
              </div>

              <div
                style={{
                  padding: "22px",
                }}
              >
                <small>STATUS</small>

                <p>
                  <b>
                    {displayValue(
                      ticket.status
                    )}
                  </b>
                </p>
              </div>

              <div
                style={{
                  padding: "22px",
                }}
              >
                <small>PRIORITY</small>

                <p>
                  <b>
                    {displayValue(
                      ticket.priority
                    )}
                  </b>
                </p>
              </div>

              <div
                style={{
                  padding: "22px",
                }}
              >
                <small>AGENCY</small>

                <p>
                  <b>{agencyName}</b>
                </p>
              </div>
            </div>
          </section>

          <aside className="agency-panel agency-quick">
            <p>REQUEST STATUS</p>

            <h2>
              {displayValue(ticket.status)}
            </h2>

            <div>
              <span>Created</span>

              <b>
                {formatDate(ticket.created_at)}
              </b>
            </div>

            <div>
              <span>Last updated</span>

              <b>
                {formatDate(ticket.updated_at)}
              </b>
            </div>

            <Link href="/agency/dashboard/support">
              All support requests
              <span>→</span>
            </Link>
          </aside>
        </div>

        {/* =================================================
            CONVERSATION
        ================================================= */}

        <section
          className="agency-panel"
          style={{
            marginTop: "28px",
          }}
        >
          <div className="agency-panel-head">
            <div>
              <p>CONVERSATION</p>

              <h2>Ticket history</h2>
            </div>

            <span>
              {messages.length} MESSAGE
              {messages.length === 1 ? "" : "S"}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gap: "16px",
              padding: "24px",
            }}
          >
            {messages.length ? (
              messages.map((message) => {
                const isStaff =
                  message.sender_type === "support";

                return (
                  <article
                    key={message.id}
                    style={{
                      padding: "22px",
                      border:
                        "1px solid rgba(20,20,20,.12)",
                      background: isStaff
                        ? "#f4efe5"
                        : "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "flex-start",
                        gap: "20px",
                        marginBottom: "14px",
                      }}
                    >
                      <b>
                        {isStaff
                          ? "Avera Privé SUPPORT"
                          : "YOU"}
                      </b>

                      <small>
                        {formatDate(
                          message.created_at
                        )}
                      </small>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {message.message}
                    </p>
                  </article>
                );
              })
            ) : (
              <div className="agency-empty">
                <h3>No messages yet.</h3>

                <p>
                  Your support conversation will
                  appear here.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* =================================================
            CUSTOMER REPLY
        ================================================= */}

        {!isClosed ? (
          <section
            className="agency-panel"
            style={{
              marginTop: "28px",
            }}
          >
            <div className="agency-panel-head">
              <div>
                <p>REPLY</p>

                <h2>
                  Continue the conversation
                </h2>
              </div>

              <span>SECURE SUPPORT</span>
            </div>

            <form
              action={sendCustomerReply}
              style={{
                display: "grid",
                gap: "16px",
                padding: "24px",
              }}
            >
              <input
                type="hidden"
                name="ticketId"
                value={ticket.id}
              />

              <textarea
                name="message"
                required
                rows={7}
                maxLength={5000}
                placeholder="Write your reply to Avera Privé support..."
              />

              <div>
                <button
                  className="button agency-primary-action"
                  type="submit"
                >
                  SEND REPLY
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section
            className="agency-panel"
            style={{
              marginTop: "28px",
            }}
          >
            <div className="agency-empty">
              <h3>This support request is closed.</h3>

              <p>
                This conversation can no longer
                receive new replies.
              </p>

              <Link
                className="button"
                href="/agency/dashboard/support"
              >
                RETURN TO SUPPORT
              </Link>
            </div>
          </section>
        )}

        {/* =================================================
            PRIVACY NOTE
        ================================================= */}

        <section className="agency-guide">
          <article>
            <span>01</span>

            <h3>Secure conversation</h3>

            <p>
              This support request is associated
              with your authenticated Avera Privé
              account.
            </p>
          </article>

          <article>
            <span>02</span>

            <h3>Support responses</h3>

            <p>
              Replies from Avera Privé support
              appear directly in this conversation.
            </p>
          </article>

          <article>
            <span>03</span>

            <h3>Ticket history</h3>

            <p>
              Your public support conversation
              remains available from your Agency
              Workspace.
            </p>
          </article>
        </section>
      </main>
    </AgencyWorkspaceShell>
  );
}