import { notFound } from "next/navigation";

import { revalidatePath } from "next/cache";





import { requireStaffRole } from "@/lib/auth/authorization";

import { OwnerOperationsShell } from "@/app/dashboard/_components/portal-shells";



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

   SERVER ACTION — SEND SUPPORT REPLY

========================================================= */



async function sendReply(formData: FormData) {

  "use server";



  const ticketId = String(formData.get("ticketId") ?? "");

  const message = String(formData.get("message") ?? "").trim();



  if (!ticketId || !message) {

    return;

  }



  const { supabase, user } = await requireStaffRole([

    "super_admin",

    "support",

  ]);



  const { error } = await supabase

    .from("ap_support_messages")

    .insert({

      ticket_id: ticketId,

      sender_id: user.id,

      sender_type: "support",

      message,

      is_internal: false,

    });



  if (error) {

    throw new Error(

      `Unable to send support reply: ${error.message}`

    );

  }



  /*

   * If this ticket was newly opened, move it into

   * pending once staff responds.

   */

  await supabase

    .from("ap_support_tickets")

    .update({

      status: "pending",

      updated_at: new Date().toISOString(),

    })

    .eq("id", ticketId)

    .eq("status", "open");



  revalidatePath(

    `/owners/dashboard/support/${ticketId}`

  );



  revalidatePath("/owners/dashboard/support");



  revalidatePath("/owners/dashboard");

}



/* =========================================================

   SERVER ACTION — INTERNAL STAFF NOTE

========================================================= */



async function addInternalNote(formData: FormData) {

  "use server";



  const ticketId = String(formData.get("ticketId") ?? "");

  const message = String(formData.get("message") ?? "").trim();



  if (!ticketId || !message) {

    return;

  }



  const { supabase, user } = await requireStaffRole([

    "super_admin",

    "support",

  ]);



  const { error } = await supabase

    .from("ap_support_messages")

    .insert({

      ticket_id: ticketId,

      sender_id: user.id,

      sender_type: "support",

      message,

      is_internal: true,

    });



  if (error) {

    throw new Error(

      `Unable to save internal note: ${error.message}`

    );

  }



  revalidatePath(

    `/owners/dashboard/support/${ticketId}`

  );

}



/* =========================================================

   SERVER ACTION — UPDATE TICKET STATUS

========================================================= */



async function updateTicketStatus(formData: FormData) {

  "use server";



  const ticketId = String(formData.get("ticketId") ?? "");



  const status = String(formData.get("status") ?? "");



  const allowedStatuses = [

    "open",

    "pending",

    "resolved",

    "closed",

  ];



  if (

    !ticketId ||

    !allowedStatuses.includes(status)

  ) {

    return;

  }



  const { supabase } = await requireStaffRole([

    "super_admin",

    "support",

  ]);



  const { error } = await supabase

    .from("ap_support_tickets")

    .update({

      status,

      updated_at: new Date().toISOString(),

    })

    .eq("id", ticketId);



  if (error) {

    throw new Error(

      `Unable to update ticket status: ${error.message}`

    );

  }



  revalidatePath(

    `/owners/dashboard/support/${ticketId}`

  );



  revalidatePath("/owners/dashboard/support");



  revalidatePath("/owners/dashboard");

}



/* =========================================================

   SERVER ACTION — CHANGE PRIORITY

========================================================= */



async function updatePriority(formData: FormData) {

  "use server";



  const ticketId = String(formData.get("ticketId") ?? "");



  const priority = String(

    formData.get("priority") ?? ""

  );



  const allowedPriorities = [

    "low",

    "normal",

    "high",

    "urgent",

  ];



  if (

    !ticketId ||

    !allowedPriorities.includes(priority)

  ) {

    return;

  }



  const { supabase } = await requireStaffRole([

    "super_admin",

    "support",

  ]);



  const { error } = await supabase

    .from("ap_support_tickets")

    .update({

      priority,

      updated_at: new Date().toISOString(),

    })

    .eq("id", ticketId);



  if (error) {

    throw new Error(

      `Unable to update ticket priority: ${error.message}`

    );

  }



  revalidatePath(

    `/owners/dashboard/support/${ticketId}`

  );



  revalidatePath("/owners/dashboard/support");

}



