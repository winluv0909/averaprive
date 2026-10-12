import { requireStaffRole } from "@/lib/auth/authorization";
import { OwnerOperationsShell } from "../_components/portal-shells";
import { decidePlanRequest } from "./actions";

type Request = { id:string; requested_plan:string; created_at:string; ap_agencies:{name:string}|{name:string}[]|null };
type Subscription = { id:string; plan_code:string; status:string; trial_ends_at:string|null; current_period_ends_at:string|null; commercial_reference:string|null; ap_agencies:{name:string}|{name:string}[]|null };

function agencyName(value: Request["ap_agencies"] | Subscription["ap_agencies"]) {
  const agency = Array.isArray(value) ? value[0] : value;
  return agency?.name ?? "Agency";
}

function formatPeriodEnd(item: Subscription) {
  const value = item.trial_ends_at ?? item.current_period_ends_at;
  return value ? `Ends ${new Intl.DateTimeFormat("en-PH", { dateStyle:"medium" }).format(new Date(value))}` : "No period end";
}

export default async function SubscriptionOperations({ searchParams }: { searchParams:Promise<{updated?:string;error?:string}> }) {
  const query = await searchParams;
  const { supabase, user } = await requireStaffRole(["super_admin","finance"]);
  const [{ data: requests }, { data: subscriptions }] = await Promise.all([
    supabase.from("ap_plan_change_requests").select("id,requested_plan,created_at,ap_agencies(name)").eq("status","pending").order("created_at"),
    supabase.from("ap_subscriptions").select("id,plan_code,status,trial_ends_at,current_period_ends_at,commercial_reference,ap_agencies(name)").order("updated_at",{ascending:false}),
  ]);
  const pending = (requests ?? []) as Request[];
  const active = (subscriptions ?? []) as Subscription[];

  return <OwnerOperationsShell active="subscriptions" email={user.email}><main className="subscription-main">
    <section className="subscription-hero"><div><p className="eyebrow">COMMERCIAL OPERATIONS</p><h1>Subscriptions.</h1><span>Activate commercial tools and visibility without influencing independent trust systems.</span></div><div><b>{pending.length}</b><span>PENDING REQUESTS</span></div></section>
    {query.updated && <p className="operation-notice">Subscription decision recorded.</p>}{query.error && <p className="operation-error">{query.error}</p>}
    <section className="subscription-boundary"><b>NON-NEGOTIABLE BOUNDARY</b><span>Subscription approval never creates Verified status, modifies review outcomes, changes objective ranking scores, or bypasses moderation.</span></section>
    <div className="subscription-grid">
      <section className="subscription-panel"><header><p>ACTIVATION QUEUE</p><h2>Plan requests</h2></header>
        {pending.length ? pending.map((item) => <article className="subscription-request" key={item.id}><div><span>{item.requested_plan.toUpperCase()}</span><h3>{agencyName(item.ap_agencies)}</h3><small>{new Intl.DateTimeFormat("en-PH",{dateStyle:"medium"}).format(new Date(item.created_at))}</small></div><form><label>Commercial reference<input name="commercial_reference" placeholder="Invoice or payment reference" /></label><label>Decision note<textarea name="note" minLength={10} required /></label><div><button formAction={decidePlanRequest.bind(null,item.id,"approved")}>APPROVE &amp; ACTIVATE</button><button className="decline" formAction={decidePlanRequest.bind(null,item.id,"declined")}>DECLINE</button></div></form></article>) : <p className="subscription-empty">No plan requests are waiting.</p>}
      </section>
      <section className="subscription-panel"><header><p>ACCOUNT HEALTH</p><h2>Current subscriptions</h2></header><div className="subscription-table">
        {active.length ? active.map((item) => <div key={item.id}><span className={item.status}>{item.status}</span><p><b>{agencyName(item.ap_agencies)}</b><small>{item.plan_code.toUpperCase()} · {item.commercial_reference || "No billing reference"}</small></p><time>{formatPeriodEnd(item)}</time></div>) : <p className="subscription-empty">No subscription records yet.</p>}
      </div></section>
    </div>
  </main></OwnerOperationsShell>;
}
