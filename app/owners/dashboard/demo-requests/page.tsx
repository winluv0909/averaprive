import { requireStaffRole } from "@/lib/auth/authorization";
import { OwnerOperationsShell } from "@/app/dashboard/_components/portal-shells";

export const dynamic = "force-dynamic";
type Details = {
  firstName: string; lastName: string; email: string; agencyName: string;
  agencySize: string; plan: string; website: string; goals: string;
};
type DemoRequest = { id: string; details: Details; created_at: string; notification_status: string };

export default async function DemoRequestsPage() {
  const { supabase, user } = await requireStaffRole(["super_admin", "support"]);
  const { data, error } = await supabase.from("ap_demo_requests")
    .select("id,details,created_at,notification_status")
    .order("created_at", { ascending: false }).limit(100);
  const requests = (data ?? []) as DemoRequest[];
  return <OwnerOperationsShell active="inquiries" email={user.email}>
    <main className="owner-section-page owner-section-inquiries inquiry-main">
      <section className="inquiry-hero"><div><p className="eyebrow">AGENCY DEMOS</p>
        <h1>Demo requests.</h1><p>The latest 100 requests. Contact the agency to arrange a demo.</p>
        <a href="/owners/dashboard/inquiries">Back to inquiry operations</a>
      </div></section>
      {error ? <p className="operation-error">Demo requests could not be loaded. Please try again later.</p>
        : <section className="inquiry-list">{requests.length ? requests.map(item => <article key={item.id}>
          <header><div><p>{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(item.created_at))} UTC</p>
            <h2>{item.details.agencyName}</h2></div><span>{item.notification_status === "sent" ? "Email notification sent" : "Follow up from this inbox"}</span></header>
          <div className="inquiry-contact"><p><b>{item.details.firstName} {item.details.lastName}</b>
            <a href={`mailto:${item.details.email}`}>{item.details.email}</a></p>
            <p>Team size: {item.details.agencySize} · Plan: {item.details.plan}</p>
            {item.details.website && <p>Website: {item.details.website}</p>}
            <p style={{ whiteSpace: "pre-wrap" }}>{item.details.goals}</p>
            <small>Request {item.id} · Contact consent recorded</small>
          </div>
        </article>) : <div className="analytics-empty">No demo requests have been submitted yet.</div>}</section>}
    </main>
  </OwnerOperationsShell>;
}