/* =========================================================

   PAGE

========================================================= */



export default async function SupportTicketPage({

  params,

}: {

  params: Promise<{

    ticketId: string;

  }>;

}) {

  const { ticketId } = await params;



  const { supabase, user } = await requireStaffRole([

    "super_admin",

    "support",

  ]);



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

    .maybeSingle();



  if (ticketError) {

    throw new Error(

      `Unable to load ticket: ${ticketError.message}`

    );

  }



  if (!ticketData) {

    notFound();

  }



  const ticket = ticketData as Ticket;



  /* =======================================================

     LOAD MESSAGES

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

     LOAD AGENCY

  ======================================================= */



  let agencyName = "No agency attached";



  if (ticket.agency_id) {

    const { data: agency } = await supabase

      .from("ap_agencies")

      .select("name")

      .eq("id", ticket.agency_id)

      .maybeSingle();



    if (agency?.name) {

      agencyName = agency.name;

    }

  }



  return (

    <OwnerOperationsShell

      active="support"

      email={user.email}

    >

      <main className="admin-main">

        {/* =================================================

            HEADER

        ================================================= */}



        <section className="admin-welcome">

          <div>

            <p className="admin-kicker">

              SUPPORT CASE

            </p>



            <h1>{ticket.subject}</h1>



            <p>

              Ticket {ticket.ticket_number}

            </p>

          </div>



          <div className="admin-date-card">

            <span>STATUS</span>



            <b>{displayValue(ticket.status)}</b>



            <small>

              Created{" "}{formatDate(ticket.created_at)}

            </small>

          </div>

        </section>



        {/* =================================================

            TICKET INFORMATION

        ================================================= */}



        <section className="admin-stats">

          <article>

            <span>01</span>



            <p>Ticket</p>



            <strong>

              {ticket.ticket_number}

            </strong>



            <small>

              Internal support reference

            </small>

          </article>



          <article>

            <span>02</span>



            <p>Category</p>



            <strong>

              {displayValue(ticket.category)}

            </strong>



            <small>

              Support classification

            </small>

          </article>



          <article

            className={

              ticket.priority === "urgent" ||

              ticket.priority === "high"

                ? "attention"

                : ""

            }

          >

            <span>03</span>



            <p>Priority</p>



            <strong>

              {displayValue(ticket.priority)}

            </strong>



            <small>

              Current urgency

            </small>

          </article>



          <article>

            <span>04</span>



            <p>Agency</p>



            <strong>{agencyName}</strong>



            <small>

              Associated account

            </small>

          </article>

        </section>



        {/* =================================================

            MANAGEMENT CONTROLS

        ================================================= */}



        <div className="admin-content-grid">

          <section className="admin-section">

            <div className="admin-section-heading">

              <div>

                <p>CASE MANAGEMENT</p>



                <h2>Ticket controls</h2>

              </div>

            </div>



            <div

              style={{

                display: "grid",

                gap: "24px",

              }}

            >

              {/* STATUS */}



              <form

                action={updateTicketStatus}

                style={{

                  display: "grid",

                  gap: "10px",

                }}

              >

                <input

                  type="hidden"

                  name="ticketId"

                  value={ticket.id}

                />



                <label htmlFor="status">

                  Ticket status

                </label>



                <select

                  id="status"

                  name="status"

                  defaultValue={ticket.status}

                >

                  <option value="open">

                    Open

                  </option>



                  <option value="pending">

                    Pending

                  </option>



                  <option value="resolved">

                    Resolved

                  </option>



                  <option value="closed">

                    Closed

                  </option>

                </select>



                <button type="submit">

                  UPDATE STATUS

                </button>

              </form>



              {/* PRIORITY */}



              <form

                action={updatePriority}

                style={{

                  display: "grid",

                  gap: "10px",

                }}

              >

                <input

                  type="hidden"

                  name="ticketId"

                  value={ticket.id}

                />



                <label htmlFor="priority">

                  Priority

                </label>



                <select

                  id="priority"

                  name="priority"

                  defaultValue={ticket.priority}

                >

                  <option value="low">

                    Low

                  </option>



                  <option value="normal">

                    Normal

                  </option>



                  <option value="high">

                    High

                  </option>



                  <option value="urgent">

                    Urgent

                  </option>

                </select>



                <button type="submit">

                  UPDATE PRIORITY

                </button>

              </form>

            </div>

          </section>



          {/* =================================================

              CASE DETAILS

          ================================================= */}



          <aside className="admin-section admin-principles">

            <p>CASE INFORMATION</p>



            <h2>Support record.</h2>



            <ul>

              <li>

                <span>01</span>



                <div>

                  <b>Agency</b>



                  <small>

                    {agencyName}

                  </small>

                </div>

              </li>



              <li>

                <span>02</span>



                <div>

                  <b>Created</b>



                  <small>

                    {formatDate(

                      ticket.created_at

                    )}

                  </small>

                </div>

              </li>



              <li>

                <span>03</span>



                <div>

                  <b>Last updated</b>



                  <small>

                    {formatDate(

                      ticket.updated_at

                    )}

                  </small>

                </div>

              </li>

            </ul>

          </aside>

        </div>



        {/* =================================================

            CONVERSATION

        ================================================= */}



        <section

          className="admin-section"

          style={{

            marginTop: "28px",

          }}

        >

          <div className="admin-section-heading">

            <div>

              <p>CONVERSATION</p>



              <h2>Ticket history</h2>

            </div>



            <span>

              {messages.length} MESSAGES

            </span>

          </div>



          <div

            style={{

              display: "grid",

              gap: "16px",

            }}

          >

            {messages.length ? (

              messages.map((message) => (

                <article

                  key={message.id}

                  style={{

                    padding: "20px",

                    border:

                      "1px solid rgba(255,255,255,.1)",

                    background: message.is_internal

                      ? "rgba(197,160,89,.08)"

                      : "rgba(255,255,255,.025)",

                  }}

                >

                  <div

                    style={{

                      display: "flex",

                      justifyContent:

                        "space-between",

                      gap: "20px",

                      marginBottom: "12px",

                    }}

                  >

                    <div>

                      <b>

                        {message.is_internal

                          ? "INTERNAL STAFF NOTE"

                          : message.sender_type ===

                              "support"

                            ? "Avera Privé SUPPORT"

                            : "CUSTOMER"}

                      </b>



                      {message.is_internal && (

                        <small

                          style={{

                            display: "block",

                            marginTop: "4px",

                          }}

                        >

                          Not visible to customer

                        </small>

                      )}

                    </div>



                    <small>

                      {formatDate(

                        message.created_at

                      )}

                    </small>

                  </div>



                  <p

                    style={{

                      whiteSpace: "pre-wrap",

                      margin: 0,

                      lineHeight: 1.7,

                    }}

                  >

                    {message.message}

                  </p>

                </article>

              ))

            ) : (

              <div className="admin-empty">

                <b>No messages yet.</b>



                <span>

                  The conversation will appear

                  here once a message is added.

                </span>

              </div>

            )}

          </div>

        </section>



        {/* =================================================

            SEND PUBLIC REPLY

        ================================================= */}



        <section

          className="admin-section"

          style={{

            marginTop: "28px",

          }}

        >

          <div className="admin-section-heading">

            <div>

              <p>REPLY</p>



              <h2>Respond to customer</h2>

            </div>

          </div>



          <form

            action={sendReply}

            style={{

              display: "grid",

              gap: "16px",

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

              placeholder="Write your support response..."

            />



            <div>

              <button type="submit">

                SEND REPLY

              </button>

            </div>

          </form>

        </section>



        {/* =================================================

            INTERNAL NOTE

        ================================================= */}



        <section

          className="admin-section"

          style={{

            marginTop: "28px",

          }}

        >

          <div className="admin-section-heading">

            <div>

              <p>PRIVATE STAFF NOTE</p>



              <h2>Add internal note</h2>

            </div>



            <span>NOT CUSTOMER VISIBLE</span>

          </div>



          <form

            action={addInternalNote}

            style={{

              display: "grid",

              gap: "16px",

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

              rows={5}

              placeholder="Add a private note for Avera Privé staff..."

            />



            <div>

              <button type="submit">

                ADD INTERNAL NOTE

              </button>

            </div>

          </form>

        </section>

      </main>

    </OwnerOperationsShell>

  );

}
