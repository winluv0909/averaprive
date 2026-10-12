import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/authorization";
import { AgencyWorkspaceShell } from "../_components/portal-shells";

export const metadata = {
  title: "Support | Avera Privé",
};

type SupportTicket = {
  id: string;
  ticket_number: string;
  agency_id: string | null;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type Membership = {
  agency_id: string;
  role: string;
  ap_agencies:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function displayValue(value: string) {
  return value.replaceAll("_", " ");
}

/* =========================================================
   CREATE SUPPORT TICKET
========================================================= */

async function createSupportTicket(formData: FormData) {
  "use server";

  const { supabase, user } = await requireUser();

  const subject = String(
    formData.get("subject") ?? ""
  ).trim();

  const message = String(
    formData.get("message") ?? ""
  ).trim();

  const category = String(
    formData.get("category") ?? "general"
  );

  const agencyIdRaw = String(
    formData.get("agency_id") ?? ""
  );

  const agencyId =
    agencyIdRaw && agencyIdRaw !== "none"
      ? agencyIdRaw
      : null;

  const allowedCategories = [
    "general",
    "account",
    "agency_profile",
    "verification",
    "billing",
    "technical",
    "review_dispute",
    "report",
    "other",
  ];

  if (
    !subject ||
    !message ||
    !allowedCategories.includes(category)
  ) {
    redirect(
      "/agency/dashboard/support?error=invalid"
    );
  }

  /*
   * If an agency was selected, verify that the
   * logged-in user actually belongs to it.
   */
  if (agencyId) {
    const { data: membership } = await supabase
      .from("ap_agency_memberships")
      .select("agency_id")
      .eq("agency_id", agencyId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      redirect(
        "/agency/dashboard/support?error=agency"
      );
    }
  }

  /*
   * Create the support ticket.
   *
   * ticket_number is generated automatically by
   * the database trigger we created earlier.
   */
  const {
    data: ticket,
    error: ticketError,
  } = await supabase
    .from("ap_support_tickets")
    .insert({
      user_id: user.id,
      agency_id: agencyId,
      subject,
      category,
      priority: "normal",
      status: "open",
    })
    .select("id,ticket_number")
    .single();

  if (ticketError || !ticket) {
    throw new Error(
      `Unable to create support ticket: ${
        ticketError?.message ??
        "Ticket was not returned."
      }`
    );
  }

  /*
   * Store the user's first message as the first
   * conversation message.
   */
  const { error: messageError } = await supabase
    .from("ap_support_messages")
    .insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_type: "user",
      message,
      is_internal: false,
    });

  /*
   * If the first message fails, remove the empty
   * ticket so we don't leave an incomplete case.
   */
  if (messageError) {
  throw new Error(
    `Ticket ${ticket.ticket_number} was created, but the initial message could not be saved: ${messageError.message}`
  );
}

  revalidatePath("/agency/dashboard/support");
  revalidatePath("/owners/dashboard/support");

  redirect(
    `/agency/dashboard/support/${ticket.id}`
  );
}

/* =========================================================
   SUPPORT CENTER
========================================================= */

