import Link from "next/link";
import { requireStaffRole } from "@/lib/auth/authorization";
import { OwnerOperationsShell } from "../_components/portal-shells";

type EventRow = { agency_id: string | null; event_type: string; session_id: string; source: string; occurred_at: string };
type InquiryRow = { agency_id: string; status: string; qualification_status: string; source: string; created_at: string };
type AgencyRow = { id: string; name: string; published: boolean };

const percent = (part: number, whole: number) => whole ? Math.round((part / whole) * 100) : 0;

export default async function MarketplaceAnalyticsPage() {
  const { supabase, user } = await requireStaffRole(["super_admin", "finance"]);
  // This is a dynamic operational report; its rolling window is intentionally evaluated per request.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [eventsResult, inquiriesResult, agenciesResult, verifiedResult, placementsResult] = await Promise.all([
    supabase.from("ap_marketplace_events").select("agency_id,event_type,session_id,source,occurred_at").gte("occurred_at", since),
    supabase.from("ap_inquiries").select("agency_id,status,qualification_status,source,created_at").gte("created_at", since),
    supabase.from("ap_agencies").select("id,name,published"),
    supabase.from("ap_verifications").select("agency_id").eq("status", "approved"),
    supabase.from("ap_sponsored_placements").select("agency_id,status,starts_at,ends_at").eq("status", "active"),
  ]);
  const events = (eventsResult.data ?? []) as EventRow[];
  const inquiries = (inquiriesResult.data ?? []) as InquiryRow[];
  const agencies = (agenciesResult.data ?? []) as AgencyRow[];
  const count = (event: string) => events.filter((item) => item.event_type === event).length;
  const unique = (event: string) => new Set(events.filter((item) => item.event_type === event).map((item) => item.session_id)).size;
  const impressions = count("directory_impression");
  const views = count("profile_view");
  const contactOpens = count("contact_open");
  const submitted = inquiries.length;
  const qualified = inquiries.filter((item) => item.qualification_status === "qualified").length;
  const accepted = inquiries.filter((item) => item.status === "accepted" || item.status === "closed").length;
  const sponsoredViews = events.filter((item) => item.event_type === "profile_view" && item.source === "sponsored").length;
  const sponsoredInquiries = inquiries.filter((item) => item.source === "sponsored").length;
  const activeAgencies = agencies.filter((item) => item.published).length;
  const verifiedAgencies = new Set((verifiedResult.data ?? []).map((item) => item.agency_id)).size;
  const activePlacements = placementsResult.data?.length ?? 0;
  const topAgencies = agencies.map((agency) => ({
    id: agency.id, name: agency.name,
    views: events.filter((event) => event.agency_id === agency.id && event.event_type === "profile_view").length,
    inquiries: inquiries.filter((inquiry) => inquiry.agency_id === agency.id).length,
  })).filter((item) => item.views || item.inquiries).sort((a, b) => b.views - a.views || b.inquiries - a.inquiries).slice(0, 8);
  const sources = ["organic", "search", "direct", "sponsored"].map((source) => ({
    source, views: events.filter((item) => item.source === source && item.event_type === "profile_view").length,
    inquiries: inquiries.filter((item) => item.source === source).length,
  }));

  return <OwnerOperationsShell active="analytics" email={user.email}>
    <main className="analytics-main">
      <section className="analytics-hero"><div><p className="eyebrow">MARKETPLACE INTELLIGENCE</p><h1>Performance without compromising trust.</h1><p>Thirty-day marketplace activity, conversion quality, and clearly separated paid-placement performance.</p></div><div className="analytics-window"><span>REPORTING WINDOW</span><b>LAST 30 DAYS</b><small>Deduplicated public activity</small></div></section>

      <section className="analytics-kpis">
        <article><span>PUBLIC SUPPLY</span><strong>{activeAgencies}</strong><p>Active agencies</p><small>{verifiedAgencies} independently verified</small></article>
        <article><span>DISCOVERY</span><strong>{views}</strong><p>Profile views</p><small>{unique("profile_view")} unique sessions</small></article>
        <article><span>DEMAND</span><strong>{submitted}</strong><p>Total inquiries</p><small>{qualified} qualified</small></article>
        <article><span>QUALITY</span><strong>{accepted}</strong><p>Accepted leads</p><small>{percent(accepted, submitted)}% inquiry acceptance</small></article>
      </section>

      <div className="analytics-grid">
        <section className="analytics-panel"><div className="analytics-heading"><div><p>CONVERSION JOURNEY</p><h2>Marketplace funnel</h2></div><span>30 DAYS</span></div>
          <div className="funnel-list">
            {[{ label: "Directory appearances", value: impressions, rate: 100 }, { label: "Profile views", value: views, rate: percent(views, impressions) }, { label: "Contact intent", value: contactOpens, rate: percent(contactOpens, views) }, { label: "Inquiries submitted", value: submitted, rate: percent(submitted, contactOpens) }, { label: "Qualified inquiries", value: qualified, rate: percent(qualified, submitted) }].map((item, index) => <div className="funnel-row" key={item.label}><span>0{index + 1}</span><div><b>{item.label}</b><i><em style={{ width: `${Math.min(item.rate, 100)}%` }} /></i></div><strong>{item.value}</strong><small>{index ? `${item.rate}%` : "BASE"}</small></div>)}
          </div>
        </section>
        <aside className="analytics-panel analytics-paid"><div className="analytics-heading"><div><p>PAID VISIBILITY</p><h2>Sponsored performance</h2></div><Link href="/owners/dashboard/placements">MANAGE →</Link></div><div className="paid-metrics"><div><span>Active placements</span><strong>{activePlacements}</strong></div><div><span>Sponsored profile views</span><strong>{sponsoredViews}</strong></div><div><span>Sponsored inquiries</span><strong>{sponsoredInquiries}</strong></div><div><span>View → inquiry</span><strong>{percent(sponsoredInquiries, sponsoredViews)}%</strong></div></div><p className="analytics-separation"><b>Commercial separation:</b> These results measure labelled visibility only. They do not affect verification, reviews, trust decisions, or objective directory sorting.</p></aside>
      </div>

      <div className="analytics-grid lower">
        <section className="analytics-panel"><div className="analytics-heading"><div><p>ACQUISITION</p><h2>Traffic sources</h2></div></div><div className="source-table"><div className="source-row head"><span>SOURCE</span><span>VIEWS</span><span>INQUIRIES</span><span>CONVERSION</span></div>{sources.map((item) => <div className="source-row" key={item.source}><span><b>{item.source}</b></span><span>{item.views}</span><span>{item.inquiries}</span><span>{percent(item.inquiries, item.views)}%</span></div>)}</div></section>
        <section className="analytics-panel"><div className="analytics-heading"><div><p>PROFILE ACTIVITY</p><h2>Most viewed agencies</h2></div></div><div className="agency-performance">{topAgencies.length ? topAgencies.map((agency, index) => <div key={agency.id}><span>{String(index + 1).padStart(2, "0")}</span><p><b>{agency.name}</b><small>{agency.inquiries} inquiries</small></p><strong>{agency.views} views</strong></div>) : <p className="analytics-empty">Not enough marketplace activity yet. Metrics will populate as visitors use the public directory.</p>}</div></section>
      </div>

      <section className="analytics-definition"><h2>Metric definitions</h2><div><p><b>Views vs visitors</b><span>Views count recorded profile loads; unique sessions deduplicate repeat activity.</span></p><p><b>Inquiry vs qualified lead</b><span>An inquiry is a submitted contact request. Qualification requires a separate review.</span></p><p><b>Acceptance</b><span>Accepted and closed inquiries count as agency-accepted leads, not guaranteed sales.</span></p><p><b>Privacy</b><span>Analytics stores pseudonymous sessions and event metadata—not private inquiry text.</span></p></div></section>
    </main>
  </OwnerOperationsShell>;
}