export default async function AgencySupportPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
  }>;
}) {
  const query = await searchParams;

  const { supabase, user } = await requireUser();

  const [
    ticketsResult,
    membershipsResult,
  ] = await Promise.all([
    supabase
      .from("ap_support_tickets")
      .select(
        `
        id,
        ticket_number,
        agency_id,
        subject,
        category,
        priority,
        status,
        created_at,
        updated_at
        `
      )
      .eq("user_id", user.id)
      .order("updated_at", {
        ascending: false,
      }),

    supabase
      .from("ap_agency_memberships")
      .select(
        `
        agency_id,
        role,
        ap_agencies(name)
        `
      )
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  if (ticketsResult.error) {
    throw new Error(
      `Unable to load support tickets: ${ticketsResult.error.message}`
    );
  }

  if (membershipsResult.error) {
    throw new Error(
      `Unable to load agency memberships: ${membershipsResult.error.message}`
    );
  }

  const tickets =
    (ticketsResult.data ?? []) as SupportTicket[];

  const memberships =
    (membershipsResult.data ?? []) as Membership[];

  const activeTickets = tickets.filter(
    (ticket) =>
      ticket.status !== "resolved" &&
      ticket.status !== "closed"
  );

  const resolvedTickets = tickets.filter(
    (ticket) =>
      ticket.status === "resolved" ||
      ticket.status === "closed"
  );

  return (
    <AgencyWorkspaceShell
      active="support"
      email={user.email}
    >
      <main className="agency-main">
        {/* =================================================
            HERO
        ================================================= */}

        <section className="agency-hero">
          <div>
            <p className="eyebrow">
              HELP &amp; SUPPORT
            </p>

            <h1>How can we help?</h1>

            <p>
              Contact Avera Privé for account,
              verification, profile, billing, review,
              or technical assistance.
            </p>
          </div>
        </section>

        {/* =================================================
            ERROR MESSAGES
        ================================================= */}

        {query.error === "invalid" && (
          <p
            className="operation-error"
            role="alert"
          >
            Please complete the subject, category,
            and message before submitting your
            request.
          </p>
        )}

        {query.error === "agency" && (
          <p
            className="operation-error"
            role="alert"
          >
            You do not have access to the selected
            agency.
          </p>
        )}

        {/* =================================================
            OVERVIEW
        ================================================= */}

        <div className="agency-overview-grid">
          <section className="agency-panel">
            <div className="agency-panel-head">
              <div>
                <p>MY SUPPORT REQUESTS</p>
                <h2>Support history</h2>
              </div>

              <span>
                {tickets.length} TICKET
                {tickets.length === 1 ? "" : "S"}
              </span>
            </div>

            <div className="agency-list">
              {tickets.length ? (
                tickets.map((ticket) => (
                  <Link
                    href={`/agency/dashboard/support/${ticket.id}`}
                    key={ticket.id}
                  >
                    <div>
                      <b>{ticket.subject}</b>

                      <small>
                        {ticket.ticket_number}
                        {" · "}
                        {displayValue(
                          ticket.category
                        ).toUpperCase()}
                        {" · "}
                        {displayValue(
                          ticket.status
                        ).toUpperCase()}
                        {" · "}
                        UPDATED{" "}
                        {formatDate(
                          ticket.updated_at
                        ).toUpperCase()}
                      </small>
                    </div>

                    <span>OPEN →</span>
                  </Link>
                ))
              ) : (
                <div className="agency-empty">
                  <h3>No support requests yet.</h3>

                  <p>
                    When you contact Avera Privé,
                    your requests and responses will
                    appear here.
                  </p>
                </div>
              )}
            </div>
          </section>

          <aside className="agency-panel agency-quick">
            <p>SUPPORT STATUS</p>

            <h2>Your requests</h2>

            <div>
              <b>{activeTickets.length}</b>
              <span>
                Active ticket
                {activeTickets.length === 1
                  ? ""
                  : "s"}
              </span>
            </div>

            <div>
              <b>{resolvedTickets.length}</b>
              <span>
                Resolved ticket
                {resolvedTickets.length === 1
                  ? ""
                  : "s"}
              </span>
            </div>

            <Link href="/agency/dashboard">
              Return to workspace
              <span>→</span>
            </Link>
          </aside>
        </div>

        {/* =================================================
            CREATE TICKET
        ================================================= */}

        <section
          className="agency-panel"
          style={{
            marginTop: "28px",
          }}
        >
          <div className="agency-panel-head">
            <div>
              <p>NEW SUPPORT REQUEST</p>

              <h2>Contact Avera Privé</h2>
            </div>

            <span>SECURE SUPPORT</span>
          </div>

          <form
  action={createSupportTicket}
  className="agency-support-form"
>
            {/* CATEGORY */}

            <div
              style={{
                display: "grid",
                gap: "8px",
              }}
            >
              <label htmlFor="category">
                Category
              </label>

              <select
                id="category"
                name="category"
                required
                defaultValue="general"
              >
                <option value="general">
                  General question
                </option>

                <option value="account">
                  Account
                </option>

                <option value="agency_profile">
                  Agency profile
                </option>

                <option value="verification">
                  Verification
                </option>

                <option value="billing">
                  Billing
                </option>

                <option value="technical">
                  Technical issue
                </option>

                <option value="review_dispute">
                  Review / dispute
                </option>

                <option value="report">
                  Report
                </option>

                <option value="other">
                  Other
                </option>
              </select>
            </div>

            {/* AGENCY */}

            <div
              style={{
                display: "grid",
                gap: "8px",
              }}
            >
              <label htmlFor="agency_id">
                Related agency
              </label>

              <select
                id="agency_id"
                name="agency_id"
                defaultValue="none"
              >
                <option value="none">
                  No specific agency
                </option>

                {memberships.map(
                  (membership) => {
                    const agency =
                      Array.isArray(
                        membership.ap_agencies
                      )
                        ? membership
                            .ap_agencies[0]
                        : membership.ap_agencies;

                    return (
                      <option
                        key={
                          membership.agency_id
                        }
                        value={
                          membership.agency_id
                        }
                      >
                        {agency?.name ??
                          "Agency profile"}
                      </option>
                    );
                  }
                )}
              </select>

              <small>
                Select an agency only when your
                request relates to one of your
                agency profiles.
              </small>
            </div>

            {/* SUBJECT */}

            <div
              style={{
                display: "grid",
                gap: "8px",
              }}
            >
              <label htmlFor="subject">
                Subject
              </label>

              <input
                id="subject"
                name="subject"
                type="text"
                required
                maxLength={180}
                placeholder="Briefly describe your request"
              />
            </div>

            {/* MESSAGE */}

            <div
              style={{
                display: "grid",
                gap: "8px",
              }}
            >
              <label htmlFor="message">
                Message
              </label>

              <textarea
                id="message"
                name="message"
                required
                rows={8}
                maxLength={5000}
                placeholder="Tell us what happened and include any details that will help us assist you."
              />
            </div>

            <div>
              <button
                className="button agency-primary-action"
                type="submit"
              >
                SUBMIT SUPPORT REQUEST
              </button>
            </div>
          </form>
        </section>

        {/* =================================================
            SUPPORT INFORMATION
        ================================================= */}

        <section className="agency-guide">
          <article>
            <span>01</span>

            <h3>Describe the issue</h3>

            <p>
              Include enough information for our
              support team to understand what you
              need help with.
            </p>
          </article>

          <article>
            <span>02</span>

            <h3>Track your request</h3>

            <p>
              Your support request remains available
              in this workspace with its current
              status and conversation history.
            </p>
          </article>

          <article>
            <span>03</span>

            <h3>Continue the conversation</h3>

            <p>
              When Avera Privé responds, you can
              return to the ticket and reply directly
              from your secure workspace.
            </p>
          </article>
        </section>
      </main>
    </AgencyWorkspaceShell>
  );
}