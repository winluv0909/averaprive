# Full changed code and supporting research
See CLAIM-LAYOUT-FIX.md for this styling update. Existing fields and claim actions are preserved.

## .env.example

```text
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY

# Optional public links. Leave blank until official accounts are active.
NEXT_PUBLIC_TRUSTPILOT_PROFILE_URL=
NEXT_PUBLIC_SUPPORT_EMAIL=support@example.com
# Keep true for local demonstrations. Set false before production launch.
NEXT_PUBLIC_SHOW_DEMO_AGENCIES=false

# Server-only. Never expose this value in browser code or commit it.
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# Required only when Stripe checkout/webhooks are connected.
STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=YOUR_STRIPE_WEBHOOK_SECRET

```

## CHANGED-FILES.txt

```text
.env.example
CHANGED-FILES.txt
CLAIM-LAYOUT-FIX.md
DIRECTORY-CLAIMS-SETUP.md
FULL-CHANGED-CODE.md
app/admin/page.tsx
app/agency/claim/AgencyInformationSummary.tsx
app/agency/claim/[slug]/actions.ts
app/agency/claim/[slug]/page.tsx
app/agency/claim/claim.css
app/agency/claim/layout.tsx
app/api/public-agencies/route.ts
app/auth/callback/route.ts
app/login/actions.ts
app/owners/dashboard/directory/CorrectProfileForm.tsx
app/owners/dashboard/directory/actions.ts
app/owners/dashboard/directory/directory.css
app/owners/dashboard/directory/page.tsx
lib/agencies/claim-profile.ts
package-lock.json
package.json
proxy.ts
public/agency-profile.html
public/js/agency-profile.js
research/README.md
research/add-50-agencies.sql
research/agencies.json
research/agency-list.md
research/enrich-researched-profiles.sql
research/researched-profiles.json
research/source-audit.md
supabase/migrations/202610100018_curated_directory_claims.sql
supabase/migrations/202610100019_claim_profile_review.sql
tests/agency-claims.test.ts
tests/claim-profile-review.test.ts

```

## CLAIM-LAYOUT-FIX.md

```text
# Shared agency claim layout fix

Applies to every /agency/claim/[slug] page. The claim layout now loads its own scoped stylesheet instead of the split-screen login stylesheet.

To apply this update, copy these two files from the extracted ZIP into the same paths in your existing project:
- app/agency/claim/layout.tsx
- app/agency/claim/claim.css

Keep all other project files and your .env.local. No SQL migration, agency reimport or npm install is needed for this styling fix.
Stop the development server with Ctrl+C, run npm run dev again, then refresh the claim page with Ctrl+Shift+R.

Changes: readable headings; centered content with normal page scrolling; two-column information list on desktop and one column on mobile; full-width, resizable textareas; normal-size checkboxes aligned with their labels; consistent input and button spacing. Every existing field and claim action is preserved.

Validation: TypeScript, changed-file ESLint and production build passed. Browser visual verification was unavailable because the Chromium download failed in this environment. After applying, check both signed-out authentication and signed-in claim forms on desktop and mobile, including a long agency name and the submit button at the bottom.

```

## DIRECTORY-CLAIMS-SETUP.md

```text
# Curated agencies and ownership claims

## Apply the update
1. Back up Supabase. Apply migration 202610100018_curated_directory_claims.sql only if it has not already been applied. It removes explicitly marked demo rows; do not rerun the earlier demo-seeding migrations.
2. Apply supabase/migrations/202610100019_claim_profile_review.sql. This update adds researched profile information and the reviewed claim workflow. It does not delete agency records.
3. Replace the app code and restart. Open /owners/dashboard/directory as the super-admin.
4. Read research/source-audit.md and review the official sources before importing. There are 50 candidates, with TOAgency held for direct confirmation. All candidates have missing information; none is independently certified by this research.
5. Optionally run research/add-50-agencies.sql to publish the 49 reviewed candidates as unclaimed listings. It skips existing names, slugs and website matches. Review before executing: this step publishes records.
6. Run research/enrich-researched-profiles.sql to fill empty researched metadata and blank location/services on exact matching unowned records. Existing reviewed metadata and active-owned profiles are preserved. Re-running is idempotent.

No live database has been changed. The ZIP is an update for you to apply, not evidence that the live site is updated.

## Claim a profile
The representative opens a listing, clicks Claim this profile, signs in or creates an account, and reviews the profile details. They provide full name, role, business contact, evidence and requested corrections, and confirm review and authority. Submitting creates a private pending claim; it grants no membership.

The owner verifies business identity, representative authority, official contact and the latest information. Independently use a public company registry or suitable documentation and an official channel you find yourself; a Google login or an email typed by the claimant is not company ownership proof. Domain email challenges and website tokens are manual verification steps; this update does not automatically send challenges or verify documents.

Review the claimant's saved profile and compare it with the current listing. Use Correct this agency's information to save supported changes with a source and explanation. Resolve material missing information and conflicts before checking all four approval boxes. The database blocks approval without all checks and blocks stale forms if the profile changes. Declining does not require those approval checks.

Approval grants ownership of the existing listing, not a verification badge. It preserves the profile instead of creating a duplicate. Existing pending claims submitted before migration 019 lack the new fields: decline with an explanation and ask the representative to resubmit through the updated form.

## Accuracy and missing information
Public agency pages are statements, not registry certification. Information can change. Missing legal details, social accounts, fees, team sizes, minimum requirements and other facts are marked Not yet confirmed. Never invent them. Keep registered addresses separate from headquarters and markets served. Some published emails are application, legal or privacy contacts and are labelled accordingly.

## Validation
TypeScript and lint on changed TypeScript files passed. Database tests cover legacy bypass, reviewer checks, stale snapshots, correction permissions, ownership approval, held listings, idempotent import and preservation of owned information. Google/email authentication and the live Supabase deployment still require testing after migration. Previously known full-suite slug and billing-lint failures are unrelated to these changes.

```

## app/admin/page.tsx

```tsx
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
    <div className="admin-shell">
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

          <Link href="/agency/dashboard">
            <span>↗</span>
            Agency workspace
          </Link>

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
            <p>PRIVATE PLATFORM CONTROL</p>
          </div>

          <div className="admin-top-actions">
            <Link href="/" target="_blank">
              PUBLIC SITE ↗
            </Link>

            <form action={signOutAdmin}>
              <button>LOG OUT</button>
            </form>
          </div>
        </header>

        <main className="admin-main">
        <Link href="/owners/dashboard/directory">Manage legitimate agencies and ownership claims</Link>
          <section className="admin-welcome">
            <div>
              <p className="admin-kicker">
                OWNER OVERVIEW
              </p>

              <h1>Platform operations.</h1>

              <p>
                Monitor trust decisions, agency submissions,
                account activity, and support operations from
                one secure command center.
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
              <span>01</span>
              <p>Total agencies</p>
              <strong>{counts.agencies}</strong>
              <small>All registered profiles</small>
            </article>

            <article>
              <span>02</span>
              <p>Registered accounts</p>
              <strong>{counts.users}</strong>
              <small>Owners, teams, and staff</small>
            </article>

            <article
              className={urgentTotal ? "attention" : ""}
            >
              <span>03</span>
              <p>Actions waiting</p>
              <strong>{urgentTotal}</strong>
              <small>Across operational queues</small>
            </article>

            <article>
              <span>04</span>
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

                <span>{urgentTotal} ACTIONS</span>
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

                  <strong>{counts.moderation}</strong>
                  <span>→</span>
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

                  <strong>{counts.verification}</strong>
                  <span>→</span>
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

                  <strong>{counts.reviews}</strong>
                  <span>→</span>
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
                    {counts.reports + counts.disputes}
                  </strong>

                  <span>→</span>
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

                  <strong>{counts.fraud}</strong>
                  <span>→</span>
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

                  <strong>{counts.support}</strong>
                  <span>→</span>
                </Link>
              </div>
            </section>

            <aside className="admin-section admin-principles">
              <p>OPERATING PRINCIPLES</p>

              <h2>Trust before visibility.</h2>

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
```

## app/agency/claim/AgencyInformationSummary.tsx

```tsx
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function display(value: unknown): string {
  if (Array.isArray(value)) return value.map(display).filter(Boolean).join(", ") || "Not yet confirmed";
  return typeof value === "string" && value.trim() ? value : typeof value === "number" ? String(value) : "Not yet confirmed";
}
function safeSource(value: unknown): value is string {
  try { return typeof value === "string" && new URL(value).protocol === "https:"; } catch { return false; }
}
export default function AgencyInformationSummary({ profile }: { profile: Record<string, unknown> }) {
  const details = record(profile.directory_information);
  const fields: [string, unknown][] = [
    ["Agency name", profile.name], ["Official website", profile.website_url], ["About", profile.about],
    ["Tagline", profile.tagline], ["Positioning", profile.positioning_statement], ["Category", profile.category],
    ["Location", [profile.city, profile.country].filter(Boolean)], ["Services", profile.services],
    ["Legal entity", details.legal_name], ["Company registration", details.registration_number],
    ["Registered address", details.registered_address], ["Public contact email", details.public_email],
    ["Public phone", details.public_phone], ["Year established", profile.founded_year ?? details.founded_year],
    ["Team size", profile.employee_count_range ?? details.team_size], ["Languages", Array.isArray(profile.languages) && profile.languages.length ? profile.languages : details.languages], ["Markets served", Array.isArray(profile.regions_served) && profile.regions_served.length ? profile.regions_served : details.markets_served],
    ["Creator niches", profile.creator_niches], ["Ideal client", profile.ideal_client], ["Minimum requirements", profile.minimum_requirements],
    ["Social profiles", Object.entries(record(profile.social_links)).map(([label, target]) => `${label}: ${display(target)}`)],
    ["Contact purpose", details.email_purpose], ["Other official contact", details.contact_channel],
    ["Operating locations", details.operating_locations], ["Research notes", details.note], ["Last researched", details.checked_on],
  ];
  const sources = [...new Set([...(Array.isArray(details.sources) ? details.sources : []), details.owner_reviewed_source].filter(safeSource))];
  return <>
    <dl>{fields.map(([label,value]) => <div key={label}><dt>{label}</dt><dd style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{display(value)}</dd></div>)}</dl>
    <p>Information from public sources; ownership and business credentials require separate review.</p>
    {!!sources.length && <ul>{sources.map((source) => <li key={source}><a href={source} target="_blank" rel="noopener noreferrer">Official source: {new URL(source).hostname}</a></li>)}</ul>}
  </>;
}

```

## app/agency/claim/[slug]/actions.ts

```ts
"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/authorization";
import { readProfileSnapshot } from "@/lib/agencies/claim-profile";

export async function requestClaim(slug: string, form: FormData) {
  const { supabase } = await requireUser();
  const { data: agency } = await supabase
    .from("ap_public_agencies")
    .select("id,demo_profile")
    .eq("slug", slug)
    .maybeSingle();
  if (!agency || agency.demo_profile) redirect("/agencies.html");
  const { error } = await supabase.rpc("ap_request_agency_claim_reviewed", {
    target_agency: agency.id,
    ownership_evidence: String(form.get("evidence") ?? ""),
    full_name: String(form.get("representative_name") ?? ""),
    job_role: String(form.get("representative_role") ?? ""),
    company_contact: String(form.get("business_contact") ?? ""),
    information_confirmed: form.get("profile_confirmed") === "on" && form.get("authorized") === "on",
    corrections: String(form.get("corrections") ?? ""),
    expected_profile: readProfileSnapshot(form.get("profile_snapshot")),
  });
  redirect(
    `/agency/claim/${slug}?${error ? `error=${encodeURIComponent(error.message)}` : "submitted=1"}`,
  );
}
export async function createClaimAccount(slug: string, form: FormData) {
  if (!/^[a-z0-9-]+$/.test(slug)) redirect("/agencies.html");
  const supabase = await createClient();
  const callback = new URL(
    "/auth/callback",
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  );
  callback.searchParams.set("next", `/agency/claim/${slug}`);
  const { data, error } = await supabase.auth.signUp({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
    options: { emailRedirectTo: callback.toString() },
  });
  if (error)
    redirect(
      `/agency/claim/${slug}?error=${encodeURIComponent(error.message)}`,
    );
  redirect(
    `/agency/claim/${slug}?${data.session ? "connected=1" : "confirm=1"}`,
  );
}

```

## app/agency/claim/[slug]/page.tsx

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signIn, signInWithSocial } from "@/app/login/actions";
import { requestClaim, createClaimAccount } from "./actions";
import { claimProfileColumns, claimProfileSnapshot } from "@/lib/agencies/claim-profile";
import AgencyInformationSummary from "../AgencyInformationSummary";
export const metadata = {
  title: "Claim your agency profile",
  robots: { index: false, follow: false },
};
export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: agency } = await supabase
    .from("ap_public_agencies")
    .select(claimProfileColumns)
    .eq("slug", slug)
    .maybeSingle();
  if (!agency || "error" in agency || agency.demo_profile) notFound();
  const snapshot = claimProfileSnapshot(agency);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: claims, error: claimError } = user
    ? await supabase
        .from("ap_agency_claims")
        .select("status,reviewer_note")
        .eq("agency_id", agency.id)
        .eq("claimant_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
    : { data: null, error: null };
  const claim = claims?.[0];
  const next = `/agency/claim/${slug}`;
  return (
    <main className="access-main">
      <div className="access-form-wrap">
        <Link href={`/agency-profile.html?id=${slug}`}>
          ← Back to agency information
        </Link>
        <div className="access-heading">
          <p>PROFILE OWNERSHIP</p>
          <h1>Claim {agency.name}</h1>
          <span>
            Claims are reviewed before profile management access is granted.
            Claim approval does not grant a verification badge.
          </span>
        </div>
        {query.error && <p role="alert">{query.error}</p>}
        <section aria-labelledby="profile-review-heading">
          <h2 id="profile-review-heading">Review this agency&apos;s information</h2>
          <p>Check every detail below. Tell us what is missing or incorrect in your claim. A public listing is not proof of ownership or independent verification.</p>
          <AgencyInformationSummary profile={snapshot} />
        </section>
        {claimError && (
          <p role="alert">
            Claim status is unavailable. Please try again later.
          </p>
        )}
        {query.confirm && (
          <p role="status">
            Check your email and follow the confirmation link to return to this
            claim. If you already have an account, sign in below.
          </p>
        )}
        {!user ? (
          <>
            <form className="access-form" action={signIn}>
              <h2>Sign in to claim</h2>
              <input type="hidden" name="next" value={next} />
              <input type="hidden" name="loginPath" value="/agency/login" />
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </label>
              <button type="submit" className="button button-black">
                Sign in and continue
              </button>
            </form>
            <form action={signInWithSocial.bind(null, "google", "login", next)}>
              <button className="button button-outline" type="submit">
                Continue with Google
              </button>
            </form>
            <form
              className="access-form"
              action={createClaimAccount.bind(null, slug)}
            >
              <h2>Create an account</h2>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </label>
              <button className="button button-black" type="submit">
                Create account to claim
              </button>
            </form>
          </>
        ) : claim?.status === "approved" ? (
          <>
            <p>Your claim is approved.</p>
            <Link href={`/agency/dashboard/agencies/${agency.id}`}>
              Manage this profile
            </Link>
          </>
        ) : claim?.status === "pending" ? (
          <p role="status">
            Your ownership claim is pending review. You will receive management
            access after approval.
          </p>
        ) : (
          <>
            {claim?.status === "rejected" && (
              <p>Previous claim declined: {claim.reviewer_note}</p>
            )}
            {!claimError && (
              <form
                className="access-form"
                action={requestClaim.bind(null, slug)}
              >
                <p>Signed in as {user.email}</p>
                <input type="hidden" name="profile_snapshot" value={JSON.stringify(snapshot)} />
                <label>Full name<input name="representative_name" required minLength={2} maxLength={160} autoComplete="name" /></label>
                <label>Your role at the agency<input name="representative_role" required minLength={2} maxLength={160} placeholder="Owner, director, or authorized representative" /></label>
                <label>Business contact email<input name="business_contact" type="email" required maxLength={254} /></label>
                <p>We must verify your authority through an independently confirmed agency contact or business record. Entering an email does not verify that you control it.</p>
                <label>Missing information or corrections<textarea name="corrections" maxLength={5000} placeholder="List missing or incorrect details, the correct information, and official source links. Leave blank only if everything shown is accurate." /></label>
                <label><input name="profile_confirmed" type="checkbox" required /> I reviewed this profile and listed every correction or missing detail I know about.</label>
                <label>
                  Ownership evidence
                  <textarea
                    name="evidence"
                    minLength={40}
                    maxLength={5000}
                    required
                    placeholder="Explain your role and provide an official company email, website evidence, or links to business records that establish your authority."
                  />
                </label>
                <label>
                  <input name="authorized" type="checkbox" required /> I am authorized to
                  represent this agency.
                </label>
                <button className="button button-black" type="submit">
                  Submit ownership claim
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}

```

## app/agency/claim/claim.css

```css
.claim-page {
  min-height: 100vh;
  background: #f5f2eb;
  color: #181916;
  font-family: Arial, sans-serif;
  line-height: 1.6;
}
.claim-page *, .claim-page *::before, .claim-page *::after { box-sizing: border-box; }
.claim-page .access-main {
  display: block;
  width: 100%;
  height: auto;
  padding: 48px 24px 80px;
  overflow: visible;
}
.claim-page .access-form-wrap { width: 100%; max-width: 960px; margin: 0 auto; }
.claim-page a { color: #725d37; text-underline-offset: 4px; overflow-wrap: anywhere; }
.claim-page .access-form-wrap > a { display: inline-block; margin-bottom: 28px; }
.claim-page .access-heading { margin-bottom: 32px; }
.claim-page .access-heading > p {
  margin: 0 0 12px; color: #806539; font-size: 12px; font-weight: 700; letter-spacing: .16em;
}
.claim-page .access-heading h1 {
  margin: 0; font: 500 clamp(30px, 4vw, 48px)/1.15 Georgia, serif;
  letter-spacing: -.02em; overflow-wrap: anywhere;
}
.claim-page .access-heading > span { display: block; max-width: 740px; margin-top: 18px; color: #646058; }
.claim-page h2 { margin: 0 0 16px; font: 500 clamp(22px, 3vw, 28px)/1.25 Georgia, serif; }
.claim-page p { margin: 0 0 18px; overflow-wrap: anywhere; }
.claim-page section {
  padding: 28px; margin-bottom: 28px; border: 1px solid #d9d3c8; background: #fff;
}
.claim-page section dl {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 24px; margin: 24px 0;
}
.claim-page section dl > div { min-width: 0; padding: 16px 0; border-top: 1px solid #e7e1d7; }
.claim-page section dt { color: #725d37; font-size: 13px; font-weight: 700; }
.claim-page section dd { margin: 6px 0 0; font-size: 15px; line-height: 1.55; }
.claim-page section ul { margin: 0; padding-left: 20px; }
.claim-page form {
  padding: 28px; margin: 24px 0; border: 1px solid #d9d3c8; background: #fff;
}
.claim-page .access-form label {
  display: block; margin: 22px 0; font-size: 15px; font-weight: 600;
}
.claim-page .access-form input:not([type="checkbox"]):not([type="hidden"]),
.claim-page .access-form textarea {
  display: block; width: 100%; max-width: 100%; margin-top: 8px; padding: 12px 14px;
  border: 1px solid #bdb5a9; border-radius: 3px; background: #fff; color: #181916;
  font: 400 16px/1.5 Arial, sans-serif;
}
.claim-page .access-form input:not([type="checkbox"]):not([type="hidden"]) { min-height: 48px; }
.claim-page .access-form textarea { min-height: 144px; resize: vertical; }
.claim-page .access-form label:has(input[type="checkbox"]) {
  display: grid; grid-template-columns: 18px minmax(0, 1fr); align-items: start; gap: 12px;
  font-weight: 400; line-height: 1.5;
}
.claim-page .access-form input[type="checkbox"] {
  display: block; width: 18px; height: 18px; min-height: 0; margin: 3px 0 0;
  padding: 0; accent-color: #181916;
}
.claim-page button {
  display: inline-flex; align-items: center; justify-content: center;
  max-width: 100%; min-height: 48px; padding: 12px 22px;
  border: 1px solid #181916; border-radius: 3px; background: #181916; color: #fff;
  font: 600 15px/1.4 Arial, sans-serif; white-space: normal; cursor: pointer;
}
.claim-page button.button-outline { background: #fff; color: #181916; }
.claim-page button:hover { background: #38352e; color: #fff; }
.claim-page :is(input, textarea, button, a):focus-visible { outline: 2px solid #806539; outline-offset: 3px; }
.claim-page [role="alert"], .claim-page [role="status"] {
  padding: 16px 20px; border-left: 3px solid #806539; background: #fff;
}
.claim-page [role="alert"] { border-color: #a52d2d; }
@media (max-width: 640px) {
  .claim-page .access-main { padding: 28px 16px 48px; }
  .claim-page section, .claim-page form { padding: 20px; }
  .claim-page section dl { grid-template-columns: minmax(0, 1fr); }
  .claim-page button { width: 100%; }
}

```

## app/agency/claim/layout.tsx

```tsx
import "./claim.css";
export default function ClaimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="claim-page">{children}</div>;
}

```

## app/api/public-agencies/route.ts

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PublicAgency = Record<string, unknown>;

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function mapAgency(row: PublicAgency, sponsoredAgencyIds: Set<string>) {
  const city = typeof row.city === "string" ? row.city : "";
  const country = typeof row.country === "string" ? row.country : "";

  return {
    ...row,
    agencyId: row.id,
    id: row.slug ?? row.id,
    status: "approved",
    published: true,
    positioning: row.positioning_statement ?? row.positioning,
    description: row.about ?? row.positioning_statement ?? "",
    website: row.website_url,
    socials: row.social_links ?? {},
    directoryInformation: row.directory_information ?? {},
    logoUrl: row.logo_url,
    coverImageUrl: row.cover_image_url,
    location: [city, country].filter(Boolean).join(", ") || country,
    services: list(row.services),
    niches: list(row.creator_niches ?? row.niches),
    countriesServed: list(row.regions_served ?? row.countries_served),
    verified: row.verification_status === "verified" || row.verified === true,
    sponsored: row.demo_profile === true ? false : sponsoredAgencyIds.has(String(row.id)),
    demoProfile: row.demo_profile === true,
    demoReputationScore: row.demo_reputation_score,
    demoReviewCount: row.demo_review_count,
    reviewCount: row.review_count,
    rating: row.average_rating,
    yearsInBusiness: typeof row.founded_year === "number" ? new Date().getUTCFullYear() - row.founded_year : null,
    size: row.employee_count_range,
    acceptingInquiries: row.demo_profile === true ? false : row.accepting_inquiries === true,
    trustpilotProfileUrl: null,
    externalRating: row.external_rating,
    externalReviewCount: row.external_review_count,
    externalRatingStatus: row.external_rating_status ?? "no_profile",
    externalRatingIsDemo: row.external_rating_is_demo === true,
    trustpilotStatus: row.demo_profile === true ? "simulated_demo_data" : "not_connected",
  };
}

export async function GET() {
  const supabase = await createClient();
  const [{ data, error }, { data: placements }] = await Promise.all([
    supabase.from("ap_public_agencies").select("*"),
    supabase.from("ap_sponsored_placements").select("agency_id").eq("status", "active").lte("starts_at", new Date().toISOString()).gt("ends_at", new Date().toISOString()),
  ]);

  if (error) {
    return NextResponse.json(
      { error: "The public agency directory is temporarily unavailable." },
      { status: 503 },
    );
  }

  const sponsoredAgencyIds = new Set((placements ?? []).map((item) => String(item.agency_id)));
  const visibleRows = (data ?? []).filter((row) => row.demo_profile !== true);
  return NextResponse.json(visibleRows.map((row) => mapAgency(row as PublicAgency, sponsoredAgencyIds)), {
    headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}

```

## app/auth/callback/route.ts

```ts
import {
  NextResponse,
  type NextRequest,
} from "next/server";

import type {
  EmailOtpType,
  User,
} from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

import { provisionOnboardingAgency } from "@/lib/agencies/provision-onboarding";

export async function GET(request: NextRequest) {
  const code =
    request.nextUrl.searchParams.get("code");

  const tokenHash =
    request.nextUrl.searchParams.get("token_hash");

  const type = request.nextUrl.searchParams.get(
    "type",
  ) as EmailOtpType | null;

  const providerError =
    request.nextUrl.searchParams.get(
      "error_description",
    );

  const requestedNext =
    request.nextUrl.searchParams.get("next") ||
    "/agency/dashboard";

  const safeNext =
    (requestedNext === "/agency/register?oauth=1" || /^\/agency\/claim\/[a-z0-9-]+$/.test(requestedNext))
      ? requestedNext
      : "/agency/dashboard";

  const supabase = await createClient();

  let user: User | null = null;
  let authenticationError: string | null =
    providerError;

  if (code) {
    const { data, error } =
      await supabase.auth.exchangeCodeForSession(
        code,
      );

    user = data.user;
    authenticationError = error?.message ?? null;
  } else if (tokenHash && type) {
    const { data, error } =
      await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

    user = data.user;
    authenticationError = error?.message ?? null;
  }

  if (user) {
    if (safeNext.startsWith("/agency/register") || safeNext.startsWith("/agency/claim/")) {
      return NextResponse.redirect(
        new URL(safeNext, request.url),
      );
    }

    try {
      const agencyId =
        await provisionOnboardingAgency(
          supabase,
          user,
        );

      return NextResponse.redirect(
        new URL(
          agencyId
            ? `/agency/dashboard/agencies/${agencyId}?submitted=1`
            : "/agency/dashboard",
          request.url,
        ),
      );
    } catch (provisionError) {
      const message =
        provisionError instanceof Error
          ? provisionError.message
          : "Your agency profile could not be prepared.";

      return NextResponse.redirect(
        new URL(
          `/agency/login?error=${encodeURIComponent(
            message,
          )}`,
          request.url,
        ),
      );
    }
  }

  const message =
    authenticationError ||
    "The confirmation link is invalid, incomplete, or expired. Request a new confirmation email and try again.";

  const errorPath = safeNext.startsWith(
    "/agency/register",
  )
    ? "/agency/register"
    : "/agency/login";

  return NextResponse.redirect(
    new URL(
      `${errorPath}?error=${encodeURIComponent(
        message,
      )}`,
      request.url,
    ),
  );
}
```

## app/login/actions.ts

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { provisionOnboardingAgency } from "@/lib/agencies/provision-onboarding";
import { getAgencyPortalAccessError } from "@/lib/auth/authorization";
import type { SupabaseClient } from "@supabase/supabase-js";

type SocialProvider = "google" | "apple";

async function rejectPlatformAccountFromAgencyPortal(
  supabase: SupabaseClient,
  userId: string,
  path: "/agency/login" | "/agency/register",
) {
  const accessError = await getAgencyPortalAccessError(supabase, userId);

  if (accessError) {
    await supabase.auth.signOut();
    redirect(`${path}?error=${encodeURIComponent(accessError)}`);
  }
}

function agencySiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export async function signInWithSocial(
  provider: SocialProvider,
  intent: "login" | "register",
  returnTo?: string | FormData,
) {
  const supabase = await createClient();

  const { data: { user: currentUser } } = await supabase.auth.getUser();

  if (currentUser) {
    await rejectPlatformAccountFromAgencyPortal(
      supabase,
      currentUser.id,
      intent === "register" ? "/agency/register" : "/agency/login",
    );
  }

  const next =
    typeof returnTo === "string" && /^\/agency\/claim\/[a-z0-9-]+$/.test(returnTo)
      ? returnTo
      : intent === "register"
      ? "/agency/register?oauth=1"
      : "/agency/dashboard";

  const callback = new URL("/auth/callback", agencySiteUrl());
  callback.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callback.toString(),
    },
  });

  if (error || !data.url) {
    const path =
      intent === "register" ? "/agency/register" : "/agency/login";

    redirect(
      `${path}?error=${encodeURIComponent(
        error?.message ||
          `${provider === "google" ? "Google" : "Apple"} sign-in could not be started.`,
      )}`,
    );
  }

  redirect(data.url);
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/agency/dashboard");
  const loginPath = String(formData.get("loginPath") ?? "/agency/login");

  const safeLoginPath =
    loginPath === "/owners/login" ? "/owners/login" : "/agency/login";

  const portalPrefix =
    safeLoginPath === "/owners/login" ? "/owners/" : "/agency/";

  const defaultNext =
    safeLoginPath === "/owners/login"
      ? "/owners/dashboard"
      : "/agency/dashboard";

  const safeNext =
    next.startsWith(portalPrefix) && !next.startsWith("//")
      ? next
      : defaultNext;

  if (!email || !password) {
    redirect(
      `${safeLoginPath}?error=${encodeURIComponent(
        "Enter your email address and password.",
      )}`,
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      `${safeLoginPath}?error=${encodeURIComponent(
        "Invalid email or password.",
      )}`,
    );
  }

  if (safeLoginPath === "/owners/login") {
    const { data: staffRole } = await supabase
      .from("ap_staff_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!staffRole) {
      await supabase.auth.signOut();

      redirect(
        `/owners/login?error=${encodeURIComponent(
          "This account is not authorized for the private owner portal.",
        )}`,
      );
    }
  }

  if (safeLoginPath === "/agency/login") {
    await rejectPlatformAccountFromAgencyPortal(
      supabase,
      data.user.id,
      "/agency/login",
    );

    if (!safeNext.startsWith("/agency/claim/")) {
      try {
        await provisionOnboardingAgency(supabase, data.user);
      } catch (provisionError) {
        redirect(
          `/agency/login?error=${encodeURIComponent(
            provisionError instanceof Error
              ? provisionError.message
              : "Your agency profile could not be prepared.",
          )}`,
        );
      }
    }
  }

  redirect(safeNext);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const agencyName = String(formData.get("agencyName") ?? "").trim();

  const requestedPlan = String(formData.get("plan") ?? "free").toLowerCase();

  const plan = ["free", "prive", "select", "elite"].includes(requestedPlan)
    ? requestedPlan
    : "free";

  const list = (key: string) =>
    String(formData.get(key) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

  const services = [...list("services"), ...list("otherServices")];
  const creatorNiches = list("creatorNiches");
  const about = String(formData.get("about") ?? "").trim();
  const positioning = String(formData.get("positioning") ?? "").trim();

  const verificationNotes = String(
    formData.get("verificationNotes") ?? "",
  ).trim();

  const legalCompanyName = String(
    formData.get("legalCompanyName") ?? "",
  ).trim();

  const registrationNumber = String(
    formData.get("registrationNumber") ?? "",
  ).trim();

  if (
    !email ||
    password.length < 8 ||
    firstName.length < 1 ||
    lastName.length < 1 ||
    agencyName.length < 2 ||
    services.length < 1 ||
    about.length < 80 ||
    positioning.length < 20 ||
    !legalCompanyName ||
    !registrationNumber ||
    verificationNotes.length < 20
  ) {
    redirect(
      `/agency/register?error=${encodeURIComponent(
        "Complete every required field and use a password with at least 8 characters.",
      )}`,
    );
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: {
        display_name: [firstName, lastName].filter(Boolean).join(" "),
        agency_name: agencyName,
        requested_plan: plan,
        onboarding_profile: {
          agencyName,
          country: String(formData.get("country") ?? "").trim(),
          city: String(formData.get("city") ?? "").trim(),
          websiteUrl: String(formData.get("websiteUrl") ?? "").trim(),
          logoUrl: String(formData.get("logoUrl") ?? "").trim(),
          services,
          creatorNiches,
          regionsServed: list("regionsServed"),
          agencySize: String(formData.get("agencySize") ?? "").trim(),
          foundedYear: Number(formData.get("foundedYear")) || null,
          languages: list("languages"),
          positioning,
          about,
          instagram: String(formData.get("instagram") ?? "").trim(),
          linkedin: String(formData.get("linkedin") ?? "").trim(),
          verification: {
            legalCompanyName,
            registrationNumber,
            registrationCountry: String(
              formData.get("registrationCountry") ?? "",
            ).trim(),
            representative: String(
              formData.get("representative") ?? "",
            ).trim(),
            representativeTitle: String(
              formData.get("representativeTitle") ?? "",
            ).trim(),
            businessEmail: String(
              formData.get("businessEmail") ?? "",
            ).trim(),
            notes: verificationNotes,
          },
        },
      },
    },
  });

  if (error) {
    redirect(
      `/agency/register?error=${encodeURIComponent(error.message)}`,
    );
  }

  if (data.session && data.user) {
    await rejectPlatformAccountFromAgencyPortal(
      supabase,
      data.user.id,
      "/agency/register",
    );

    let agencyId: string | null = null;

    try {
      agencyId = await provisionOnboardingAgency(supabase, data.user);
    } catch (provisionError) {
      redirect(
        `/agency/login?error=${encodeURIComponent(
          provisionError instanceof Error
            ? provisionError.message
            : "Your agency profile could not be prepared.",
        )}`,
      );
    }

    redirect(
      agencyId
        ? `/agency/dashboard/agencies/${agencyId}?submitted=1`
        : "/agency/dashboard",
    );
  }

   redirect(
    `/agency/register?error=${encodeURIComponent(
      "Almost done. Check your inbox and click the confirmation link to activate your account and submit your agency.",
    )}`,
  );
}

export async function completeSocialSignUp(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/agency/register?error=${encodeURIComponent(
        "Your Google or Apple session expired. Please continue with your account again.",
      )}`,
    );
  }

  await rejectPlatformAccountFromAgencyPortal(
    supabase,
    user.id,
    "/agency/register",
  );

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const agencyName = String(formData.get("agencyName") ?? "").trim();

  const requestedPlan = String(formData.get("plan") ?? "free").toLowerCase();

  const plan = ["free", "prive", "select", "elite"].includes(requestedPlan)
    ? requestedPlan
    : "free";

  const list = (key: string) =>
    String(formData.get(key) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

  const services = [...list("services"), ...list("otherServices")];
  const creatorNiches = list("creatorNiches");
  const about = String(formData.get("about") ?? "").trim();
  const positioning = String(formData.get("positioning") ?? "").trim();

  const verificationNotes = String(
    formData.get("verificationNotes") ?? "",
  ).trim();

  const legalCompanyName = String(
    formData.get("legalCompanyName") ?? "",
  ).trim();

  const registrationNumber = String(
    formData.get("registrationNumber") ?? "",
  ).trim();

  if (
    firstName.length < 1 ||
    lastName.length < 1 ||
    agencyName.length < 2 ||
    services.length < 1 ||
    about.length < 80 ||
    positioning.length < 20 ||
    !legalCompanyName ||
    !registrationNumber ||
    verificationNotes.length < 20
  ) {
    redirect(
      `/agency/register?oauth=1&error=${encodeURIComponent(
        "Complete every required agency and verification field before submitting.",
      )}`,
    );
  }

  const onboardingProfile = {
    agencyName,
    country: String(formData.get("country") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    websiteUrl: String(formData.get("websiteUrl") ?? "").trim(),
    logoUrl: String(formData.get("logoUrl") ?? "").trim(),
    services,
    creatorNiches,
    regionsServed: list("regionsServed"),
    agencySize: String(formData.get("agencySize") ?? "").trim(),
    foundedYear: Number(formData.get("foundedYear")) || null,
    languages: list("languages"),
    positioning,
    about,
    instagram: String(formData.get("instagram") ?? "").trim(),
    linkedin: String(formData.get("linkedin") ?? "").trim(),
    verification: {
      legalCompanyName,
      registrationNumber,
      registrationCountry: String(
        formData.get("registrationCountry") ?? "",
      ).trim(),
      representative: String(
        formData.get("representative") ?? "",
      ).trim(),
      representativeTitle: String(
        formData.get("representativeTitle") ?? "",
      ).trim(),
      businessEmail: String(
        formData.get("businessEmail") ?? "",
      ).trim(),
      notes: verificationNotes,
    },
  };

  const { data, error } = await supabase.auth.updateUser({
    data: {
      display_name: [firstName, lastName].filter(Boolean).join(" "),
      agency_name: agencyName,
      requested_plan: plan,
      onboarding_profile: onboardingProfile,
    },
  });

  if (error || !data.user) {
    redirect(
      `/agency/register?oauth=1&error=${encodeURIComponent(
        error?.message || "The social account profile could not be saved.",
      )}`,
    );
  }

  let agencyId: string | null = null;

  try {
    agencyId = await provisionOnboardingAgency(
      supabase,
      data.user,
    );
  } catch (provisionError) {
    redirect(
      `/agency/register?oauth=1&error=${encodeURIComponent(
        provisionError instanceof Error
          ? provisionError.message
          : "Your agency profile could not be prepared.",
      )}`,
    );
  }

  // Keep Next.js's redirect outside the provisioning catch block.
  redirect(
    agencyId
      ? `/agency/dashboard/agencies/${agencyId}?submitted=1`
      : "/agency/dashboard",
  );
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/agency/login");
}

export async function signOutAdmin() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/owners/login");
}
```

## app/owners/dashboard/directory/CorrectProfileForm.tsx

```tsx
import { correctProfile } from "./actions";
import { claimProfileSnapshot } from "@/lib/agencies/claim-profile";
export default function CorrectProfileForm({ agency }: { agency: Record<string, unknown> }) {
  const details = agency.directory_information && typeof agency.directory_information === "object" ? agency.directory_information as Record<string, unknown> : {};
  return <details><summary>Correct this agency&apos;s information before approval</summary>
    <form action={correctProfile.bind(null, String(agency.id))}>
      <input type="hidden" name="profile_snapshot" value={JSON.stringify(claimProfileSnapshot(agency))} />
      <label>Agency name<input name="name" defaultValue={String(agency.name ?? "")} required minLength={2} maxLength={160} /></label>
      <label>Official website<input name="website" type="url" pattern="https://.*" defaultValue={String(agency.website_url ?? "")} required /></label>
      <label>Country<input name="country" defaultValue={String(agency.country ?? "")} /></label>
      <label>City<input name="city" defaultValue={String(agency.city ?? "")} /></label>
      <label>About<textarea name="about" defaultValue={String(agency.about ?? "")} required minLength={40} /></label>
      <label>Services, one per line<textarea name="services" defaultValue={Array.isArray(agency.services) ? agency.services.join("\n") : ""} /></label>
      {[["legal_name", "Legal entity"], ["registration_number", "Company registration"], ["registered_address", "Registered address"], ["public_email", "Public contact email"], ["public_phone", "Public phone"]].map(([key, label]) => <label key={key}>{label}<input name={key} defaultValue={String(details[key] ?? "")} /></label>)}
      <label>Official source supporting corrections<input name="source" type="url" pattern="https://.*" required /></label>
      <label>What you checked<textarea name="note" minLength={10} required /></label>
      <button type="submit">Save reviewed corrections</button>
    </form>
  </details>;
}

```

## app/owners/dashboard/directory/actions.ts

```ts
"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaffRole } from "@/lib/auth/authorization";
import { createSlug } from "@/lib/agencies/slug";
import { readProfileSnapshot } from "@/lib/agencies/claim-profile";
export async function addAgency(form: FormData) {
  const { supabase } = await requireStaffRole(["super_admin"]);
  const { error } = await supabase.rpc("ap_add_curated_agency", {
    agency_name: String(form.get("name") ?? ""),
    agency_slug: createSlug(String(form.get("name") ?? "")),
    official_website: String(form.get("website") ?? ""),
    agency_country: String(form.get("country") ?? ""),
    agency_about: String(form.get("about") ?? ""),
  });
  revalidatePath("/owners/dashboard/directory");
  redirect(
    `/owners/dashboard/directory?${error ? `error=${encodeURIComponent(error.message)}` : "added=1"}`,
  );
}
export async function reviewClaim(
  id: string,
  decision: "approved" | "rejected",
  form: FormData,
) {
  const { supabase } = await requireStaffRole(["super_admin"]);
  const { error } = await supabase.rpc("ap_review_agency_claim_checked", {
    target_claim: id,
    decision,
    review_note: String(form.get("note") ?? ""),
    checks: Object.fromEntries(["identity", "authority", "contact", "information"].map((key) => [key, form.get(key) === "on"])),
    expected_profile: readProfileSnapshot(form.get("profile_snapshot")),
  });
  revalidatePath("/owners/dashboard/directory");
  redirect(
    `/owners/dashboard/directory?${error ? `error=${encodeURIComponent(error.message)}` : "reviewed=1"}`,
  );
}

export async function correctProfile(id: string, form: FormData) {
  const { supabase } = await requireStaffRole(["super_admin"]);
  const get = (name: string) => String(form.get(name) ?? "").trim();
  const { error } = await supabase.rpc("ap_correct_curated_profile", {
    target_agency: id,
    expected_profile: readProfileSnapshot(form.get("profile_snapshot")),
    changes: {
      name: get("name"), website_url: get("website"), about: get("about"), country: get("country"), city: get("city"),
      services: get("services").split("\n").map((x) => x.trim()).filter(Boolean),
      directory_information: Object.fromEntries(["legal_name", "registration_number", "registered_address", "public_email", "public_phone"].map((key) => [key, get(key) || null])),
    },
    source_url: get("source"), review_note: get("note"),
  });
  revalidatePath("/owners/dashboard/directory");
  redirect(`/owners/dashboard/directory?${error ? `error=${encodeURIComponent(error.message)}` : "corrected=1"}`);
}

```

## app/owners/dashboard/directory/directory.css

```css
.directory-operations {
  max-width: 960px;
  margin: 40px auto;
  padding: 24px;
  color: #181916;
}
.directory-operations h1,
.directory-operations h2,
.directory-operations h3 {
  font-family: Georgia, serif;
}
.directory-operations h1 {
  font-size: clamp(2rem, 4vw, 3rem);
}
.directory-operations form,
.directory-operations article {
  padding: 24px;
  margin: 24px 0;
  border: 1px solid #d7cdbd;
  background: #fff;
}
.directory-operations label {
  display: block;
  margin: 16px 0;
  font-weight: 600;
}
.directory-operations input:not([type="checkbox"]),
.directory-operations textarea {
  display: block;
  box-sizing: border-box;
  width: 100%;
  margin-top: 8px;
  padding: 12px;
  border: 1px solid #bcb4a6;
  background: #fff;
  color: #181916;
  font: inherit;
}
.directory-operations textarea {
  min-height: 120px;
}
.directory-operations button {
  padding: 12px 18px;
  margin: 8px 12px 8px 0;
  border: 1px solid #181916;
  background: #181916;
  color: #fff;
  cursor: pointer;
}
.directory-operations a {
  color: #725d37;
}
.directory-operations [role="alert"] {
  padding: 16px;
  border-left: 3px solid #b02020;
  background: #fff;
}
.directory-operations article p {
  overflow-wrap: anywhere;
}

```

## app/owners/dashboard/directory/page.tsx

```tsx
import "./directory.css";
import Link from "next/link";
import { requireStaffRole } from "@/lib/auth/authorization";
import { addAgency, reviewClaim } from "./actions";
import { claimProfileColumns, claimProfileSnapshot } from "@/lib/agencies/claim-profile";
import AgencyInformationSummary from "@/app/agency/claim/AgencyInformationSummary";
import CorrectProfileForm from "./CorrectProfileForm";
export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const { supabase } = await requireStaffRole(["super_admin"]);
  const [
    { data: agencies, error: agencyError },
    { data: claims, error: claimError },
  ] = await Promise.all([
    supabase.from("ap_public_agencies").select(claimProfileColumns),
    supabase
      .from("ap_agency_claims")
      .select("id,agency_id,claimant_user_id,evidence,created_at,representative_name,representative_role,business_contact,profile_confirmed,requested_corrections,profile_snapshot")
      .eq("status", "pending"),
  ]);
  return (
    <main className="directory-operations">
      <Link href="/owners/dashboard">← Owner dashboard</Link>
      <h1>Agency directory and ownership claims</h1>
      {query.error && <p role="alert">{query.error}</p>}
      {query.added && (
        <p role="status">Agency published as an unclaimed listing.</p>
      )}
      {query.reviewed && <p role="status">Claim decision saved.</p>}
      {query.corrected && <p role="status">Profile corrections saved. Review the updated information before approving a claim.</p>}
      <h2>Add a legitimate agency</h2>
      <p>
        Check the official website and company identity before publishing. A
        listing does not imply independent verification.
      </p>
      <form action={addAgency} className="access-form">
        <label>
          Name
          <input name="name" required minLength={2} maxLength={160} />
        </label>
        <label>
          Official website
          <input name="website" type="url" pattern="https://.*" required />
        </label>
        <label>
          Country
          <input name="country" required />
        </label>
        <label>
          Agency information
          <textarea name="about" required minLength={40} />
        </label>
        <label>
          <input type="checkbox" required /> I reviewed the official sources and
          confirmed this is a legitimate agency.
        </label>
        <button type="submit">Publish unclaimed agency</button>
      </form>
      <h2>Published agencies</h2>
      {agencyError && <p role="alert">Could not load directory.</p>}
      <ul>
        {agencies
          ?.filter((a) => !a.demo_profile)
          .map((a) => (
            <li key={a.id}>
              <Link href={`/agency-profile.html?id=${a.slug}`}>{a.name}</Link>
              <CorrectProfileForm agency={a} />
            </li>
          ))}
      </ul>
      <h2>Pending ownership claims</h2>
      {claimError && (
        <p role="alert">
          Could not load claims. Apply the directory migration first.
        </p>
      )}
      {!claimError && !claims?.length && <p>No pending claims.</p>}
      {claims?.map((claim) => (
        <article key={claim.id}>
          <h3>
            {agencies?.find((a) => a.id === claim.agency_id)?.name ??
              claim.agency_id}
          </h3>
          <p>Claimant account: {claim.claimant_user_id}</p>
          <p>Representative: {claim.representative_name ?? "Missing — resubmission required"} · {claim.representative_role ?? "Role missing"}</p>
          <p>Business contact supplied: {claim.business_contact ?? "Missing"}. Independently confirm this address; it is not automatically verified.</p>
          <p>Corrections requested: {claim.requested_corrections || "None supplied"}</p>
          <details><summary>Profile reviewed by the claimant</summary><AgencyInformationSummary profile={claim.profile_snapshot ?? {}} /></details>
          <p>Open the current profile and check official sources. Resolve corrections before approving. If important details cannot be confirmed, keep the claim pending or decline it with an explanation.</p>
          <Link href={`/owners/dashboard/moderation/${claim.agency_id}`}>Review agency profile</Link>
          {agencies?.find((a) => a.id === claim.agency_id) && <CorrectProfileForm agency={agencies.find((a) => a.id === claim.agency_id)!} />}
          <p style={{ whiteSpace: "pre-wrap" }}>{claim.evidence}</p>
          <form>
            <input type="hidden" name="profile_snapshot" value={JSON.stringify(claimProfileSnapshot(agencies?.find((a) => a.id === claim.agency_id) ?? {}))} />
            <fieldset><legend>Required checks for approval</legend>
              <label><input name="identity" type="checkbox" /> I confirmed the agency&apos;s business identity.</label>
              <label><input name="authority" type="checkbox" /> I verified this person&apos;s authority to represent the agency.</label>
              <label><input name="contact" type="checkbox" /> I independently confirmed contact through an official agency channel.</label>
              <label><input name="information" type="checkbox" /> I reviewed current profile details and resolved missing information and corrections.</label>
            </fieldset>
            <label>
              Review explanation
              <textarea name="note" required minLength={10} />
            </label>
            <button formAction={reviewClaim.bind(null, claim.id, "approved")}>
              Approve ownership
            </button>
            <button formAction={reviewClaim.bind(null, claim.id, "rejected")}>
              Decline claim
            </button>
          </form>
        </article>
      ))}
    </main>
  );
}

```

## lib/agencies/claim-profile.ts

```ts
export const claimProfileColumns = "id,name,slug,demo_profile,website_url,about,country,city,services,social_links,directory_information,tagline,positioning_statement,category,founded_year,employee_count_range,languages,regions_served,creator_niches,ideal_client,minimum_requirements";

export function claimProfileSnapshot(agency: Record<string, unknown>) {
  return Object.fromEntries(
    ["name", "website_url", "about", "country", "city", "services", "social_links", "directory_information", "tagline", "positioning_statement", "category", "founded_year", "employee_count_range", "languages", "regions_served", "creator_niches", "ideal_client", "minimum_requirements"]
      .map((key) => [key, agency[key] ?? null]),
  );
}

export function readProfileSnapshot(value: FormDataEntryValue | null) {
  try {
    const parsed: unknown = JSON.parse(String(value ?? ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

```

## package.json

```json
{
  "name": "agency-prive-platform",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "verify": "npm run typecheck && npm run lint && npm test && npm run build",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@supabase/ssr": "^0.7.0",
    "@supabase/supabase-js": "^2.57.0",
    "next": "^16.0.0",
    "qrcode": "^1.5.4",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@electric-sql/pglite": "^0.5.8",
    "@playwright/test": "^1.55.0",
    "@types/node": "^22.0.0",
    "@types/qrcode": "^1.5.6",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^16.0.0",
    "typescript": "^5.9.0",
    "vitest": "^3.2.0"
  }
}

```

## proxy.ts

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requirePublicSupabaseEnv } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Keep old bookmarks working while making the role-specific URLs canonical.
  // Agency profile management and review submission belong to the agency portal;
  // every other legacy dashboard operation belongs to the owner portal.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const destination = request.nextUrl.clone();

    destination.pathname = pathname === "/admin/login"
      ? "/owners/login"
      : pathname === "/admin"
        ? "/owners/dashboard"
        : `/owners/dashboard${pathname.slice("/admin".length)}`;

    return NextResponse.redirect(destination, 308);
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    const destination = request.nextUrl.clone();

    const agencyPath = pathname === "/dashboard"
      || pathname === "/dashboard/agencies"
      || pathname.startsWith("/dashboard/agencies/")
      || pathname === "/dashboard/reviews/new";

    destination.pathname = agencyPath
      ? `/agency${pathname}`
      : `/owners${pathname}`;

    return NextResponse.redirect(destination, 308);
  }

  let response = NextResponse.next({ request });

  const { url, key } = requirePublicSupabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),

      setAll(items) {
        items.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        items.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Carry refreshed authentication cookies onto redirect responses.
  function redirectWithCookies(destination: URL) {
    const redirectResponse = NextResponse.redirect(destination);

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  const isAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/");

  const isOwnerRoute =
    pathname === "/owners" || pathname.startsWith("/owners/");

  const isAgencyRoute =
    pathname === "/agency" || pathname.startsWith("/agency/");

  const isProtectedAdminRoute =
    isAdminRoute && pathname !== "/admin/login";

  const isProtectedOwnerRoute =
    isOwnerRoute && pathname !== "/owners/login";

  const isProtectedAgencyRoute =
    isAgencyRoute
    && !["/agency/login", "/agency/register"].includes(pathname)
    && !pathname.startsWith("/agency/claim/");

  const isDashboardRoute =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  const isProtectedRoute =
    isDashboardRoute
    || isProtectedAdminRoute
    || isProtectedOwnerRoute
    || isProtectedAgencyRoute;

  if ((!user || authenticationError) && isProtectedRoute) {
    const login = request.nextUrl.clone();

    login.pathname =
      isProtectedAdminRoute || isProtectedOwnerRoute
        ? "/owners/login"
        : "/agency/login";

    login.search = "";
    login.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    );

    return redirectWithCookies(login);
  }

  if (
    user
    && !authenticationError
    && (
      isProtectedAdminRoute
      || isProtectedOwnerRoute
      || isProtectedAgencyRoute
    )
  ) {
    const {
      data: staffRoles,
      error: roleError,
    } = await supabase
      .from("ap_staff_roles")
      .select("role")
      .eq("user_id", user.id);

    // A failed role lookup must not grant protected access.
    if (roleError || !staffRoles) {
      const login = request.nextUrl.clone();

      login.pathname =
        isProtectedAdminRoute || isProtectedOwnerRoute
          ? "/owners/login"
          : "/agency/login";

      login.search = "";
      login.searchParams.set(
        "error",
        "Your account access could not be verified. Please try again.",
      );

      return redirectWithCookies(login);
    }

    const isPlatformAccount = staffRoles.length > 0;

    const isSuperAdmin = staffRoles.some(
      (staffRole) => staffRole.role === "super_admin",
    );

    if (isProtectedAgencyRoute && isPlatformAccount) {
      const forbidden = request.nextUrl.clone();

      forbidden.pathname = "/forbidden";
      forbidden.search = "";
      forbidden.searchParams.set("portal", "agency");
      forbidden.searchParams.set(
        "error",
        "Platform staff accounts cannot access the agency portal. Please use the owner login with your platform account, or a separate agency account.",
      );

      return redirectWithCookies(forbidden);
    }

    if (
      (isProtectedAdminRoute || isProtectedOwnerRoute)
      && !isSuperAdmin
    ) {
      const forbidden = request.nextUrl.clone();

      forbidden.pathname = "/forbidden";
      forbidden.search = "";
      forbidden.searchParams.set("portal", "owner");

      return redirectWithCookies(forbidden);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/agency/:path*",
    "/owners/:path*",
    "/login",
  ],
};
```

## public/agency-profile.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <meta
        name="description"
        content="Explore agency services, expertise, locations, and company information on Avera Privé."
    >

    <title>Agency Profile | Avera Privé</title>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

    <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
    >

    <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css"
    >

    <link rel="stylesheet" href="css/global.css">
    <link rel="stylesheet" href="css/agency-profile.css">
    <link rel="stylesheet" href="css/agency-profile-enhancements.css">
</head>

<body>

    <a href="#mainContent" class="skip-link">
        Skip to agency profile
    </a>

    <!-- HEADER -->
    <header class="site-header scrolled">
        <div class="container header-container">

            <a
                href="index.html"
                class="brand brand-image-link"
                aria-label="Avera Privé homepage"
            >
                <img
                    src="assets/images/avera-prive-header-logo.png"
                    alt="Avera Privé"
                    class="brand-logo-image"
                >
            </a>

            <nav
                class="desktop-navigation"
                aria-label="Main navigation"
            >
                <a href="agencies.html">Agencies</a>
                <a href="rankings.html">Rankings</a>
                <a href="compare.html">Compare</a>
                <a href="insights.html">Insights</a>
                <a href="for-agencies.html">For Agencies</a>
            </nav>

            <div class="header-actions">
                <a href="/agency/login" class="header-login">
                    Log In
                </a>

                <a
                    href="/agency/register"
                    class="button button-black header-trial"
                >
                    Start Free Trial
                </a>

                <button
                    type="button"
                    class="mobile-menu-button"
                    id="mobileMenuButton"
                    aria-label="Open navigation"
                    aria-expanded="false"
                >
                    <i class="fa-solid fa-bars"></i>
                </button>
            </div>
        </div>

        <nav
            class="mobile-navigation"
            id="mobileNavigation"
            aria-label="Mobile navigation"
        >
            <a href="agencies.html">Agencies</a>
            <a href="rankings.html">Rankings</a>
            <a href="compare.html">Compare</a>
            <a href="insights.html">Insights</a>
            <a href="for-agencies.html">For Agencies</a>
            <a href="/agency/login">Log In</a>

            <a
                href="/agency/register"
                class="button button-black"
            >
                Start Free Trial
            </a>
        </nav>
    </header>

    <main id="mainContent" class="agency-profile-page">
      <section class="profile-unavailable container" id="profileUnavailable" role="status">
        <span class="eyebrow">AGENCY DIRECTORY</span>
        <h1>Agency profile unavailable</h1>
        <p>Only reviewed and published agency profiles appear here. Explore the directory for approved listings.</p>
        <a href="agencies.html" class="button button-black">Explore agencies</a>
      </section>
      <div id="profilePublished" hidden>
        <section class="profile-demo-notice" id="profileDemoNotice" hidden><div class="container"><strong>DEMONSTRATION OFM PROFILE</strong><p>This is a fictional agency created to demonstrate Avera Privé. It is not a real business, is not verified or ranked, has no Trustpilot profile, and cannot receive inquiries.</p></div></section>
        <section class="profile-hero" aria-labelledby="agencyName">
          <div class="profile-cover" id="profileCover" role="img" aria-label="Agency cover image"></div>
          <div class="container">
            <nav class="profile-breadcrumb" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="agencies.html">Agencies</a><span>/</span><span id="breadcrumbAgencyName"></span></nav>
            <div class="profile-hero-grid">
              <div class="profile-identity">
                <div class="profile-logo" id="agencyLogo"></div>
                <div class="profile-title-area">
                  <div class="profile-labels"><span class="profile-demo-label" id="profileDemoLabel" hidden>Demo OFM Profile</span><span class="profile-verified" id="verificationBadge" hidden>Verified agency</span><span class="profile-top-rated" id="topRatedBadge" hidden>Top Rated</span><span class="profile-featured" id="sponsoredBadge" hidden>Featured / Sponsored</span></div>
                  <h1 id="agencyName"></h1><p class="profile-tagline" id="agencyTagline"></p>
                  <div class="profile-meta"><span><i class="fa-solid fa-location-dot"></i> <span id="agencyLocation"></span></span><span id="agencyExperience"></span><span id="agencySize"></span></div>
                </div>
              </div>
              <aside class="profile-actions-card"><p>Interested in this agency?</p><button type="button" class="button button-black button-full" id="contactAgencyButton" hidden>Contact Agency</button><a class="button button-outline button-full" id="agencyWebsite" target="_blank" rel="noopener noreferrer" hidden>Visit Website</a><a class="button button-outline button-full" id="claimAgencyButton" hidden>Claim this profile</a><p id="contactAvailability"></p><small>Contact details are shared when you choose to send an inquiry.</small></aside>
            </div>
            <p class="placement-disclosure" id="placementDisclosure" hidden>Featured / Sponsored placement is paid. Verification and reviews are assessed separately; payment does not affect rankings.</p>
          </div>
        </section>
        <div class="profile-navigation-wrapper"><div class="container"><nav class="profile-navigation" aria-label="Agency profile sections"><a href="#overview">About</a><a href="#services">Services</a><a href="#expertise">Creator niches</a><a href="#locations">Regions</a><a href="#portfolio">Portfolio</a><a href="#case-studies">Case studies</a><a href="#results">Results</a><a href="#reviews">Reviews</a><a href="#verification">Verification</a></nav></div></div>
        <section class="profile-content"><div class="container profile-content-grid"><div class="profile-main-column">
          <article class="profile-section" id="overview"><span class="eyebrow">COMPANY OVERVIEW</span><h2>About the agency</h2><p id="agencyDescription"></p></article>
          <article class="profile-section" id="directory-information"><span class="eyebrow">PUBLIC SOURCES</span><h2>Business information</h2><p>Details below are statements from public agency sources. Missing facts are marked “Not yet confirmed.” Registered addresses may differ from headquarters. A listing does not confirm ownership or business credentials.</p><dl id="directoryInformation"></dl><div id="directorySources"></div></article>
          <article class="profile-section" id="services"><span class="eyebrow">CAPABILITIES</span><h2>Services and specialties</h2><div class="service-card-grid" id="servicesGrid"></div></article>
          <article class="profile-section" id="expertise"><span class="eyebrow">EXPERTISE</span><h2>Creator niches</h2><div class="profile-tag-list" id="expertiseTags"></div></article>
          <article class="profile-section" id="locations"><span class="eyebrow">COVERAGE</span><h2>Countries and regions served</h2><div class="location-list" id="locationList"></div></article>
          <article class="profile-section" id="portfolio"><span class="eyebrow">SELECTED WORK</span><h2>Portfolio</h2><div class="profile-entry-grid" id="portfolioGrid"></div></article>
          <article class="profile-section" id="case-studies"><span class="eyebrow">CLIENT WORK</span><h2>Case studies</h2><div class="profile-entry-grid" id="caseStudyGrid"></div></article>
          <article class="profile-section" id="results"><span class="eyebrow">EVIDENCE</span><h2>Substantiated results</h2><p>Results are shown only when an agency provides a clear metric, timeframe, and supporting evidence reviewed for publication. Individual outcomes are not guarantees.</p><div class="profile-entry-grid" id="resultsGrid"></div></article>
          <article class="profile-section" id="reviews"><span class="eyebrow">CLIENT FEEDBACK</span><h2>Published reviews</h2><div id="reviewSummary"></div><div class="profile-entry-grid" id="reviewsGrid"></div><p>Reviews are moderated; agencies may respond and report concerns. A published review is not a guarantee of future performance. <a href="trust.html">Read the review policy</a>.</p></article>
          <article class="profile-section verification-section" id="verification"><span class="eyebrow">TRUST</span><h2>Verification status</h2><p id="verificationDescription"></p><p>Verification checks company identity and an authorized representative. It is independent of paid plans and does not guarantee results. <a href="trust.html">Read the criteria and dispute process</a>.</p></article>
        </div><aside class="profile-sidebar">
          <section class="sidebar-card"><span class="eyebrow">AGENCY DETAILS</span><dl class="agency-detail-list"><div><dt>Headquarters</dt><dd id="sidebarHeadquarters"></dd></div><div><dt>Agency size</dt><dd id="sidebarSize"></dd></div><div><dt>Years in business</dt><dd id="sidebarYears"></dd></div></dl></section>
          <section class="sidebar-card"><span class="eyebrow">SOCIAL PROFILES</span><div class="profile-socials" id="profileSocials"></div></section>
          <section class="sidebar-card profile-report-card"><h3>See incorrect information?</h3><p>Contact us to report profile or review concerns.</p><button type="button" id="reportProfileButton">Report a concern</button></section>
        </aside></div></section>
        <section class="related-agencies section"><div class="container"><div class="related-heading"><div><span class="eyebrow">CONTINUE EXPLORING</span><h2>Related agencies</h2></div><a href="agencies.html" class="button button-outline">View directory</a></div><div class="related-agency-grid" id="relatedAgencyGrid"></div></div></section>
      </div>
    </main>
    <div class="profile-modal-overlay" id="contactModal" aria-hidden="true"><div class="profile-modal" role="dialog" aria-modal="true" aria-labelledby="contactModalTitle"><div class="profile-modal-heading"><h2 id="contactModalTitle">Contact this agency</h2><button type="button" class="profile-modal-close" id="closeContactModal" aria-label="Close contact form">×</button></div><form id="agencyContactForm" novalidate><div class="form-group"><label for="contactName">Your name</label><input id="contactName" class="form-input" maxlength="100" required></div><div class="form-group"><label for="contactEmail">Email address</label><input id="contactEmail" class="form-input" type="email" required></div><div class="form-group"><label for="contactMessage">How can the agency help?</label><textarea id="contactMessage" class="form-textarea" minlength="20" maxlength="3000" required></textarea></div><div class="form-trap" aria-hidden="true"><label for="contactWebsite">Website</label><input id="contactWebsite" tabindex="-1" autocomplete="off"></div><label class="contact-consent"><input id="contactConsent" type="checkbox" required><span>I consent to Avera Privé securely sharing this inquiry with the selected agency.</span></label><div class="contact-form-message" id="contactFormMessage" role="status"></div><button class="button button-black button-full" type="submit">Send inquiry</button></form></div></div>
    <script src="js/main.js"></script>
    <script src="js/agency-profile.js"></script>
</body>
</html>

```

## public/js/agency-profile.js

```js
/* Avera Privé: replace the empty array with reviewed, published backend records. */
let approvedAgencyProfiles = [];
document.addEventListener('DOMContentLoaded', async () => {
 const byId = id => document.getElementById(id);
 const str = x => String(x ?? '').trim();
 const set = (id,x) => { if(byId(id)) byId(id).textContent = str(x); };
 const array = x => Array.isArray(x) ? x : [];
 const url = x => { try { const parsed = new URL(x); return ['https:','http:'].includes(parsed.protocol) ? parsed.href : ''; } catch { return ''; } };
 const add = (parent, tag, cls, text) => { const el=document.createElement(tag);el.className=cls;el.textContent=str(text);parent.append(el);return el; };
 const notice = (id,msg) => add(byId(id),'p','profile-no-data',msg);
 const marketplaceSession = () => { let value=sessionStorage.getItem('ap_marketplace_session');if(!value){value=crypto.randomUUID().replaceAll('-','_');sessionStorage.setItem('ap_marketplace_session',value);}return value; };
 const eventSource = agency => agency?.sponsored===true?'sponsored':'organic';
 const recordEvent = (agency,eventType) => { if(!agency?.agencyId || agency.demoProfile===true)return;fetch('/api/marketplace/event',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({agencyId:agency.agencyId,eventType,sessionId:marketplaceSession(),page:location.pathname,source:eventSource(agency),analyticsConsent:false})}).catch(()=>{}); };
 try {
  const response = await fetch('/api/public-agencies', {cache:'no-store'});
  if (!response.ok) throw new Error('Agency data unavailable');
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Invalid agency data');
  approvedAgencyProfiles = data.filter(x => x && x.status === 'approved' && x.published === true && /^[a-z0-9_-]{1,80}$/i.test(String(x.slug || '')))
   .map(x => ({...x,id:x.slug,verificationStatus:x.verified === true ? 'verified' : 'unverified',
    positioningStatement:x.positioning || x.positioningStatement, reviews:Array.isArray(x.reviews) ? x.reviews : [],
    countries:Array.isArray(x.countriesServed) ? x.countriesServed : [], socials:x.socials || x.social_links || {}, socialLinks:x.socials || x.social_links || {}}));
 } catch (error) {
  console.error('Could not load public agency profile:', error);
  return;
 }
 const key=new URLSearchParams(location.search).get('id');
 const agency=approvedAgencyProfiles.find(x => (str(x.id)===key || str(x.slug)===key) && x.status==='approved' && x.published===true);
 if(!agency)return;
 recordEvent(agency,'profile_view');
 byId('profileUnavailable').hidden=true;byId('profilePublished').hidden=false;
 const claimButton=byId('claimAgencyButton');if(claimButton){claimButton.href='/agency/claim/'+encodeURIComponent(agency.slug);claimButton.hidden=agency.demoProfile===true;}
 document.title=str(agency.name)+' | Avera Privé';
 set('agencyName',agency.name);set('breadcrumbAgencyName',agency.name);
 set('agencyTagline',agency.positioningStatement || agency.tagline || 'Positioning statement not provided.');
 set('agencyLocation',agency.location || agency.country || 'Location not provided');
 set('agencyExperience',agency.yearsInBusiness ? agency.yearsInBusiness+' years in business' : 'Experience not provided');
 set('agencySize',agency.size || 'Size not provided');
 set('agencyDescription',agency.about || agency.description || 'About information has not been published.');
 const details=agency.directoryInformation || agency.directory_information || {};
 const info=byId('directoryInformation');
 const value=x=>Array.isArray(x)?x.join(', '):str(x);
 if(info){
  const fields=[['Legal entity',details.legal_name],['Company registration / tax identifier',details.registration_number],['Registered address (not headquarters)',details.registered_address],['Public email',details.public_email],['Email purpose',details.email_purpose],['Public phone',details.public_phone],['Other contact',details.contact_channel],['Year established',details.founded_year],['Team size',details.team_size],['Languages',details.languages],['Markets served',details.markets_served],['Operating locations',details.operating_locations],['Research notes',details.note],['Last researched',details.checked_on]];
  for(const [label,datum] of fields){add(info,'dt','',label);add(info,'dd','',value(datum)||'Not yet confirmed');}
  const sources=byId('directorySources');
  for(const target of new Set([...array(details.sources),details.owner_reviewed_source].filter(Boolean))){const safe=url(target);if(!safe)continue;const link=add(sources,'a','',new URL(safe).hostname+' — official source');link.href=safe;link.target='_blank';link.rel='noopener noreferrer';add(sources,'br','','');}
 }
 set('sidebarHeadquarters',agency.location || agency.country || 'Not provided');set('sidebarSize',agency.size || 'Not provided');set('sidebarYears',agency.yearsInBusiness ?? 'Not provided');
 const cover=url(agency.coverImageUrl);if(cover){byId('profileCover').style.backgroundImage='url("'+cover.replace(/"/g,'%22')+'")';byId('profileCover').setAttribute('aria-label','Cover image for '+str(agency.name));}
 const logo=byId('agencyLogo');const image=url(agency.logoUrl);if(image){const img=document.createElement('img');img.src=image;img.alt=str(agency.name)+' logo';img.loading='lazy';logo.replaceChildren(img);}else set('agencyLogo',agency.initials || str(agency.name).slice(0,2).toUpperCase());
 const verified=agency.verificationStatus==='verified';byId('verificationBadge').hidden=!verified;
 const demo=agency.demoProfile===true;byId('profileDemoNotice').hidden=!demo;byId('profileDemoLabel').hidden=!demo;
 set('verificationDescription',demo?'Demonstration profiles cannot receive Avera Privé verification.':verified?'Business identity and authorized representative reviewed.':'This agency is not currently verified.');
 byId('topRatedBadge').hidden=agency.topRated!==true;
 const sponsored=agency.sponsored===true;byId('sponsoredBadge').hidden=!sponsored;byId('placementDisclosure').hidden=!sponsored;
 const website=demo?'':url(agency.website);if(website){byId('agencyWebsite').href=website;byId('agencyWebsite').hidden=false;byId('agencyWebsite').addEventListener('click',()=>recordEvent(agency,'website_click'));}
 const contact=!demo && agency.acceptingInquiries===true;byId('contactAgencyButton').hidden=!contact;
 set('contactAvailability',demo?'Demonstration only — inquiries disabled':contact?'Accepting inquiries':'Inquiry availability not confirmed');
 const services=byId('servicesGrid');if(!array(agency.services).length)notice('servicesGrid','No services published.');
 array(agency.services).forEach(service=>{const card=add(services,'article','service-card','');add(card,'h3','',typeof service==='string'?service:service.name);if(service?.description)add(card,'p','',service.description);});
 function tags(id,items,empty){if(!array(items).length)notice(id,empty);else array(items).forEach(item=>add(byId(id),'span','',item));}
 tags('expertiseTags',agency.niches || agency.expertise,'No creator niches published.');
 const regions=agency.countriesServed || agency.countries;if(!array(regions).length)notice('locationList','No additional regions published.');else array(regions).forEach(item=>add(byId('locationList'),'div','',item));
 function entries(id,items,empty,kind){const published=array(items).filter(x=>x?.status==='published' && (kind!=='result' || (x.metric && x.timeframe && x.evidenceStatus==='reviewed')));if(!published.length)return notice(id,empty);
 published.forEach(item=>{const card=add(byId(id),'article','profile-entry-card','');if(kind==='portfolio' && url(item.imageUrl)){const img=document.createElement('img');img.src=url(item.imageUrl);img.alt=str(item.imageAlt || item.title);img.loading='lazy';card.append(img);}add(card,'h3','',item.title);add(card,'p','',item.summary || item.description);if(kind==='result'){add(card,'strong','',item.metric);add(card,'small','', 'Timeframe: '+item.timeframe+' · Evidence reviewed');}});}
 entries('portfolioGrid',agency.portfolio,'No portfolio work published.','portfolio');entries('caseStudyGrid',agency.caseStudies,'No case studies published.','case');entries('resultsGrid',agency.results,'No substantiated results published.','result');
 const reviews=array(agency.reviews).filter(x=>x?.status==='published' && Number(x.rating)>=1 && Number(x.rating)<=5);
 const externalSummary=agency.externalRatingStatus==='active'?`${Number(agency.externalRating).toFixed(1)} simulated external rating from ${Number(agency.externalReviewCount||0)} fictional demo records.`:agency.externalRatingStatus==='unavailable'?'Simulated external rating is unavailable.':'No simulated external profile found.';
 set('reviewSummary',demo?`${externalSummary} This is not a live Trustpilot score or an Avera Privé review rating.`:reviews.length?reviews.length+' published review'+(reviews.length===1?'':'s'):'No published reviews yet.');
 reviews.forEach(review=>{const card=add(byId('reviewsGrid'),'article','profile-entry-card','');add(card,'strong','',Number(review.rating).toFixed(1)+' / 5');add(card,'p','',review.text);if(review.responseStatus==='published' && review.agencyResponse)add(card,'p','','Agency response: '+review.agencyResponse);});
 const socials=byId('profileSocials');for(const [label,target] of Object.entries(agency.socials || {})){const safe=url(target);if(!safe)continue;const link=add(socials,'a','',label);link.href=safe;link.target='_blank';link.rel='noopener noreferrer';}if(!socials.children.length)notice('profileSocials','No social links published.');
 const related=approvedAgencyProfiles.filter(x=>x!==agency && x.status==='approved' && x.published===true && x.category===agency.category).slice(0,3);if(!related.length)notice('relatedAgencyGrid','No related agencies published yet.');
 related.forEach(item=>{const card=add(byId('relatedAgencyGrid'),'article','related-agency-card','');add(card,'h3','',item.name);add(card,'p','',item.positioningStatement || item.location || '');const link=add(card,'a','','View profile →');link.href='agency-profile.html?id='+encodeURIComponent(item.id);});
 byId('reportProfileButton').addEventListener('click',event=>{event.currentTarget.textContent='Reporting will be available when support is connected.';event.currentTarget.disabled=true;});
 const modal=byId('contactModal'),opener=byId('contactAgencyButton');function close(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('profile-modal-open');opener.focus();}
 opener.addEventListener('click',()=>{recordEvent(agency,'contact_open');modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('profile-modal-open');byId('contactName').focus();});
 byId('closeContactModal').addEventListener('click',close);modal.addEventListener('click',event=>{if(event.target===modal)close();});document.addEventListener('keydown',event=>{if(event.key==='Escape' && modal.classList.contains('open'))close();});
 byId('agencyContactForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=form.querySelector('button[type="submit"]');if(!form.checkValidity() || byId('contactMessage').value.trim().length<20){set('contactFormMessage','Complete every field, provide at least 20 characters, and accept the consent statement.');form.reportValidity();return;}button.disabled=true;button.textContent='Sending…';set('contactFormMessage','');try{const response=await fetch('/api/marketplace/inquiry',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({agencyId:agency.agencyId,sessionId:marketplaceSession(),name:byId('contactName').value,email:byId('contactEmail').value,message:byId('contactMessage').value,website:byId('contactWebsite').value,consent:byId('contactConsent').checked,source:eventSource(agency)})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Inquiry could not be sent.');form.reset();set('contactFormMessage','Inquiry received securely. The agency can now review your request.');button.textContent='Inquiry sent';}catch(error){set('contactFormMessage',error.message||'Inquiry could not be sent. Please try again.');button.disabled=false;button.textContent='Send inquiry';}});
});

```

## research/README.md

```text
# Reviewed research pack
1. Read source-audit.md. All 50 are candidates; no business has been independently certified. TOAgency is held; import includes 49.
2. Back up the database and apply project migrations 018 (if not already applied) and 019.
3. Review each official source, then optionally run add-50-agencies.sql to add the 49 unclaimed candidates. This explicitly publishes listings; review before running.
4. Run enrich-researched-profiles.sql for researched metadata. It only fills empty metadata on exact slug/website matches with no active owner. It does not overwrite owner-reviewed information. Re-running is safe.
5. Use the owner directory to correct or complete details with sources before accepting claims.

No live database changes were made. Contact email publication does not prove reachability. Social links, fees, minimum requirements and niches are not filled from guesses. Missing details require direct confirmation.

```

## research/add-50-agencies.sql

```sql
-- 50 researched candidates; TOAgency withheld pending direct confirmation.
-- Reviewed import contains 49 candidates. Review source-audit.md before publishing.
-- Run in your Supabase SQL editor AFTER reviewing agency-list.md.
-- Requires your existing curated-directory migrations.
-- Adds public, unclaimed profiles. No memberships, verification badges, ratings or reviews.
-- Existing records are preserved. Countries omitted where not independently established.
BEGIN;
WITH researched(name,slug,website_url,country,about) AS (
 VALUES
  ('Creators Inc', 'creators-inc', 'https://www.creatorsinc.com/', NULL, 'Creators Inc describes its services as account management, content planning, fan relationships and creator brand development.'),
  ('FansHub', 'fanshub', 'https://www.usefanshub.com/', NULL, 'FansHub describes its services as account management, fan messaging, marketing, content strategy and content protection.'),
  ('Sakura Management', 'sakura-management', 'https://www.sakura.agency/', NULL, 'Sakura Management describes its services as creator account management, social media marketing, fan messaging and leak protection.'),
  ('TEASY Agency', 'teasy-agency', 'https://teasyagency.com/', NULL, 'TEASY Agency describes its services as onlyFans management and marketing services for creator accounts.'),
  ('Bunny Agency', 'bunny-agency', 'https://bunny-agency.com/', NULL, 'Bunny Agency describes its services as creator account management, fan communication and marketing across subscription platforms.'),
  ('Louna''s Models', 'louna-s-models', 'https://lounasmodels.com/', NULL, 'Louna''s Models describes its services as onlyFans management, social media traffic, content planning and subscriber retention.'),
  ('MANGO', 'mango', 'https://www.mangova.agency/', NULL, 'MANGO describes its services as onlyFans management focused on developing an existing creator account.'),
  ('FantasyRise', 'fantasyrise', 'https://fantasyrise.com/', NULL, 'FantasyRise describes its services as account management, fan messaging, pricing, content planning, marketing and reporting.'),
  ('OnModelStudios', 'onmodelstudios', 'https://onmodelstudios.com/', NULL, 'OnModelStudios describes its services as account management, fan messaging, creator marketing and performance reporting.'),
  ('Perlage Studios', 'perlage-studios', 'https://perlagestudios.com/', NULL, 'Perlage Studios describes its services as boutique OnlyFans management with content planning, messaging, marketing and reporting.'),
  ('Lumina Connect', 'lumina-connect', 'https://lumina-connect.com/', NULL, 'Lumina Connect describes its services as account management, fan messaging, content planning, marketing and leak removal.'),
  ('Foxy Studios', 'foxy-studios', 'https://foxy-studios.com/', NULL, 'Foxy Studios describes its services as creator management, social media strategy, content planning and fan engagement.'),
  ('Aruna Talent', 'aruna-talent', 'https://arunatalent.com/', NULL, 'Aruna Talent describes its services as creator management with fan messaging, marketing, content strategy and privacy support.'),
  ('Hush Talent Inc.', 'hush-talent-inc', 'https://hushtalentinc.com/', NULL, 'Hush Talent Inc. describes its services as creator management across OnlyFans and other subscription and social platforms.'),
  ('SirenCY', 'sirency', 'https://www.sirency.com/', NULL, 'SirenCY describes its services as content planning, fan messaging workflows, monetization strategy and account operations.'),
  ('TopStar MGMT', 'topstar-mgmt', 'https://www.topstarmgmt.com/', NULL, 'TopStar MGMT describes its services as account management, content strategy, fan messaging, brand development and social media.'),
  ('AROA Agency', 'aroa-agency', 'https://aroaagency.com/', NULL, 'AROA Agency describes its services as onlyFans management, fan messaging, content calendars, branding and audience growth.'),
  ('AT Agency', 'at-agency', 'https://at-agency.co/', NULL, 'AT Agency describes its services as creator account operations, content planning, fan engagement and audience development.'),
  ('XCreatorMgmt', 'xcreatormgmt', 'https://www.xcreatormgmt.com/', NULL, 'XCreatorMgmt describes its services as account management, social media marketing, content ideas and subscriber communication.'),
  ('Vanguard Star Management', 'vanguard-star-management', 'https://vsmagency.com/', NULL, 'Vanguard Star Management describes its services as onlyFans management, marketing, fan messaging, content strategy and brand protection.'),
  ('Model Starz', 'model-starz', 'https://www.modelstarzmgmt.com/', NULL, 'Model Starz describes its services as onlyFans and Fansly creator management, content strategy and audience promotion.'),
  ('Vantage Agency', 'vantage-agency', 'https://thevantage.agency/', NULL, 'Vantage Agency describes its services as creator brand management across subscription platforms, social media and fan communities.'),
  ('Lush Management', 'lush-management', 'https://www.lushmgt.com/', NULL, 'Lush Management describes its services as onlyFans account management, content posting, subscriber messaging and social media support.'),
  ('Rize Agency', 'rize-agency', 'https://rizeagency.co/', NULL, 'Rize Agency describes its services as creator growth management with social media promotion and subscriber conversion.'),
  ('Hussar OFM', 'hussar-ofm', 'https://www.hussarofm.com/', NULL, 'Hussar OFM describes its services as onlyFans account management, fan messaging, content planning, growth and administration.'),
  ('Lookstars Agency', 'lookstars-agency', 'https://www.lookstarsagency.com/en', NULL, 'Lookstars Agency describes its services as boutique OnlyFans management with fan engagement and social media marketing.'),
  ('EROS Agency', 'eros-agency', 'https://www.agency-eros.com/', NULL, 'EROS Agency describes its services as onlyFans account management, fan monetization, audience growth and creator brand strategy.'),
  ('SVJ Talent', 'svj-talent', 'https://svjtalent.com/', NULL, 'SVJ Talent describes its services as chatting-focused creator management with fan messaging and account communication support.'),
  ('OnlyFans Management (Australia)', 'onlyfans-management-australia', 'https://onlyfansmanagement.com.au/', NULL, 'OnlyFans Management (Australia) describes its services as creator management with account strategy, marketing and ongoing account support.'),
  ('FEM Management', 'fem-management', 'https://www.fem-management.com/', NULL, 'FEM Management describes its services as onlyFans management with fan messaging, content ideas, promotion and leak protection.'),
  ('Aura Management', 'aura-management', 'https://www.auramgmt.com.au/', NULL, 'Aura Management describes its services as australian creator talent management and OnlyFans account support.'),
  ('Nest Talent', 'nest-talent', 'https://www.nesttalent.com/', NULL, 'Nest Talent describes its services as creator account strategy, social media growth, audience engagement and operational support.'),
  ('Blue Rose Talent', 'blue-rose-talent', 'https://bluerosetalent.com/', NULL, 'Blue Rose Talent describes its services as creator career management and support for OnlyFans and other creator platforms.'),
  ('The Scandilo Agency', 'the-scandilo-agency', 'https://scandiloagency.com/', NULL, 'The Scandilo Agency describes its services as onlyFans management with promotion, fan messaging and a personal account manager.'),
  ('ALLURE', 'allure', 'https://www.allureagencyparis.com/en', NULL, 'ALLURE describes its services as creator management with account operations, social media traffic and growth strategy.'),
  ('Unfiltered Management', 'unfiltered-management', 'https://www.unfiltered-management.com/', NULL, 'Unfiltered Management describes its services as onlyFans creator management, account strategy and support for switching agency teams.'),
  ('Xentra Group', 'xentra-group', 'https://xentragroup.co.uk/onlyfans-agency-uk', NULL, 'Xentra Group describes its services as onlyFans creator management with fan messaging, account strategy and audience growth.'),
  ('Elvision Studios', 'elvision-studios', 'https://elvision-studios.com/en/europe/united-kingdom', NULL, 'Elvision Studios describes its services as remote OnlyFans management for creators, including support for UK-based accounts.'),
  ('Shevo Studio', 'shevo-studio', 'https://www.shevostudio.com/', NULL, 'Shevo Studio describes its services as onlyFans and Fansly account management with fan retention and social media marketing.'),
  ('Norvo Management', 'norvo-management', 'https://norvomanagement.com/', NULL, 'Norvo Management describes its services as onlyFans management with fan messaging, content strategy and creator growth planning.'),
  ('Creator House', 'creator-house', 'https://creatorhouse.agency/', NULL, 'Creator House describes its services as creator management with social media strategy, fan messaging and privacy support.'),
  ('20MG', '20mg', 'https://20mg.co/', NULL, '20MG describes its services as onlyFans creator management and growth services for international creator accounts.'),
  ('TOAgency', 'toagency', 'https://theonlyfans.agency/', NULL, 'TOAgency describes its services as creator account management with strategic content planning and ongoing fan engagement.'),
  ('Lambert Agency', 'lambert-agency', 'https://agencylambert.com/', NULL, 'Lambert Agency describes its services as onlyFans management with content planning, fan messaging and audience acquisition.'),
  ('Empire of Agency', 'empire-of-agency', 'https://www.empireofagency.com/', NULL, 'Empire of Agency describes its services as creator management covering strategy, distribution, fan operations and reporting.'),
  ('Elev Agency', 'elev-agency', 'https://elev.agency/', NULL, 'Elev Agency describes its services as creator management, social media planning and fan engagement services.'),
  ('OFAgency.co', 'ofagency-co', 'https://www.ofagency.co/', NULL, 'OFAgency.co describes its services as onlyFans account management, traffic acquisition, fan messaging and content strategy.'),
  ('TDM Business', 'tdm-business', 'https://tdmbusiness.com/', NULL, 'TDM Business describes its services as onlyFans management and support services for creators and agency businesses.'),
  ('OFM Models Agency', 'ofm-models-agency', 'https://www.onlyfansmanagement.info/', NULL, 'OFM Models Agency describes its services as OnlyFans account management, fan messaging, profile growth and mentoring.'),
  ('BeaconOFM', 'beaconofm', 'https://beaconofm.com/', NULL, 'BeaconOFM describes its services as creator management with fan messaging, traffic strategy and an AI content production offering.')
)
INSERT INTO public.ap_agencies
 (name,slug,website_url,country,about,status,published,publication_status,approved_at,published_at,demo_profile,accepting_inquiries)
SELECT r.name,r.slug,r.website_url,r.country,r.about,'approved',true,'published',now(),now(),false,false
FROM researched r
WHERE r.slug <> 'toagency' AND NOT EXISTS (
 SELECT 1 FROM public.ap_agencies a
 WHERE a.slug=r.slug OR lower(trim(a.name))=lower(trim(r.name))
 OR regexp_replace(lower(a.website_url),'^https?://(www[.])?|/+$','','g')
    =regexp_replace(lower(r.website_url),'^https?://(www[.])?|/+$','','g')
)
ON CONFLICT (slug) DO NOTHING;
COMMIT;


```

## research/agencies.json

```json
[
  {
    "id": 1,
    "name": "Creators Inc",
    "website_url": "https://www.creatorsinc.com/",
    "description": "Creators Inc describes its services as account management, content planning, fan relationships and creator brand development.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.creatorsinc.com/",
    "slug": "creators-inc",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.creatorsinc.com/",
        "https://www.creatorsinc.com/contact/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Content planning"
    ],
    "social_links": {}
  },
  {
    "id": 2,
    "name": "FansHub",
    "website_url": "https://www.usefanshub.com/",
    "description": "FansHub describes its services as account management, fan messaging, marketing, content strategy and content protection.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.usefanshub.com/",
    "slug": "fanshub",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "operating_locations": [
        "United Kingdom",
        "United States"
      ],
      "sources": [
        "https://www.usefanshub.com/",
        "https://www.usefanshub.com/services/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Creator marketing",
      "Content strategy"
    ],
    "social_links": {}
  },
  {
    "id": 3,
    "name": "Sakura Management",
    "website_url": "https://www.sakura.agency/",
    "description": "Sakura Management describes its services as creator account management, social media marketing, fan messaging and leak protection.",
    "country": "United States",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.sakura.agency/",
    "slug": "sakura-management",
    "city": "Los Angeles",
    "directory_information": {
      "legal_name": "Sakura Management LLC",
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.sakura.agency/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Creator marketing",
      "Social media support",
      "Leak protection"
    ],
    "social_links": {}
  },
  {
    "id": 4,
    "name": "TEASY Agency",
    "website_url": "https://teasyagency.com/",
    "description": "TEASY Agency describes its services as onlyFans management and marketing services for creator accounts.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://teasyagency.com/",
    "slug": "teasy-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "team@teasyagency.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://teasyagency.com/",
        "https://teasyagency.com/contact-us/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Creator marketing"
    ],
    "social_links": {}
  },
  {
    "id": 5,
    "name": "Bunny Agency",
    "website_url": "https://bunny-agency.com/",
    "description": "Bunny Agency describes its services as creator account management, fan communication and marketing across subscription platforms.",
    "country": "United States",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://bunny-agency.com/",
    "slug": "bunny-agency",
    "city": null,
    "directory_information": {
      "legal_name": "Bunny Agency LLC",
      "registration_number": null,
      "registered_address": "1309 Coffeen Avenue STE 1200, Sheridan, Wyoming 82801, USA",
      "public_email": "info@bunny-agency.com",
      "public_phone": null,
      "founded_year": 2019,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "operating_locations": [
        "Florida, USA"
      ],
      "sources": [
        "https://bunny-agency.com/",
        "https://bunny-agency.com/impressum/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "public_phone",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Subscriber communication",
      "Creator marketing"
    ],
    "social_links": {}
  },
  {
    "id": 6,
    "name": "Louna's Models",
    "website_url": "https://lounasmodels.com/",
    "description": "Louna's Models describes its services as onlyFans management, social media traffic, content planning and subscriber retention.",
    "country": "United States",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://lounasmodels.com/",
    "slug": "louna-s-models",
    "city": "Los Angeles",
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": 2018,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://lounasmodels.com/",
        "https://lounasmodels.com/contact"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Content planning",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 7,
    "name": "MANGO",
    "website_url": "https://www.mangova.agency/",
    "description": "MANGO describes its services as onlyFans management focused on developing an existing creator account.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.mangova.agency/",
    "slug": "mango",
    "city": null,
    "directory_information": {
      "legal_name": "AG Media Pro LLC",
      "registration_number": "Wyoming filing 2025-001664576",
      "registered_address": "5830 E 2nd St, Ste 7000 #24316, Casper, Wyoming 82609, USA",
      "public_email": "mangova.agency@gmail.com",
      "public_phone": null,
      "founded_year": 2025,
      "team_size": "16 (agency-reported)",
      "languages": [
        "English",
        "Spanish"
      ],
      "markets_served": [
        "Europe",
        "Asia"
      ],
      "note": "Agency states business founded April 2025 and operations started June 2025.",
      "sources": [
        "https://www.mangova.agency/",
        "https://www.mangova.agency/about"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "public_phone",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 8,
    "name": "FantasyRise",
    "website_url": "https://fantasyrise.com/",
    "description": "FantasyRise describes its services as account management, fan messaging, pricing, content planning, marketing and reporting.",
    "country": "United States",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://fantasyrise.com/",
    "slug": "fantasyrise",
    "city": "Jacksonville",
    "directory_information": {
      "legal_name": "FantasyRise LLC",
      "registration_number": "Wyoming filing 2024-001405482",
      "registered_address": null,
      "public_email": "contact@fantasyrise.com",
      "public_phone": null,
      "founded_year": 2021,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "note": "Agency states operations since 2021; LLC formation is stated as 2024. These are separate dates.",
      "sources": [
        "https://fantasyrise.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registered_address",
      "public_phone",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Creator marketing",
      "Content planning",
      "Performance reporting"
    ],
    "social_links": {}
  },
  {
    "id": 9,
    "name": "OnModelStudios",
    "website_url": "https://onmodelstudios.com/",
    "description": "OnModelStudios describes its services as account management, fan messaging, creator marketing and performance reporting.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://onmodelstudios.com/about",
    "slug": "onmodelstudios",
    "city": null,
    "directory_information": {
      "legal_name": "ON INTERNATIONAL BUSINESS LLC",
      "registration_number": "Florida document L22000521896",
      "registered_address": "2880 W Oakland Park Blvd, Suite 225C, Oakland Park, FL 33311, USA",
      "public_email": "management@on-studios.com",
      "public_phone": null,
      "founded_year": 2021,
      "team_size": "35+ (agency-reported)",
      "languages": [
        "English",
        "German"
      ],
      "markets_served": null,
      "sources": [
        "https://onmodelstudios.com/",
        "https://onmodelstudios.com/about",
        "https://onmodelstudios.com/legal-notice"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "public_phone",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Creator marketing",
      "Performance reporting"
    ],
    "social_links": {}
  },
  {
    "id": 10,
    "name": "Perlage Studios",
    "website_url": "https://perlagestudios.com/",
    "description": "Perlage Studios describes its services as boutique OnlyFans management with content planning, messaging, marketing and reporting.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://perlagestudios.com/",
    "slug": "perlage-studios",
    "city": null,
    "directory_information": {
      "legal_name": "Perlage Studios Marketing Agency LLC",
      "registration_number": null,
      "registered_address": "2880 W Oakland Park Blvd, Suite 225C, Oakland Park, FL 33311, USA",
      "public_email": "perlagestudios@gmail.com",
      "public_phone": "+43 664 75080133",
      "founded_year": 2021,
      "team_size": null,
      "languages": [
        "English",
        "German"
      ],
      "markets_served": null,
      "sources": [
        "https://perlagestudios.com/",
        "https://perlagestudios.com/impressum"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "team_size",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Creator marketing",
      "Content planning",
      "Performance reporting"
    ],
    "social_links": {}
  },
  {
    "id": 11,
    "name": "Lumina Connect",
    "website_url": "https://lumina-connect.com/",
    "description": "Lumina Connect describes its services as account management, fan messaging, content planning, marketing and leak removal.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://lumina-connect.com/",
    "slug": "lumina-connect",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": "VAT DE451305405",
      "registered_address": "Bremerkampstraße 4, 49610 Quakenbrück, Germany",
      "public_email": "luminaconnected@gmail.com",
      "public_phone": null,
      "founded_year": 2021,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "note": "Imprint names Tom Hehler. Registered legal form has not been confirmed.",
      "sources": [
        "https://lumina-connect.com/",
        "https://lumina-connect.com/imprint"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "public_phone",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Creator marketing",
      "Content planning",
      "Leak protection"
    ],
    "social_links": {}
  },
  {
    "id": 12,
    "name": "Foxy Studios",
    "website_url": "https://foxy-studios.com/",
    "description": "Foxy Studios describes its services as creator management, social media strategy, content planning and fan engagement.",
    "country": "Switzerland",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://foxy-studios.com/",
    "slug": "foxy-studios",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "hello@foxy-studios.com",
      "public_phone": "+41 79 744 21 11",
      "founded_year": 2021,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://foxy-studios.com/",
        "https://foxy-studios.com/contact"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Content planning",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 13,
    "name": "Aruna Talent",
    "website_url": "https://arunatalent.com/",
    "description": "Aruna Talent describes its services as creator management with fan messaging, marketing, content strategy and privacy support.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://arunatalent.com/",
    "slug": "aruna-talent",
    "city": null,
    "directory_information": {
      "legal_name": "Aruna Talent LLC",
      "registration_number": null,
      "registered_address": null,
      "public_email": "intake@arunatalent.com",
      "public_phone": null,
      "founded_year": 2022,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "note": "Agency identifies a Wyoming LLC; registration number and street address require confirmation.",
      "sources": [
        "https://arunatalent.com/",
        "https://arunatalent.com/about"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "registered_address",
      "public_phone",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Creator marketing",
      "Content strategy",
      "Privacy support"
    ],
    "social_links": {}
  },
  {
    "id": 14,
    "name": "Hush Talent Inc.",
    "website_url": "https://hushtalentinc.com/",
    "description": "Hush Talent Inc. describes its services as creator management across OnlyFans and other subscription and social platforms.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://hushtalentinc.com/",
    "slug": "hush-talent-inc",
    "city": null,
    "directory_information": {
      "legal_name": "Hush Talent Inc.",
      "registration_number": null,
      "registered_address": null,
      "public_email": "apps@hushtalentinc.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "email_purpose": "Creator applications",
      "operating_locations": [
        "Connecticut, USA",
        "New York, USA",
        "Los Angeles, USA"
      ],
      "note": "Agency states incorporation in California; full registered address and company number not confirmed.",
      "sources": [
        "https://hushtalentinc.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 15,
    "name": "SirenCY",
    "website_url": "https://www.sirency.com/",
    "description": "SirenCY describes its services as content planning, fan messaging workflows, monetization strategy and account operations.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.sirency.com/",
    "slug": "sirency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "anyro@sirency.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "email_purpose": "Partnership contact",
      "sources": [
        "https://www.sirency.com/",
        "https://www.sirency.com/contact"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Fan messaging",
      "Content planning"
    ],
    "social_links": {}
  },
  {
    "id": 16,
    "name": "TopStar MGMT",
    "website_url": "https://www.topstarmgmt.com/",
    "description": "TopStar MGMT describes its services as account management, content strategy, fan messaging, brand development and social media.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.topstarmgmt.com/",
    "slug": "topstar-mgmt",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.topstarmgmt.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Content strategy",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 17,
    "name": "AROA Agency",
    "website_url": "https://aroaagency.com/",
    "description": "AROA Agency describes its services as onlyFans management, fan messaging, content calendars, branding and audience growth.",
    "country": "United States",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://aroaagency.com/",
    "slug": "aroa-agency",
    "city": "Miami",
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "office@aroaagency.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://aroaagency.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging"
    ],
    "social_links": {}
  },
  {
    "id": 18,
    "name": "AT Agency",
    "website_url": "https://at-agency.co/",
    "description": "AT Agency describes its services as creator account operations, content planning, fan engagement and audience development.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://at-agency.co/",
    "slug": "at-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://at-agency.co/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Content planning"
    ],
    "social_links": {}
  },
  {
    "id": 19,
    "name": "XCreatorMgmt",
    "website_url": "https://www.xcreatormgmt.com/",
    "description": "XCreatorMgmt describes its services as account management, social media marketing, content ideas and subscriber communication.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.xcreatormgmt.com/",
    "slug": "xcreatormgmt",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "yourfriends@xcreatormgmt.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.xcreatormgmt.com/",
        "https://www.xcreatormgmt.com/contact"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Subscriber communication",
      "Creator marketing",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 20,
    "name": "Vanguard Star Management",
    "website_url": "https://vsmagency.com/",
    "description": "Vanguard Star Management describes its services as onlyFans management, marketing, fan messaging, content strategy and brand protection.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://vsmagency.com/",
    "slug": "vanguard-star-management",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://vsmagency.com/",
        "https://vsmagency.com/contact"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Creator marketing",
      "Content strategy"
    ],
    "social_links": {}
  },
  {
    "id": 21,
    "name": "Model Starz",
    "website_url": "https://www.modelstarzmgmt.com/",
    "description": "Model Starz describes its services as onlyFans and Fansly creator management, content strategy and audience promotion.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.modelstarzmgmt.com/",
    "slug": "model-starz",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": [
        "United States",
        "Europe",
        "Asia"
      ],
      "sources": [
        "https://www.modelstarzmgmt.com/",
        "https://www.modelstarzmgmt.com/contact"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Content strategy"
    ],
    "social_links": {}
  },
  {
    "id": 22,
    "name": "Vantage Agency",
    "website_url": "https://thevantage.agency/",
    "description": "Vantage Agency describes its services as creator brand management across subscription platforms, social media and fan communities.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://thevantage.agency/",
    "slug": "vantage-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "hello@thevantage.agency",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://thevantage.agency/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 23,
    "name": "Lush Management",
    "website_url": "https://www.lushmgt.com/",
    "description": "Lush Management describes its services as onlyFans account management, content posting, subscriber messaging and social media support.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.lushmgt.com/",
    "slug": "lush-management",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "info@lushmgt.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.lushmgt.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 24,
    "name": "Rize Agency",
    "website_url": "https://rizeagency.co/",
    "description": "Rize Agency describes its services as creator growth management with social media promotion and subscriber conversion.",
    "country": "United Kingdom",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://rizeagency.co/",
    "slug": "rize-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://rizeagency.co/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 25,
    "name": "Hussar OFM",
    "website_url": "https://www.hussarofm.com/",
    "description": "Hussar OFM describes its services as onlyFans account management, fan messaging, content planning, growth and administration.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.hussarofm.com/",
    "slug": "hussar-ofm",
    "city": null,
    "directory_information": {
      "legal_name": "Hussar Technology",
      "registration_number": null,
      "registered_address": null,
      "public_email": "info@hussarofm.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "operating_locations": [
        "New York City, USA",
        "Warsaw, Poland"
      ],
      "note": "Agency describes a Polish sole proprietorship (JDG); company registration number not confirmed.",
      "sources": [
        "https://www.hussarofm.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Content planning"
    ],
    "social_links": {}
  },
  {
    "id": 26,
    "name": "Lookstars Agency",
    "website_url": "https://www.lookstarsagency.com/en",
    "description": "Lookstars Agency describes its services as boutique OnlyFans management with fan engagement and social media marketing.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.lookstarsagency.com/en",
    "slug": "lookstars-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "info@lookstarsagency.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": [
        "Europe"
      ],
      "sources": [
        "https://www.lookstarsagency.com/en",
        "https://www.lookstarsagency.com/en/about-us"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Creator marketing",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 27,
    "name": "EROS Agency",
    "website_url": "https://www.agency-eros.com/",
    "description": "EROS Agency describes its services as onlyFans account management, fan monetization, audience growth and creator brand strategy.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.agency-eros.com/",
    "slug": "eros-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.agency-eros.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 28,
    "name": "SVJ Talent",
    "website_url": "https://svjtalent.com/",
    "description": "SVJ Talent describes its services as chatting-focused creator management with fan messaging and account communication support.",
    "country": "United States",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://svjtalent.com/",
    "slug": "svj-talent",
    "city": "Boise",
    "directory_information": {
      "legal_name": "SVJ Talent LLC",
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "note": "Specialist chat service; content production and social marketing are not offered.",
      "sources": [
        "https://svjtalent.com/",
        "https://svjtalent.com/about"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Fan messaging",
      "Chat operations"
    ],
    "social_links": {}
  },
  {
    "id": 29,
    "name": "OnlyFans Management (Australia)",
    "website_url": "https://onlyfansmanagement.com.au/",
    "description": "OnlyFans Management (Australia) describes its services as creator management with account strategy, marketing and ongoing account support.",
    "country": "Australia",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://onlyfansmanagement.com.au/",
    "slug": "onlyfans-management-australia",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": 2022,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://onlyfansmanagement.com.au/",
        "https://onlyfansmanagement.com.au/contact/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Creator marketing"
    ],
    "social_links": {}
  },
  {
    "id": 30,
    "name": "FEM Management",
    "website_url": "https://www.fem-management.com/",
    "description": "FEM Management describes its services as onlyFans management with fan messaging, content ideas, promotion and leak protection.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.fem-management.com/",
    "slug": "fem-management",
    "city": null,
    "directory_information": {
      "legal_name": "FTD Media LLC",
      "registration_number": "EIN 92-1332408 (tax identifier; not a company registration number)",
      "registered_address": "3833 Powerline Rd, Suite 301-B, Fort Lauderdale, FL 33309, USA",
      "public_email": "info@fem-management.com",
      "public_phone": "+43 665 65677423",
      "founded_year": 2022,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.fem-management.com/",
        "https://www.fem-management.com/imprint"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Leak protection"
    ],
    "social_links": {}
  },
  {
    "id": 31,
    "name": "Aura Management",
    "website_url": "https://www.auramgmt.com.au/",
    "description": "Aura Management describes its services as australian creator talent management and OnlyFans account support.",
    "country": "Australia",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.auramgmt.com.au/",
    "slug": "aura-management",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "note": "Website states Australian registered and owned; legal entity details require confirmation.",
      "sources": [
        "https://www.auramgmt.com.au/",
        "https://www.auramgmt.com.au/talentenquiry"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 32,
    "name": "Nest Talent",
    "website_url": "https://www.nesttalent.com/",
    "description": "Nest Talent describes its services as creator account strategy, social media growth, audience engagement and operational support.",
    "country": "Australia",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.nesttalent.com/",
    "slug": "nest-talent",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "hello@nesttalent.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.nesttalent.com/",
        "https://www.nesttalent.com/about-us"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 33,
    "name": "Blue Rose Talent",
    "website_url": "https://bluerosetalent.com/",
    "description": "Blue Rose Talent describes its services as creator career management and support for OnlyFans and other creator platforms.",
    "country": "Australia",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://bluerosetalent.com/",
    "slug": "blue-rose-talent",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "info@bluerosetalent.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://bluerosetalent.com/",
        "https://bluerosetalent.com/contact"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 34,
    "name": "The Scandilo Agency",
    "website_url": "https://scandiloagency.com/",
    "description": "The Scandilo Agency describes its services as onlyFans management with promotion, fan messaging and a personal account manager.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://scandiloagency.com/",
    "slug": "the-scandilo-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": [
        "Scandinavia",
        "Europe"
      ],
      "sources": [
        "https://scandiloagency.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging"
    ],
    "social_links": {}
  },
  {
    "id": 35,
    "name": "ALLURE",
    "website_url": "https://www.allureagencyparis.com/en",
    "description": "ALLURE describes its services as creator management with account operations, social media traffic and growth strategy.",
    "country": "France",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.allureagencyparis.com/en",
    "slug": "allure",
    "city": "Paris",
    "directory_information": {
      "legal_name": "ALLURE SAS",
      "registration_number": null,
      "registered_address": null,
      "public_email": "allure.agency.paris@gmail.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "email_purpose": "Privacy contact",
      "sources": [
        "https://www.allureagencyparis.com/en",
        "https://www.allureagencyparis.com/mentions-legales"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 36,
    "name": "Unfiltered Management",
    "website_url": "https://www.unfiltered-management.com/",
    "description": "Unfiltered Management describes its services as onlyFans creator management, account strategy and support for switching agency teams.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.unfiltered-management.com/services/agency-switch",
    "slug": "unfiltered-management",
    "city": null,
    "directory_information": {
      "legal_name": "UNLIMITED STUDIOS CONSULTING LLC",
      "registration_number": null,
      "registered_address": "2880 W Oakland Park Blvd, STE 225C, Oakland Park, FL 33311, USA",
      "public_email": "info@unfiltered-management.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "operating_locations": [
        "Miami, USA",
        "Berlin, Germany",
        "Poland"
      ],
      "sources": [
        "https://www.unfiltered-management.com/",
        "https://www.unfiltered-management.com/services/agency-switch",
        "https://www.unfiltered-management.com/imprint"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 37,
    "name": "Xentra Group",
    "website_url": "https://xentragroup.co.uk/onlyfans-agency-uk",
    "description": "Xentra Group describes its services as onlyFans creator management with fan messaging, account strategy and audience growth.",
    "country": "United Kingdom",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://xentragroup.co.uk/onlyfans-agency-uk",
    "slug": "xentra-group",
    "city": null,
    "directory_information": {
      "legal_name": "CoachFlo Ltd",
      "registration_number": null,
      "registered_address": null,
      "public_email": "admin@xentragroup.co.uk",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://xentragroup.co.uk/onlyfans-agency-uk"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging"
    ],
    "social_links": {}
  },
  {
    "id": 38,
    "name": "Elvision Studios",
    "website_url": "https://elvision-studios.com/en/europe/united-kingdom",
    "description": "Elvision Studios describes its services as remote OnlyFans management for creators, including support for UK-based accounts.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://elvision-studios.com/en/europe/united-kingdom",
    "slug": "elvision-studios",
    "city": null,
    "directory_information": {
      "legal_name": "Elvision LLC",
      "registration_number": null,
      "registered_address": "30 N Gould St, Ste N, Sheridan, Wyoming 82801, USA",
      "public_email": "contact@elvision-studios.com",
      "public_phone": "+49 1577 3840073",
      "founded_year": 2022,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "note": "Registered address is not an operational headquarters. UK landing page indicates a service market, not headquarters.",
      "sources": [
        "https://elvision-studios.com/en/europe/united-kingdom",
        "https://uk.elvision-studios.com/imprint"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 39,
    "name": "Shevo Studio",
    "website_url": "https://www.shevostudio.com/",
    "description": "Shevo Studio describes its services as onlyFans and Fansly account management with fan retention and social media marketing.",
    "country": "United Kingdom",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.shevostudio.com/",
    "slug": "shevo-studio",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.shevostudio.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Creator marketing",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 40,
    "name": "Norvo Management",
    "website_url": "https://norvomanagement.com/",
    "description": "Norvo Management describes its services as onlyFans management with fan messaging, content strategy and creator growth planning.",
    "country": "United Kingdom",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://norvomanagement.com/",
    "slug": "norvo-management",
    "city": null,
    "directory_information": {
      "legal_name": "Norvo Ltd",
      "registration_number": "England and Wales company 17416436",
      "registered_address": null,
      "public_email": "contact@norvomanagement.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://norvomanagement.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Content strategy"
    ],
    "social_links": {}
  },
  {
    "id": 41,
    "name": "Creator House",
    "website_url": "https://creatorhouse.agency/",
    "description": "Creator House describes its services as creator management with social media strategy, fan messaging and privacy support.",
    "country": "Spain",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://creatorhouse.agency/",
    "slug": "creator-house",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "hello@creatorhouse.agency",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": [
        "Argentina",
        "Mexico"
      ],
      "sources": [
        "https://creatorhouse.agency/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Social media support",
      "Privacy support"
    ],
    "social_links": {}
  },
  {
    "id": 42,
    "name": "20MG",
    "website_url": "https://20mg.co/",
    "description": "20MG describes its services as onlyFans creator management and growth services for international creator accounts.",
    "country": "United States",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://20mg.co/",
    "slug": "20mg",
    "city": null,
    "directory_information": {
      "legal_name": "Twenty Management Group LLC",
      "registration_number": null,
      "registered_address": null,
      "public_email": "hello@20mg.co",
      "public_phone": "+1 332 265 3480",
      "founded_year": 2025,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://20mg.co/",
        "https://20mg.co/about"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "registered_address",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 43,
    "name": "TOAgency",
    "website_url": "https://theonlyfans.agency/",
    "description": "TOAgency describes its services as creator account management with strategic content planning and ongoing fan engagement.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://theonlyfans.agency/",
    "slug": "toagency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "note": "Contact page contains stock-template address, phone and noreply@envato.com. Identity and usable contact need direct confirmation. Do not import until reviewed.",
      "sources": [
        "https://theonlyfans.agency/",
        "https://theonlyfans.agency/contact/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "hold — direct confirmation required",
    "services": [
      "Creator account management",
      "Content planning"
    ],
    "social_links": {}
  },
  {
    "id": 44,
    "name": "Lambert Agency",
    "website_url": "https://agencylambert.com/",
    "description": "Lambert Agency describes its services as onlyFans management with content planning, fan messaging and audience acquisition.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://agencylambert.com/",
    "slug": "lambert-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "contact_channel": "Telegram @lambert_agency",
      "sources": [
        "https://agencylambert.com/",
        "https://t.me/lambert_agency"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Content planning"
    ],
    "social_links": {}
  },
  {
    "id": 45,
    "name": "Empire of Agency",
    "website_url": "https://www.empireofagency.com/",
    "description": "Empire of Agency describes its services as creator management covering strategy, distribution, fan operations and reporting.",
    "country": "France",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.empireofagency.com/",
    "slug": "empire-of-agency",
    "city": "Paris",
    "directory_information": {
      "legal_name": "Empire of Agency",
      "registration_number": "893032946 (agency-reported; registry verification pending)",
      "registered_address": null,
      "public_email": "legal@empireofagency.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "email_purpose": "Legal contact",
      "note": "Host/provider address has been excluded; it is not an agency address.",
      "sources": [
        "https://www.empireofagency.com/",
        "https://www.empireofagency.com/legal"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Performance reporting"
    ],
    "social_links": {}
  },
  {
    "id": 46,
    "name": "Elev Agency",
    "website_url": "https://elev.agency/",
    "description": "Elev Agency describes its services as creator management, social media planning and fan engagement services.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://elev.agency/",
    "slug": "elev-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "ethan@elev-agency.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://elev.agency/",
        "https://elev.agency/about"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 47,
    "name": "OFAgency.co",
    "website_url": "https://www.ofagency.co/",
    "description": "OFAgency.co describes its services as onlyFans account management, traffic acquisition, fan messaging and content strategy.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.ofagency.co/about",
    "slug": "ofagency-co",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.ofagency.co/",
        "https://www.ofagency.co/about",
        "https://www.ofagency.co/contact"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Content strategy"
    ],
    "social_links": {}
  },
  {
    "id": 48,
    "name": "TDM Business",
    "website_url": "https://tdmbusiness.com/",
    "description": "TDM Business describes its services as onlyFans management and support services for creators and agency businesses.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://tdmbusiness.com/",
    "slug": "tdm-business",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "info@tdmbusiness.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "operating_locations": [
        "United States",
        "United Kingdom"
      ],
      "sources": [
        "https://tdmbusiness.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 49,
    "name": "OFM Models Agency",
    "website_url": "https://www.onlyfansmanagement.info/",
    "description": "OFM Models Agency describes its services as OnlyFans account management, fan messaging, profile growth and mentoring.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.onlyfansmanagement.info/",
    "slug": "ofm-models-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "modelsagency.ofm@gmail.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "contact_channel": "Telegram @jfhello",
      "sources": [
        "https://www.onlyfansmanagement.info/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging"
    ],
    "social_links": {}
  },
  {
    "id": 50,
    "name": "BeaconOFM",
    "website_url": "https://beaconofm.com/",
    "description": "BeaconOFM describes its services as creator management with fan messaging, traffic strategy and an AI content production offering.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://beaconofm.com/",
    "slug": "beaconofm",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "contact@beaconofm.com",
      "public_phone": "+995 591 268799",
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "note": "Website publishes Gudauri Village, street 7, number 12; address type and country require confirmation. Registered legal entity is not confirmed. Phone country code is not headquarters evidence.",
      "sources": [
        "https://beaconofm.com/",
        "https://beaconofm.com/about"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches",
      "registered_address"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging"
    ],
    "social_links": {}
  }
]

```

## research/agency-list.md

```text
# 50 agency candidates — source audit
Checked: 10 October 2026

Public-source candidates, not independently certified businesses. 32 publish an email in inspected official pages; some are application, privacy or legal contacts. 18 state a legal business name. All 50 still have missing information. TOAgency is on hold: its contact page contains stock-template details. Reviewed import therefore contains 49 candidates.

Missing facts are null in JSON and display as Not yet confirmed. Registration and address statements are agency-reported; they have not been checked against company registries. Tax identifiers are labelled separately. Do not infer headquarters from a landing page, registered address or phone code. Public websites alone cannot establish legitimacy or ownership.

## Claim review
Confirm business identity against public registries or appropriate business documents. Verify the representative's authority. Independently contact the agency through a channel you found yourself, using a domain email challenge or website token where possible. A Google/Gmail login does not prove company ownership. Compare the saved profile, requested corrections and current facts; resolve material gaps before approval. Save corrections with a source and review explanation. Approve only after all four checks. Claim approval grants ownership of the existing profile, not a verification badge.

## Records

### 1. Creators Inc
- Status: candidate — owner source review required
- Website: https://www.creatorsinc.com/
- About: Creators Inc describes its services as account management, content planning, fan relationships and creator brand development.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.creatorsinc.com/
  - https://www.creatorsinc.com/contact/

### 2. FansHub
- Status: candidate — owner source review required
- Website: https://www.usefanshub.com/
- About: FansHub describes its services as account management, fan messaging, marketing, content strategy and content protection.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: United Kingdom, United States
- Official sources:
  - https://www.usefanshub.com/
  - https://www.usefanshub.com/services/

### 3. Sakura Management
- Status: candidate — owner source review required
- Website: https://www.sakura.agency/
- About: Sakura Management describes its services as creator account management, social media marketing, fan messaging and leak protection.
- Headquarters: Los Angeles, United States
- legal name: Sakura Management LLC
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.sakura.agency/

### 4. TEASY Agency
- Status: candidate — owner source review required
- Website: https://teasyagency.com/
- About: TEASY Agency describes its services as onlyFans management and marketing services for creator accounts.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: team@teasyagency.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://teasyagency.com/
  - https://teasyagency.com/contact-us/

### 5. Bunny Agency
- Status: candidate — owner source review required
- Website: https://bunny-agency.com/
- About: Bunny Agency describes its services as creator account management, fan communication and marketing across subscription platforms.
- Headquarters: United States
- legal name: Bunny Agency LLC
- registration number: Not yet confirmed
- registered address: 1309 Coffeen Avenue STE 1200, Sheridan, Wyoming 82801, USA
- public email: info@bunny-agency.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: 2019
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Florida, USA
- Official sources:
  - https://bunny-agency.com/
  - https://bunny-agency.com/impressum/

### 6. Louna's Models
- Status: candidate — owner source review required
- Website: https://lounasmodels.com/
- About: Louna's Models describes its services as onlyFans management, social media traffic, content planning and subscriber retention.
- Headquarters: Los Angeles, United States
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: 2018
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://lounasmodels.com/
  - https://lounasmodels.com/contact

### 7. MANGO
- Status: candidate — owner source review required
- Website: https://www.mangova.agency/
- About: MANGO describes its services as onlyFans management focused on developing an existing creator account.
- Headquarters: Not yet confirmed
- legal name: AG Media Pro LLC
- registration number: Wyoming filing 2025-001664576
- registered address: 5830 E 2nd St, Ste 7000 #24316, Casper, Wyoming 82609, USA
- public email: mangova.agency@gmail.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: 2025
- team size: 16 (agency-reported)
- languages: English, Spanish
- markets served: Europe, Asia
- operating locations: Not yet confirmed
- Note: Agency states business founded April 2025 and operations started June 2025.
- Official sources:
  - https://www.mangova.agency/
  - https://www.mangova.agency/about

### 8. FantasyRise
- Status: candidate — owner source review required
- Website: https://fantasyrise.com/
- About: FantasyRise describes its services as account management, fan messaging, pricing, content planning, marketing and reporting.
- Headquarters: Jacksonville, United States
- legal name: FantasyRise LLC
- registration number: Wyoming filing 2024-001405482
- registered address: Not yet confirmed
- public email: contact@fantasyrise.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: 2021
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Agency states operations since 2021; LLC formation is stated as 2024. These are separate dates.
- Official sources:
  - https://fantasyrise.com/

### 9. OnModelStudios
- Status: candidate — owner source review required
- Website: https://onmodelstudios.com/
- About: OnModelStudios describes its services as account management, fan messaging, creator marketing and performance reporting.
- Headquarters: Not yet confirmed
- legal name: ON INTERNATIONAL BUSINESS LLC
- registration number: Florida document L22000521896
- registered address: 2880 W Oakland Park Blvd, Suite 225C, Oakland Park, FL 33311, USA
- public email: management@on-studios.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: 2021
- team size: 35+ (agency-reported)
- languages: English, German
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://onmodelstudios.com/
  - https://onmodelstudios.com/about
  - https://onmodelstudios.com/legal-notice

### 10. Perlage Studios
- Status: candidate — owner source review required
- Website: https://perlagestudios.com/
- About: Perlage Studios describes its services as boutique OnlyFans management with content planning, messaging, marketing and reporting.
- Headquarters: Not yet confirmed
- legal name: Perlage Studios Marketing Agency LLC
- registration number: Not yet confirmed
- registered address: 2880 W Oakland Park Blvd, Suite 225C, Oakland Park, FL 33311, USA
- public email: perlagestudios@gmail.com
- email purpose: Not yet confirmed
- public phone: +43 664 75080133
- contact channel: Not yet confirmed
- founded year: 2021
- team size: Not yet confirmed
- languages: English, German
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://perlagestudios.com/
  - https://perlagestudios.com/impressum

### 11. Lumina Connect
- Status: candidate — owner source review required
- Website: https://lumina-connect.com/
- About: Lumina Connect describes its services as account management, fan messaging, content planning, marketing and leak removal.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: VAT DE451305405
- registered address: Bremerkampstraße 4, 49610 Quakenbrück, Germany
- public email: luminaconnected@gmail.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: 2021
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Imprint names Tom Hehler. Registered legal form has not been confirmed.
- Official sources:
  - https://lumina-connect.com/
  - https://lumina-connect.com/imprint

### 12. Foxy Studios
- Status: candidate — owner source review required
- Website: https://foxy-studios.com/
- About: Foxy Studios describes its services as creator management, social media strategy, content planning and fan engagement.
- Headquarters: Switzerland
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: hello@foxy-studios.com
- email purpose: Not yet confirmed
- public phone: +41 79 744 21 11
- contact channel: Not yet confirmed
- founded year: 2021
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://foxy-studios.com/
  - https://foxy-studios.com/contact

### 13. Aruna Talent
- Status: candidate — owner source review required
- Website: https://arunatalent.com/
- About: Aruna Talent describes its services as creator management with fan messaging, marketing, content strategy and privacy support.
- Headquarters: Not yet confirmed
- legal name: Aruna Talent LLC
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: intake@arunatalent.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: 2022
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Agency identifies a Wyoming LLC; registration number and street address require confirmation.
- Official sources:
  - https://arunatalent.com/
  - https://arunatalent.com/about

### 14. Hush Talent Inc.
- Status: candidate — owner source review required
- Website: https://hushtalentinc.com/
- About: Hush Talent Inc. describes its services as creator management across OnlyFans and other subscription and social platforms.
- Headquarters: Not yet confirmed
- legal name: Hush Talent Inc.
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: apps@hushtalentinc.com
- email purpose: Creator applications
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Connecticut, USA, New York, USA, Los Angeles, USA
- Note: Agency states incorporation in California; full registered address and company number not confirmed.
- Official sources:
  - https://hushtalentinc.com/

### 15. SirenCY
- Status: candidate — owner source review required
- Website: https://www.sirency.com/
- About: SirenCY describes its services as content planning, fan messaging workflows, monetization strategy and account operations.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: anyro@sirency.com
- email purpose: Partnership contact
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.sirency.com/
  - https://www.sirency.com/contact

### 16. TopStar MGMT
- Status: candidate — owner source review required
- Website: https://www.topstarmgmt.com/
- About: TopStar MGMT describes its services as account management, content strategy, fan messaging, brand development and social media.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.topstarmgmt.com/

### 17. AROA Agency
- Status: candidate — owner source review required
- Website: https://aroaagency.com/
- About: AROA Agency describes its services as onlyFans management, fan messaging, content calendars, branding and audience growth.
- Headquarters: Miami, United States
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: office@aroaagency.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://aroaagency.com/

### 18. AT Agency
- Status: candidate — owner source review required
- Website: https://at-agency.co/
- About: AT Agency describes its services as creator account operations, content planning, fan engagement and audience development.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://at-agency.co/

### 19. XCreatorMgmt
- Status: candidate — owner source review required
- Website: https://www.xcreatormgmt.com/
- About: XCreatorMgmt describes its services as account management, social media marketing, content ideas and subscriber communication.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: yourfriends@xcreatormgmt.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.xcreatormgmt.com/
  - https://www.xcreatormgmt.com/contact

### 20. Vanguard Star Management
- Status: candidate — owner source review required
- Website: https://vsmagency.com/
- About: Vanguard Star Management describes its services as onlyFans management, marketing, fan messaging, content strategy and brand protection.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://vsmagency.com/
  - https://vsmagency.com/contact

### 21. Model Starz
- Status: candidate — owner source review required
- Website: https://www.modelstarzmgmt.com/
- About: Model Starz describes its services as onlyFans and Fansly creator management, content strategy and audience promotion.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: United States, Europe, Asia
- operating locations: Not yet confirmed
- Official sources:
  - https://www.modelstarzmgmt.com/
  - https://www.modelstarzmgmt.com/contact

### 22. Vantage Agency
- Status: candidate — owner source review required
- Website: https://thevantage.agency/
- About: Vantage Agency describes its services as creator brand management across subscription platforms, social media and fan communities.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: hello@thevantage.agency
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://thevantage.agency/

### 23. Lush Management
- Status: candidate — owner source review required
- Website: https://www.lushmgt.com/
- About: Lush Management describes its services as onlyFans account management, content posting, subscriber messaging and social media support.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: info@lushmgt.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.lushmgt.com/

### 24. Rize Agency
- Status: candidate — owner source review required
- Website: https://rizeagency.co/
- About: Rize Agency describes its services as creator growth management with social media promotion and subscriber conversion.
- Headquarters: United Kingdom
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://rizeagency.co/

### 25. Hussar OFM
- Status: candidate — owner source review required
- Website: https://www.hussarofm.com/
- About: Hussar OFM describes its services as onlyFans account management, fan messaging, content planning, growth and administration.
- Headquarters: Not yet confirmed
- legal name: Hussar Technology
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: info@hussarofm.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: New York City, USA, Warsaw, Poland
- Note: Agency describes a Polish sole proprietorship (JDG); company registration number not confirmed.
- Official sources:
  - https://www.hussarofm.com/

### 26. Lookstars Agency
- Status: candidate — owner source review required
- Website: https://www.lookstarsagency.com/en
- About: Lookstars Agency describes its services as boutique OnlyFans management with fan engagement and social media marketing.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: info@lookstarsagency.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Europe
- operating locations: Not yet confirmed
- Official sources:
  - https://www.lookstarsagency.com/en
  - https://www.lookstarsagency.com/en/about-us

### 27. EROS Agency
- Status: candidate — owner source review required
- Website: https://www.agency-eros.com/
- About: EROS Agency describes its services as onlyFans account management, fan monetization, audience growth and creator brand strategy.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.agency-eros.com/

### 28. SVJ Talent
- Status: candidate — owner source review required
- Website: https://svjtalent.com/
- About: SVJ Talent describes its services as chatting-focused creator management with fan messaging and account communication support.
- Headquarters: Boise, United States
- legal name: SVJ Talent LLC
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Specialist chat service; content production and social marketing are not offered.
- Official sources:
  - https://svjtalent.com/
  - https://svjtalent.com/about

### 29. OnlyFans Management (Australia)
- Status: candidate — owner source review required
- Website: https://onlyfansmanagement.com.au/
- About: OnlyFans Management (Australia) describes its services as creator management with account strategy, marketing and ongoing account support.
- Headquarters: Australia
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: 2022
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://onlyfansmanagement.com.au/
  - https://onlyfansmanagement.com.au/contact/

### 30. FEM Management
- Status: candidate — owner source review required
- Website: https://www.fem-management.com/
- About: FEM Management describes its services as onlyFans management with fan messaging, content ideas, promotion and leak protection.
- Headquarters: Not yet confirmed
- legal name: FTD Media LLC
- registration number: EIN 92-1332408 (tax identifier; not a company registration number)
- registered address: 3833 Powerline Rd, Suite 301-B, Fort Lauderdale, FL 33309, USA
- public email: info@fem-management.com
- email purpose: Not yet confirmed
- public phone: +43 665 65677423
- contact channel: Not yet confirmed
- founded year: 2022
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.fem-management.com/
  - https://www.fem-management.com/imprint

### 31. Aura Management
- Status: candidate — owner source review required
- Website: https://www.auramgmt.com.au/
- About: Aura Management describes its services as australian creator talent management and OnlyFans account support.
- Headquarters: Australia
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Website states Australian registered and owned; legal entity details require confirmation.
- Official sources:
  - https://www.auramgmt.com.au/
  - https://www.auramgmt.com.au/talentenquiry

### 32. Nest Talent
- Status: candidate — owner source review required
- Website: https://www.nesttalent.com/
- About: Nest Talent describes its services as creator account strategy, social media growth, audience engagement and operational support.
- Headquarters: Australia
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: hello@nesttalent.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.nesttalent.com/
  - https://www.nesttalent.com/about-us

### 33. Blue Rose Talent
- Status: candidate — owner source review required
- Website: https://bluerosetalent.com/
- About: Blue Rose Talent describes its services as creator career management and support for OnlyFans and other creator platforms.
- Headquarters: Australia
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: info@bluerosetalent.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://bluerosetalent.com/
  - https://bluerosetalent.com/contact

### 34. The Scandilo Agency
- Status: candidate — owner source review required
- Website: https://scandiloagency.com/
- About: The Scandilo Agency describes its services as onlyFans management with promotion, fan messaging and a personal account manager.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Scandinavia, Europe
- operating locations: Not yet confirmed
- Official sources:
  - https://scandiloagency.com/

### 35. ALLURE
- Status: candidate — owner source review required
- Website: https://www.allureagencyparis.com/en
- About: ALLURE describes its services as creator management with account operations, social media traffic and growth strategy.
- Headquarters: Paris, France
- legal name: ALLURE SAS
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: allure.agency.paris@gmail.com
- email purpose: Privacy contact
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.allureagencyparis.com/en
  - https://www.allureagencyparis.com/mentions-legales

### 36. Unfiltered Management
- Status: candidate — owner source review required
- Website: https://www.unfiltered-management.com/
- About: Unfiltered Management describes its services as onlyFans creator management, account strategy and support for switching agency teams.
- Headquarters: Not yet confirmed
- legal name: UNLIMITED STUDIOS CONSULTING LLC
- registration number: Not yet confirmed
- registered address: 2880 W Oakland Park Blvd, STE 225C, Oakland Park, FL 33311, USA
- public email: info@unfiltered-management.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Miami, USA, Berlin, Germany, Poland
- Official sources:
  - https://www.unfiltered-management.com/
  - https://www.unfiltered-management.com/services/agency-switch
  - https://www.unfiltered-management.com/imprint

### 37. Xentra Group
- Status: candidate — owner source review required
- Website: https://xentragroup.co.uk/onlyfans-agency-uk
- About: Xentra Group describes its services as onlyFans creator management with fan messaging, account strategy and audience growth.
- Headquarters: United Kingdom
- legal name: CoachFlo Ltd
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: admin@xentragroup.co.uk
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://xentragroup.co.uk/onlyfans-agency-uk

### 38. Elvision Studios
- Status: candidate — owner source review required
- Website: https://elvision-studios.com/en/europe/united-kingdom
- About: Elvision Studios describes its services as remote OnlyFans management for creators, including support for UK-based accounts.
- Headquarters: Not yet confirmed
- legal name: Elvision LLC
- registration number: Not yet confirmed
- registered address: 30 N Gould St, Ste N, Sheridan, Wyoming 82801, USA
- public email: contact@elvision-studios.com
- email purpose: Not yet confirmed
- public phone: +49 1577 3840073
- contact channel: Not yet confirmed
- founded year: 2022
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Registered address is not an operational headquarters. UK landing page indicates a service market, not headquarters.
- Official sources:
  - https://elvision-studios.com/en/europe/united-kingdom
  - https://uk.elvision-studios.com/imprint

### 39. Shevo Studio
- Status: candidate — owner source review required
- Website: https://www.shevostudio.com/
- About: Shevo Studio describes its services as onlyFans and Fansly account management with fan retention and social media marketing.
- Headquarters: United Kingdom
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.shevostudio.com/

### 40. Norvo Management
- Status: candidate — owner source review required
- Website: https://norvomanagement.com/
- About: Norvo Management describes its services as onlyFans management with fan messaging, content strategy and creator growth planning.
- Headquarters: United Kingdom
- legal name: Norvo Ltd
- registration number: England and Wales company 17416436
- registered address: Not yet confirmed
- public email: contact@norvomanagement.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://norvomanagement.com/

### 41. Creator House
- Status: candidate — owner source review required
- Website: https://creatorhouse.agency/
- About: Creator House describes its services as creator management with social media strategy, fan messaging and privacy support.
- Headquarters: Spain
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: hello@creatorhouse.agency
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Argentina, Mexico
- operating locations: Not yet confirmed
- Official sources:
  - https://creatorhouse.agency/

### 42. 20MG
- Status: candidate — owner source review required
- Website: https://20mg.co/
- About: 20MG describes its services as onlyFans creator management and growth services for international creator accounts.
- Headquarters: United States
- legal name: Twenty Management Group LLC
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: hello@20mg.co
- email purpose: Not yet confirmed
- public phone: +1 332 265 3480
- contact channel: Not yet confirmed
- founded year: 2025
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://20mg.co/
  - https://20mg.co/about

### 43. TOAgency
- Status: hold — direct confirmation required
- Website: https://theonlyfans.agency/
- About: TOAgency describes its services as creator account management with strategic content planning and ongoing fan engagement.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Contact page contains stock-template address, phone and noreply@envato.com. Identity and usable contact need direct confirmation. Do not import until reviewed.
- Official sources:
  - https://theonlyfans.agency/
  - https://theonlyfans.agency/contact/

### 44. Lambert Agency
- Status: candidate — owner source review required
- Website: https://agencylambert.com/
- About: Lambert Agency describes its services as onlyFans management with content planning, fan messaging and audience acquisition.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Telegram @lambert_agency
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://agencylambert.com/
  - https://t.me/lambert_agency

### 45. Empire of Agency
- Status: candidate — owner source review required
- Website: https://www.empireofagency.com/
- About: Empire of Agency describes its services as creator management covering strategy, distribution, fan operations and reporting.
- Headquarters: Paris, France
- legal name: Empire of Agency
- registration number: 893032946 (agency-reported; registry verification pending)
- registered address: Not yet confirmed
- public email: legal@empireofagency.com
- email purpose: Legal contact
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Host/provider address has been excluded; it is not an agency address.
- Official sources:
  - https://www.empireofagency.com/
  - https://www.empireofagency.com/legal

### 46. Elev Agency
- Status: candidate — owner source review required
- Website: https://elev.agency/
- About: Elev Agency describes its services as creator management, social media planning and fan engagement services.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: ethan@elev-agency.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://elev.agency/
  - https://elev.agency/about

### 47. OFAgency.co
- Status: candidate — owner source review required
- Website: https://www.ofagency.co/
- About: OFAgency.co describes its services as onlyFans account management, traffic acquisition, fan messaging and content strategy.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.ofagency.co/
  - https://www.ofagency.co/about
  - https://www.ofagency.co/contact

### 48. TDM Business
- Status: candidate — owner source review required
- Website: https://tdmbusiness.com/
- About: TDM Business describes its services as onlyFans management and support services for creators and agency businesses.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: info@tdmbusiness.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: United States, United Kingdom
- Official sources:
  - https://tdmbusiness.com/

### 49. OFM Models Agency
- Status: candidate — owner source review required
- Website: https://www.onlyfansmanagement.info/
- About: OFM Models Agency describes its services as OnlyFans account management, fan messaging, profile growth and mentoring.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: modelsagency.ofm@gmail.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Telegram @jfhello
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.onlyfansmanagement.info/

### 50. BeaconOFM
- Status: candidate — owner source review required
- Website: https://beaconofm.com/
- About: BeaconOFM describes its services as creator management with fan messaging, traffic strategy and an AI content production offering.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: contact@beaconofm.com
- email purpose: Not yet confirmed
- public phone: +995 591 268799
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Website publishes Gudauri Village, street 7, number 12; address type and country require confirmation. Registered legal entity is not confirmed. Phone country code is not headquarters evidence.
- Official sources:
  - https://beaconofm.com/
  - https://beaconofm.com/about


```

## research/enrich-researched-profiles.sql

```sql
-- Apply migration 019 first. Review source-audit.md before running.
-- Fills empty metadata and blank core fields on exact matching UNOWNED records only.
-- Does not publish, verify, delete records, or grant access. Re-running preserves reviewed data.
BEGIN;
WITH researched(slug,website_url,information,country,city,services) AS (VALUES
 ('creators-inc','https://www.creatorsinc.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": null, "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://www.creatorsinc.com/", "https://www.creatorsinc.com/contact/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Content planning"]'::jsonb),
 ('fanshub','https://www.usefanshub.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": null, "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "operating_locations": ["United Kingdom", "United States"], "sources": ["https://www.usefanshub.com/", "https://www.usefanshub.com/services/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Fan messaging", "Creator marketing", "Content strategy"]'::jsonb),
 ('sakura-management','https://www.sakura.agency/','{"legal_name": "Sakura Management LLC", "registration_number": null, "registered_address": null, "public_email": null, "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://www.sakura.agency/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'United States','Los Angeles','["Creator account management", "Fan messaging", "Creator marketing", "Social media support", "Leak protection"]'::jsonb),
 ('teasy-agency','https://teasyagency.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": "team@teasyagency.com", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://teasyagency.com/", "https://teasyagency.com/contact-us/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Creator marketing"]'::jsonb),
 ('bunny-agency','https://bunny-agency.com/','{"legal_name": "Bunny Agency LLC", "registration_number": null, "registered_address": "1309 Coffeen Avenue STE 1200, Sheridan, Wyoming 82801, USA", "public_email": "info@bunny-agency.com", "public_phone": null, "founded_year": 2019, "team_size": null, "languages": null, "markets_served": null, "operating_locations": ["Florida, USA"], "sources": ["https://bunny-agency.com/", "https://bunny-agency.com/impressum/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'United States',NULL,'["Creator account management", "Subscriber communication", "Creator marketing"]'::jsonb),
 ('louna-s-models','https://lounasmodels.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": null, "public_phone": null, "founded_year": 2018, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://lounasmodels.com/", "https://lounasmodels.com/contact"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'United States','Los Angeles','["Creator account management", "Content planning", "Social media support"]'::jsonb),
 ('mango','https://www.mangova.agency/','{"legal_name": "AG Media Pro LLC", "registration_number": "Wyoming filing 2025-001664576", "registered_address": "5830 E 2nd St, Ste 7000 #24316, Casper, Wyoming 82609, USA", "public_email": "mangova.agency@gmail.com", "public_phone": null, "founded_year": 2025, "team_size": "16 (agency-reported)", "languages": ["English", "Spanish"], "markets_served": ["Europe", "Asia"], "note": "Agency states business founded April 2025 and operations started June 2025.", "sources": ["https://www.mangova.agency/", "https://www.mangova.agency/about"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management"]'::jsonb),
 ('fantasyrise','https://fantasyrise.com/','{"legal_name": "FantasyRise LLC", "registration_number": "Wyoming filing 2024-001405482", "registered_address": null, "public_email": "contact@fantasyrise.com", "public_phone": null, "founded_year": 2021, "team_size": null, "languages": null, "markets_served": null, "note": "Agency states operations since 2021; LLC formation is stated as 2024. These are separate dates.", "sources": ["https://fantasyrise.com/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'United States','Jacksonville','["Creator account management", "Fan messaging", "Creator marketing", "Content planning", "Performance reporting"]'::jsonb),
 ('onmodelstudios','https://onmodelstudios.com/','{"legal_name": "ON INTERNATIONAL BUSINESS LLC", "registration_number": "Florida document L22000521896", "registered_address": "2880 W Oakland Park Blvd, Suite 225C, Oakland Park, FL 33311, USA", "public_email": "management@on-studios.com", "public_phone": null, "founded_year": 2021, "team_size": "35+ (agency-reported)", "languages": ["English", "German"], "markets_served": null, "sources": ["https://onmodelstudios.com/", "https://onmodelstudios.com/about", "https://onmodelstudios.com/legal-notice"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Fan messaging", "Creator marketing", "Performance reporting"]'::jsonb),
 ('perlage-studios','https://perlagestudios.com/','{"legal_name": "Perlage Studios Marketing Agency LLC", "registration_number": null, "registered_address": "2880 W Oakland Park Blvd, Suite 225C, Oakland Park, FL 33311, USA", "public_email": "perlagestudios@gmail.com", "public_phone": "+43 664 75080133", "founded_year": 2021, "team_size": null, "languages": ["English", "German"], "markets_served": null, "sources": ["https://perlagestudios.com/", "https://perlagestudios.com/impressum"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Fan messaging", "Creator marketing", "Content planning", "Performance reporting"]'::jsonb),
 ('lumina-connect','https://lumina-connect.com/','{"legal_name": null, "registration_number": "VAT DE451305405", "registered_address": "Bremerkampstra\u00dfe 4, 49610 Quakenbr\u00fcck, Germany", "public_email": "luminaconnected@gmail.com", "public_phone": null, "founded_year": 2021, "team_size": null, "languages": null, "markets_served": null, "note": "Imprint names Tom Hehler. Registered legal form has not been confirmed.", "sources": ["https://lumina-connect.com/", "https://lumina-connect.com/imprint"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Fan messaging", "Creator marketing", "Content planning", "Leak protection"]'::jsonb),
 ('foxy-studios','https://foxy-studios.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": "hello@foxy-studios.com", "public_phone": "+41 79 744 21 11", "founded_year": 2021, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://foxy-studios.com/", "https://foxy-studios.com/contact"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'Switzerland',NULL,'["Creator account management", "Content planning", "Social media support"]'::jsonb),
 ('aruna-talent','https://arunatalent.com/','{"legal_name": "Aruna Talent LLC", "registration_number": null, "registered_address": null, "public_email": "intake@arunatalent.com", "public_phone": null, "founded_year": 2022, "team_size": null, "languages": null, "markets_served": null, "note": "Agency identifies a Wyoming LLC; registration number and street address require confirmation.", "sources": ["https://arunatalent.com/", "https://arunatalent.com/about"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Fan messaging", "Creator marketing", "Content strategy", "Privacy support"]'::jsonb),
 ('hush-talent-inc','https://hushtalentinc.com/','{"legal_name": "Hush Talent Inc.", "registration_number": null, "registered_address": null, "public_email": "apps@hushtalentinc.com", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "email_purpose": "Creator applications", "operating_locations": ["Connecticut, USA", "New York, USA", "Los Angeles, USA"], "note": "Agency states incorporation in California; full registered address and company number not confirmed.", "sources": ["https://hushtalentinc.com/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management"]'::jsonb),
 ('sirency','https://www.sirency.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": "anyro@sirency.com", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "email_purpose": "Partnership contact", "sources": ["https://www.sirency.com/", "https://www.sirency.com/contact"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Fan messaging", "Content planning"]'::jsonb),
 ('topstar-mgmt','https://www.topstarmgmt.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": null, "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://www.topstarmgmt.com/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Fan messaging", "Content strategy", "Social media support"]'::jsonb),
 ('aroa-agency','https://aroaagency.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": "office@aroaagency.com", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://aroaagency.com/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'United States','Miami','["Creator account management", "Fan messaging"]'::jsonb),
 ('at-agency','https://at-agency.co/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": null, "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://at-agency.co/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Content planning"]'::jsonb),
 ('xcreatormgmt','https://www.xcreatormgmt.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": "yourfriends@xcreatormgmt.com", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://www.xcreatormgmt.com/", "https://www.xcreatormgmt.com/contact"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Subscriber communication", "Creator marketing", "Social media support"]'::jsonb),
 ('vanguard-star-management','https://vsmagency.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": null, "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://vsmagency.com/", "https://vsmagency.com/contact"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Fan messaging", "Creator marketing", "Content strategy"]'::jsonb),
 ('model-starz','https://www.modelstarzmgmt.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": null, "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": ["United States", "Europe", "Asia"], "sources": ["https://www.modelstarzmgmt.com/", "https://www.modelstarzmgmt.com/contact"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Content strategy"]'::jsonb),
 ('vantage-agency','https://thevantage.agency/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": "hello@thevantage.agency", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://thevantage.agency/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Social media support"]'::jsonb),
 ('lush-management','https://www.lushmgt.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": "info@lushmgt.com", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://www.lushmgt.com/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Fan messaging", "Social media support"]'::jsonb),
 ('rize-agency','https://rizeagency.co/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": null, "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://rizeagency.co/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'United Kingdom',NULL,'["Creator account management", "Social media support"]'::jsonb),
 ('hussar-ofm','https://www.hussarofm.com/','{"legal_name": "Hussar Technology", "registration_number": null, "registered_address": null, "public_email": "info@hussarofm.com", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "operating_locations": ["New York City, USA", "Warsaw, Poland"], "note": "Agency describes a Polish sole proprietorship (JDG); company registration number not confirmed.", "sources": ["https://www.hussarofm.com/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Fan messaging", "Content planning"]'::jsonb),
 ('lookstars-agency','https://www.lookstarsagency.com/en','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": "info@lookstarsagency.com", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": ["Europe"], "sources": ["https://www.lookstarsagency.com/en", "https://www.lookstarsagency.com/en/about-us"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Creator marketing", "Social media support"]'::jsonb),
 ('eros-agency','https://www.agency-eros.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": null, "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://www.agency-eros.com/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management"]'::jsonb),
 ('svj-talent','https://svjtalent.com/','{"legal_name": "SVJ Talent LLC", "registration_number": null, "registered_address": null, "public_email": null, "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "note": "Specialist chat service; content production and social marketing are not offered.", "sources": ["https://svjtalent.com/", "https://svjtalent.com/about"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'United States','Boise','["Fan messaging", "Chat operations"]'::jsonb),
 ('onlyfans-management-australia','https://onlyfansmanagement.com.au/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": null, "public_phone": null, "founded_year": 2022, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://onlyfansmanagement.com.au/", "https://onlyfansmanagement.com.au/contact/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'Australia',NULL,'["Creator account management", "Creator marketing"]'::jsonb),
 ('fem-management','https://www.fem-management.com/','{"legal_name": "FTD Media LLC", "registration_number": "EIN 92-1332408 (tax identifier; not a company registration number)", "registered_address": "3833 Powerline Rd, Suite 301-B, Fort Lauderdale, FL 33309, USA", "public_email": "info@fem-management.com", "public_phone": "+43 665 65677423", "founded_year": 2022, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://www.fem-management.com/", "https://www.fem-management.com/imprint"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Fan messaging", "Leak protection"]'::jsonb),
 ('aura-management','https://www.auramgmt.com.au/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": null, "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "note": "Website states Australian registered and owned; legal entity details require confirmation.", "sources": ["https://www.auramgmt.com.au/", "https://www.auramgmt.com.au/talentenquiry"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'Australia',NULL,'["Creator account management"]'::jsonb),
 ('nest-talent','https://www.nesttalent.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": "hello@nesttalent.com", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://www.nesttalent.com/", "https://www.nesttalent.com/about-us"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'Australia',NULL,'["Social media support"]'::jsonb),
 ('blue-rose-talent','https://bluerosetalent.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": "info@bluerosetalent.com", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://bluerosetalent.com/", "https://bluerosetalent.com/contact"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'Australia',NULL,'["Creator account management"]'::jsonb),
 ('the-scandilo-agency','https://scandiloagency.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": null, "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": ["Scandinavia", "Europe"], "sources": ["https://scandiloagency.com/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Fan messaging"]'::jsonb),
 ('allure','https://www.allureagencyparis.com/en','{"legal_name": "ALLURE SAS", "registration_number": null, "registered_address": null, "public_email": "allure.agency.paris@gmail.com", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "email_purpose": "Privacy contact", "sources": ["https://www.allureagencyparis.com/en", "https://www.allureagencyparis.com/mentions-legales"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'France','Paris','["Creator account management", "Social media support"]'::jsonb),
 ('unfiltered-management','https://www.unfiltered-management.com/','{"legal_name": "UNLIMITED STUDIOS CONSULTING LLC", "registration_number": null, "registered_address": "2880 W Oakland Park Blvd, STE 225C, Oakland Park, FL 33311, USA", "public_email": "info@unfiltered-management.com", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "operating_locations": ["Miami, USA", "Berlin, Germany", "Poland"], "sources": ["https://www.unfiltered-management.com/", "https://www.unfiltered-management.com/services/agency-switch", "https://www.unfiltered-management.com/imprint"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management"]'::jsonb),
 ('xentra-group','https://xentragroup.co.uk/onlyfans-agency-uk','{"legal_name": "CoachFlo Ltd", "registration_number": null, "registered_address": null, "public_email": "admin@xentragroup.co.uk", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://xentragroup.co.uk/onlyfans-agency-uk"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'United Kingdom',NULL,'["Creator account management", "Fan messaging"]'::jsonb),
 ('elvision-studios','https://elvision-studios.com/en/europe/united-kingdom','{"legal_name": "Elvision LLC", "registration_number": null, "registered_address": "30 N Gould St, Ste N, Sheridan, Wyoming 82801, USA", "public_email": "contact@elvision-studios.com", "public_phone": "+49 1577 3840073", "founded_year": 2022, "team_size": null, "languages": null, "markets_served": null, "note": "Registered address is not an operational headquarters. UK landing page indicates a service market, not headquarters.", "sources": ["https://elvision-studios.com/en/europe/united-kingdom", "https://uk.elvision-studios.com/imprint"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management"]'::jsonb),
 ('shevo-studio','https://www.shevostudio.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": null, "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://www.shevostudio.com/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'United Kingdom',NULL,'["Creator account management", "Creator marketing", "Social media support"]'::jsonb),
 ('norvo-management','https://norvomanagement.com/','{"legal_name": "Norvo Ltd", "registration_number": "England and Wales company 17416436", "registered_address": null, "public_email": "contact@norvomanagement.com", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://norvomanagement.com/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'United Kingdom',NULL,'["Creator account management", "Fan messaging", "Content strategy"]'::jsonb),
 ('creator-house','https://creatorhouse.agency/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": "hello@creatorhouse.agency", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": ["Argentina", "Mexico"], "sources": ["https://creatorhouse.agency/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'Spain',NULL,'["Creator account management", "Fan messaging", "Social media support", "Privacy support"]'::jsonb),
 ('20mg','https://20mg.co/','{"legal_name": "Twenty Management Group LLC", "registration_number": null, "registered_address": null, "public_email": "hello@20mg.co", "public_phone": "+1 332 265 3480", "founded_year": 2025, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://20mg.co/", "https://20mg.co/about"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'United States',NULL,'["Creator account management"]'::jsonb),
 ('lambert-agency','https://agencylambert.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": null, "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "contact_channel": "Telegram @lambert_agency", "sources": ["https://agencylambert.com/", "https://t.me/lambert_agency"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Fan messaging", "Content planning"]'::jsonb),
 ('empire-of-agency','https://www.empireofagency.com/','{"legal_name": "Empire of Agency", "registration_number": "893032946 (agency-reported; registry verification pending)", "registered_address": null, "public_email": "legal@empireofagency.com", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "email_purpose": "Legal contact", "note": "Host/provider address has been excluded; it is not an agency address.", "sources": ["https://www.empireofagency.com/", "https://www.empireofagency.com/legal"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,'France','Paris','["Creator account management", "Performance reporting"]'::jsonb),
 ('elev-agency','https://elev.agency/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": "ethan@elev-agency.com", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://elev.agency/", "https://elev.agency/about"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Social media support"]'::jsonb),
 ('ofagency-co','https://www.ofagency.co/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": null, "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "sources": ["https://www.ofagency.co/", "https://www.ofagency.co/about", "https://www.ofagency.co/contact"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Fan messaging", "Content strategy"]'::jsonb),
 ('tdm-business','https://tdmbusiness.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": "info@tdmbusiness.com", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "operating_locations": ["United States", "United Kingdom"], "sources": ["https://tdmbusiness.com/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management"]'::jsonb),
 ('ofm-models-agency','https://www.onlyfansmanagement.info/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": "modelsagency.ofm@gmail.com", "public_phone": null, "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "contact_channel": "Telegram @jfhello", "sources": ["https://www.onlyfansmanagement.info/"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Fan messaging"]'::jsonb),
 ('beaconofm','https://beaconofm.com/','{"legal_name": null, "registration_number": null, "registered_address": null, "public_email": "contact@beaconofm.com", "public_phone": "+995 591 268799", "founded_year": null, "team_size": null, "languages": null, "markets_served": null, "note": "Website publishes Gudauri Village, street 7, number 12; address type and country require confirmation. Registered legal entity is not confirmed. Phone country code is not headquarters evidence.", "sources": ["https://beaconofm.com/", "https://beaconofm.com/about"], "checked_on": "2026-10-10", "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"}'::jsonb,NULL,NULL,'["Creator account management", "Fan messaging"]'::jsonb)
)
UPDATE public.ap_agencies a SET directory_information=r.information,
 country=coalesce(nullif(a.country,''),r.country),city=coalesce(nullif(a.city,''),r.city),
 services=case when coalesce(cardinality(a.services),0)=0 then array(select jsonb_array_elements_text(r.services)) else a.services end
FROM researched r WHERE a.slug=r.slug AND a.website_url=r.website_url AND NOT a.demo_profile
 AND a.directory_information='{}'::jsonb
 AND NOT EXISTS(SELECT 1 FROM public.ap_agency_memberships m WHERE m.agency_id=a.id AND m.role='owner' AND m.status='active');
COMMIT;

```

## research/researched-profiles.json

```json
[
  {
    "id": 1,
    "name": "Creators Inc",
    "website_url": "https://www.creatorsinc.com/",
    "description": "Creators Inc describes its services as account management, content planning, fan relationships and creator brand development.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.creatorsinc.com/",
    "slug": "creators-inc",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.creatorsinc.com/",
        "https://www.creatorsinc.com/contact/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Content planning"
    ],
    "social_links": {}
  },
  {
    "id": 2,
    "name": "FansHub",
    "website_url": "https://www.usefanshub.com/",
    "description": "FansHub describes its services as account management, fan messaging, marketing, content strategy and content protection.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.usefanshub.com/",
    "slug": "fanshub",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "operating_locations": [
        "United Kingdom",
        "United States"
      ],
      "sources": [
        "https://www.usefanshub.com/",
        "https://www.usefanshub.com/services/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Creator marketing",
      "Content strategy"
    ],
    "social_links": {}
  },
  {
    "id": 3,
    "name": "Sakura Management",
    "website_url": "https://www.sakura.agency/",
    "description": "Sakura Management describes its services as creator account management, social media marketing, fan messaging and leak protection.",
    "country": "United States",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.sakura.agency/",
    "slug": "sakura-management",
    "city": "Los Angeles",
    "directory_information": {
      "legal_name": "Sakura Management LLC",
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.sakura.agency/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Creator marketing",
      "Social media support",
      "Leak protection"
    ],
    "social_links": {}
  },
  {
    "id": 4,
    "name": "TEASY Agency",
    "website_url": "https://teasyagency.com/",
    "description": "TEASY Agency describes its services as onlyFans management and marketing services for creator accounts.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://teasyagency.com/",
    "slug": "teasy-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "team@teasyagency.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://teasyagency.com/",
        "https://teasyagency.com/contact-us/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Creator marketing"
    ],
    "social_links": {}
  },
  {
    "id": 5,
    "name": "Bunny Agency",
    "website_url": "https://bunny-agency.com/",
    "description": "Bunny Agency describes its services as creator account management, fan communication and marketing across subscription platforms.",
    "country": "United States",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://bunny-agency.com/",
    "slug": "bunny-agency",
    "city": null,
    "directory_information": {
      "legal_name": "Bunny Agency LLC",
      "registration_number": null,
      "registered_address": "1309 Coffeen Avenue STE 1200, Sheridan, Wyoming 82801, USA",
      "public_email": "info@bunny-agency.com",
      "public_phone": null,
      "founded_year": 2019,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "operating_locations": [
        "Florida, USA"
      ],
      "sources": [
        "https://bunny-agency.com/",
        "https://bunny-agency.com/impressum/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "public_phone",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Subscriber communication",
      "Creator marketing"
    ],
    "social_links": {}
  },
  {
    "id": 6,
    "name": "Louna's Models",
    "website_url": "https://lounasmodels.com/",
    "description": "Louna's Models describes its services as onlyFans management, social media traffic, content planning and subscriber retention.",
    "country": "United States",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://lounasmodels.com/",
    "slug": "louna-s-models",
    "city": "Los Angeles",
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": 2018,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://lounasmodels.com/",
        "https://lounasmodels.com/contact"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Content planning",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 7,
    "name": "MANGO",
    "website_url": "https://www.mangova.agency/",
    "description": "MANGO describes its services as onlyFans management focused on developing an existing creator account.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.mangova.agency/",
    "slug": "mango",
    "city": null,
    "directory_information": {
      "legal_name": "AG Media Pro LLC",
      "registration_number": "Wyoming filing 2025-001664576",
      "registered_address": "5830 E 2nd St, Ste 7000 #24316, Casper, Wyoming 82609, USA",
      "public_email": "mangova.agency@gmail.com",
      "public_phone": null,
      "founded_year": 2025,
      "team_size": "16 (agency-reported)",
      "languages": [
        "English",
        "Spanish"
      ],
      "markets_served": [
        "Europe",
        "Asia"
      ],
      "note": "Agency states business founded April 2025 and operations started June 2025.",
      "sources": [
        "https://www.mangova.agency/",
        "https://www.mangova.agency/about"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "public_phone",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 8,
    "name": "FantasyRise",
    "website_url": "https://fantasyrise.com/",
    "description": "FantasyRise describes its services as account management, fan messaging, pricing, content planning, marketing and reporting.",
    "country": "United States",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://fantasyrise.com/",
    "slug": "fantasyrise",
    "city": "Jacksonville",
    "directory_information": {
      "legal_name": "FantasyRise LLC",
      "registration_number": "Wyoming filing 2024-001405482",
      "registered_address": null,
      "public_email": "contact@fantasyrise.com",
      "public_phone": null,
      "founded_year": 2021,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "note": "Agency states operations since 2021; LLC formation is stated as 2024. These are separate dates.",
      "sources": [
        "https://fantasyrise.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registered_address",
      "public_phone",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Creator marketing",
      "Content planning",
      "Performance reporting"
    ],
    "social_links": {}
  },
  {
    "id": 9,
    "name": "OnModelStudios",
    "website_url": "https://onmodelstudios.com/",
    "description": "OnModelStudios describes its services as account management, fan messaging, creator marketing and performance reporting.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://onmodelstudios.com/about",
    "slug": "onmodelstudios",
    "city": null,
    "directory_information": {
      "legal_name": "ON INTERNATIONAL BUSINESS LLC",
      "registration_number": "Florida document L22000521896",
      "registered_address": "2880 W Oakland Park Blvd, Suite 225C, Oakland Park, FL 33311, USA",
      "public_email": "management@on-studios.com",
      "public_phone": null,
      "founded_year": 2021,
      "team_size": "35+ (agency-reported)",
      "languages": [
        "English",
        "German"
      ],
      "markets_served": null,
      "sources": [
        "https://onmodelstudios.com/",
        "https://onmodelstudios.com/about",
        "https://onmodelstudios.com/legal-notice"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "public_phone",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Creator marketing",
      "Performance reporting"
    ],
    "social_links": {}
  },
  {
    "id": 10,
    "name": "Perlage Studios",
    "website_url": "https://perlagestudios.com/",
    "description": "Perlage Studios describes its services as boutique OnlyFans management with content planning, messaging, marketing and reporting.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://perlagestudios.com/",
    "slug": "perlage-studios",
    "city": null,
    "directory_information": {
      "legal_name": "Perlage Studios Marketing Agency LLC",
      "registration_number": null,
      "registered_address": "2880 W Oakland Park Blvd, Suite 225C, Oakland Park, FL 33311, USA",
      "public_email": "perlagestudios@gmail.com",
      "public_phone": "+43 664 75080133",
      "founded_year": 2021,
      "team_size": null,
      "languages": [
        "English",
        "German"
      ],
      "markets_served": null,
      "sources": [
        "https://perlagestudios.com/",
        "https://perlagestudios.com/impressum"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "team_size",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Creator marketing",
      "Content planning",
      "Performance reporting"
    ],
    "social_links": {}
  },
  {
    "id": 11,
    "name": "Lumina Connect",
    "website_url": "https://lumina-connect.com/",
    "description": "Lumina Connect describes its services as account management, fan messaging, content planning, marketing and leak removal.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://lumina-connect.com/",
    "slug": "lumina-connect",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": "VAT DE451305405",
      "registered_address": "Bremerkampstraße 4, 49610 Quakenbrück, Germany",
      "public_email": "luminaconnected@gmail.com",
      "public_phone": null,
      "founded_year": 2021,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "note": "Imprint names Tom Hehler. Registered legal form has not been confirmed.",
      "sources": [
        "https://lumina-connect.com/",
        "https://lumina-connect.com/imprint"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "public_phone",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Creator marketing",
      "Content planning",
      "Leak protection"
    ],
    "social_links": {}
  },
  {
    "id": 12,
    "name": "Foxy Studios",
    "website_url": "https://foxy-studios.com/",
    "description": "Foxy Studios describes its services as creator management, social media strategy, content planning and fan engagement.",
    "country": "Switzerland",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://foxy-studios.com/",
    "slug": "foxy-studios",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "hello@foxy-studios.com",
      "public_phone": "+41 79 744 21 11",
      "founded_year": 2021,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://foxy-studios.com/",
        "https://foxy-studios.com/contact"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Content planning",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 13,
    "name": "Aruna Talent",
    "website_url": "https://arunatalent.com/",
    "description": "Aruna Talent describes its services as creator management with fan messaging, marketing, content strategy and privacy support.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://arunatalent.com/",
    "slug": "aruna-talent",
    "city": null,
    "directory_information": {
      "legal_name": "Aruna Talent LLC",
      "registration_number": null,
      "registered_address": null,
      "public_email": "intake@arunatalent.com",
      "public_phone": null,
      "founded_year": 2022,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "note": "Agency identifies a Wyoming LLC; registration number and street address require confirmation.",
      "sources": [
        "https://arunatalent.com/",
        "https://arunatalent.com/about"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "registered_address",
      "public_phone",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Creator marketing",
      "Content strategy",
      "Privacy support"
    ],
    "social_links": {}
  },
  {
    "id": 14,
    "name": "Hush Talent Inc.",
    "website_url": "https://hushtalentinc.com/",
    "description": "Hush Talent Inc. describes its services as creator management across OnlyFans and other subscription and social platforms.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://hushtalentinc.com/",
    "slug": "hush-talent-inc",
    "city": null,
    "directory_information": {
      "legal_name": "Hush Talent Inc.",
      "registration_number": null,
      "registered_address": null,
      "public_email": "apps@hushtalentinc.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "email_purpose": "Creator applications",
      "operating_locations": [
        "Connecticut, USA",
        "New York, USA",
        "Los Angeles, USA"
      ],
      "note": "Agency states incorporation in California; full registered address and company number not confirmed.",
      "sources": [
        "https://hushtalentinc.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 15,
    "name": "SirenCY",
    "website_url": "https://www.sirency.com/",
    "description": "SirenCY describes its services as content planning, fan messaging workflows, monetization strategy and account operations.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.sirency.com/",
    "slug": "sirency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "anyro@sirency.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "email_purpose": "Partnership contact",
      "sources": [
        "https://www.sirency.com/",
        "https://www.sirency.com/contact"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Fan messaging",
      "Content planning"
    ],
    "social_links": {}
  },
  {
    "id": 16,
    "name": "TopStar MGMT",
    "website_url": "https://www.topstarmgmt.com/",
    "description": "TopStar MGMT describes its services as account management, content strategy, fan messaging, brand development and social media.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.topstarmgmt.com/",
    "slug": "topstar-mgmt",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.topstarmgmt.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Content strategy",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 17,
    "name": "AROA Agency",
    "website_url": "https://aroaagency.com/",
    "description": "AROA Agency describes its services as onlyFans management, fan messaging, content calendars, branding and audience growth.",
    "country": "United States",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://aroaagency.com/",
    "slug": "aroa-agency",
    "city": "Miami",
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "office@aroaagency.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://aroaagency.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging"
    ],
    "social_links": {}
  },
  {
    "id": 18,
    "name": "AT Agency",
    "website_url": "https://at-agency.co/",
    "description": "AT Agency describes its services as creator account operations, content planning, fan engagement and audience development.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://at-agency.co/",
    "slug": "at-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://at-agency.co/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Content planning"
    ],
    "social_links": {}
  },
  {
    "id": 19,
    "name": "XCreatorMgmt",
    "website_url": "https://www.xcreatormgmt.com/",
    "description": "XCreatorMgmt describes its services as account management, social media marketing, content ideas and subscriber communication.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.xcreatormgmt.com/",
    "slug": "xcreatormgmt",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "yourfriends@xcreatormgmt.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.xcreatormgmt.com/",
        "https://www.xcreatormgmt.com/contact"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Subscriber communication",
      "Creator marketing",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 20,
    "name": "Vanguard Star Management",
    "website_url": "https://vsmagency.com/",
    "description": "Vanguard Star Management describes its services as onlyFans management, marketing, fan messaging, content strategy and brand protection.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://vsmagency.com/",
    "slug": "vanguard-star-management",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://vsmagency.com/",
        "https://vsmagency.com/contact"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Creator marketing",
      "Content strategy"
    ],
    "social_links": {}
  },
  {
    "id": 21,
    "name": "Model Starz",
    "website_url": "https://www.modelstarzmgmt.com/",
    "description": "Model Starz describes its services as onlyFans and Fansly creator management, content strategy and audience promotion.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.modelstarzmgmt.com/",
    "slug": "model-starz",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": [
        "United States",
        "Europe",
        "Asia"
      ],
      "sources": [
        "https://www.modelstarzmgmt.com/",
        "https://www.modelstarzmgmt.com/contact"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Content strategy"
    ],
    "social_links": {}
  },
  {
    "id": 22,
    "name": "Vantage Agency",
    "website_url": "https://thevantage.agency/",
    "description": "Vantage Agency describes its services as creator brand management across subscription platforms, social media and fan communities.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://thevantage.agency/",
    "slug": "vantage-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "hello@thevantage.agency",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://thevantage.agency/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 23,
    "name": "Lush Management",
    "website_url": "https://www.lushmgt.com/",
    "description": "Lush Management describes its services as onlyFans account management, content posting, subscriber messaging and social media support.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.lushmgt.com/",
    "slug": "lush-management",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "info@lushmgt.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.lushmgt.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 24,
    "name": "Rize Agency",
    "website_url": "https://rizeagency.co/",
    "description": "Rize Agency describes its services as creator growth management with social media promotion and subscriber conversion.",
    "country": "United Kingdom",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://rizeagency.co/",
    "slug": "rize-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://rizeagency.co/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 25,
    "name": "Hussar OFM",
    "website_url": "https://www.hussarofm.com/",
    "description": "Hussar OFM describes its services as onlyFans account management, fan messaging, content planning, growth and administration.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.hussarofm.com/",
    "slug": "hussar-ofm",
    "city": null,
    "directory_information": {
      "legal_name": "Hussar Technology",
      "registration_number": null,
      "registered_address": null,
      "public_email": "info@hussarofm.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "operating_locations": [
        "New York City, USA",
        "Warsaw, Poland"
      ],
      "note": "Agency describes a Polish sole proprietorship (JDG); company registration number not confirmed.",
      "sources": [
        "https://www.hussarofm.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Content planning"
    ],
    "social_links": {}
  },
  {
    "id": 26,
    "name": "Lookstars Agency",
    "website_url": "https://www.lookstarsagency.com/en",
    "description": "Lookstars Agency describes its services as boutique OnlyFans management with fan engagement and social media marketing.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.lookstarsagency.com/en",
    "slug": "lookstars-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "info@lookstarsagency.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": [
        "Europe"
      ],
      "sources": [
        "https://www.lookstarsagency.com/en",
        "https://www.lookstarsagency.com/en/about-us"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Creator marketing",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 27,
    "name": "EROS Agency",
    "website_url": "https://www.agency-eros.com/",
    "description": "EROS Agency describes its services as onlyFans account management, fan monetization, audience growth and creator brand strategy.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.agency-eros.com/",
    "slug": "eros-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.agency-eros.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 28,
    "name": "SVJ Talent",
    "website_url": "https://svjtalent.com/",
    "description": "SVJ Talent describes its services as chatting-focused creator management with fan messaging and account communication support.",
    "country": "United States",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://svjtalent.com/",
    "slug": "svj-talent",
    "city": "Boise",
    "directory_information": {
      "legal_name": "SVJ Talent LLC",
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "note": "Specialist chat service; content production and social marketing are not offered.",
      "sources": [
        "https://svjtalent.com/",
        "https://svjtalent.com/about"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Fan messaging",
      "Chat operations"
    ],
    "social_links": {}
  },
  {
    "id": 29,
    "name": "OnlyFans Management (Australia)",
    "website_url": "https://onlyfansmanagement.com.au/",
    "description": "OnlyFans Management (Australia) describes its services as creator management with account strategy, marketing and ongoing account support.",
    "country": "Australia",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://onlyfansmanagement.com.au/",
    "slug": "onlyfans-management-australia",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": 2022,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://onlyfansmanagement.com.au/",
        "https://onlyfansmanagement.com.au/contact/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Creator marketing"
    ],
    "social_links": {}
  },
  {
    "id": 30,
    "name": "FEM Management",
    "website_url": "https://www.fem-management.com/",
    "description": "FEM Management describes its services as onlyFans management with fan messaging, content ideas, promotion and leak protection.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.fem-management.com/",
    "slug": "fem-management",
    "city": null,
    "directory_information": {
      "legal_name": "FTD Media LLC",
      "registration_number": "EIN 92-1332408 (tax identifier; not a company registration number)",
      "registered_address": "3833 Powerline Rd, Suite 301-B, Fort Lauderdale, FL 33309, USA",
      "public_email": "info@fem-management.com",
      "public_phone": "+43 665 65677423",
      "founded_year": 2022,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.fem-management.com/",
        "https://www.fem-management.com/imprint"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Leak protection"
    ],
    "social_links": {}
  },
  {
    "id": 31,
    "name": "Aura Management",
    "website_url": "https://www.auramgmt.com.au/",
    "description": "Aura Management describes its services as australian creator talent management and OnlyFans account support.",
    "country": "Australia",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.auramgmt.com.au/",
    "slug": "aura-management",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "note": "Website states Australian registered and owned; legal entity details require confirmation.",
      "sources": [
        "https://www.auramgmt.com.au/",
        "https://www.auramgmt.com.au/talentenquiry"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 32,
    "name": "Nest Talent",
    "website_url": "https://www.nesttalent.com/",
    "description": "Nest Talent describes its services as creator account strategy, social media growth, audience engagement and operational support.",
    "country": "Australia",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.nesttalent.com/",
    "slug": "nest-talent",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "hello@nesttalent.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.nesttalent.com/",
        "https://www.nesttalent.com/about-us"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 33,
    "name": "Blue Rose Talent",
    "website_url": "https://bluerosetalent.com/",
    "description": "Blue Rose Talent describes its services as creator career management and support for OnlyFans and other creator platforms.",
    "country": "Australia",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://bluerosetalent.com/",
    "slug": "blue-rose-talent",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "info@bluerosetalent.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://bluerosetalent.com/",
        "https://bluerosetalent.com/contact"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 34,
    "name": "The Scandilo Agency",
    "website_url": "https://scandiloagency.com/",
    "description": "The Scandilo Agency describes its services as onlyFans management with promotion, fan messaging and a personal account manager.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://scandiloagency.com/",
    "slug": "the-scandilo-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": [
        "Scandinavia",
        "Europe"
      ],
      "sources": [
        "https://scandiloagency.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging"
    ],
    "social_links": {}
  },
  {
    "id": 35,
    "name": "ALLURE",
    "website_url": "https://www.allureagencyparis.com/en",
    "description": "ALLURE describes its services as creator management with account operations, social media traffic and growth strategy.",
    "country": "France",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.allureagencyparis.com/en",
    "slug": "allure",
    "city": "Paris",
    "directory_information": {
      "legal_name": "ALLURE SAS",
      "registration_number": null,
      "registered_address": null,
      "public_email": "allure.agency.paris@gmail.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "email_purpose": "Privacy contact",
      "sources": [
        "https://www.allureagencyparis.com/en",
        "https://www.allureagencyparis.com/mentions-legales"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 36,
    "name": "Unfiltered Management",
    "website_url": "https://www.unfiltered-management.com/",
    "description": "Unfiltered Management describes its services as onlyFans creator management, account strategy and support for switching agency teams.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.unfiltered-management.com/services/agency-switch",
    "slug": "unfiltered-management",
    "city": null,
    "directory_information": {
      "legal_name": "UNLIMITED STUDIOS CONSULTING LLC",
      "registration_number": null,
      "registered_address": "2880 W Oakland Park Blvd, STE 225C, Oakland Park, FL 33311, USA",
      "public_email": "info@unfiltered-management.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "operating_locations": [
        "Miami, USA",
        "Berlin, Germany",
        "Poland"
      ],
      "sources": [
        "https://www.unfiltered-management.com/",
        "https://www.unfiltered-management.com/services/agency-switch",
        "https://www.unfiltered-management.com/imprint"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 37,
    "name": "Xentra Group",
    "website_url": "https://xentragroup.co.uk/onlyfans-agency-uk",
    "description": "Xentra Group describes its services as onlyFans creator management with fan messaging, account strategy and audience growth.",
    "country": "United Kingdom",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://xentragroup.co.uk/onlyfans-agency-uk",
    "slug": "xentra-group",
    "city": null,
    "directory_information": {
      "legal_name": "CoachFlo Ltd",
      "registration_number": null,
      "registered_address": null,
      "public_email": "admin@xentragroup.co.uk",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://xentragroup.co.uk/onlyfans-agency-uk"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging"
    ],
    "social_links": {}
  },
  {
    "id": 38,
    "name": "Elvision Studios",
    "website_url": "https://elvision-studios.com/en/europe/united-kingdom",
    "description": "Elvision Studios describes its services as remote OnlyFans management for creators, including support for UK-based accounts.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://elvision-studios.com/en/europe/united-kingdom",
    "slug": "elvision-studios",
    "city": null,
    "directory_information": {
      "legal_name": "Elvision LLC",
      "registration_number": null,
      "registered_address": "30 N Gould St, Ste N, Sheridan, Wyoming 82801, USA",
      "public_email": "contact@elvision-studios.com",
      "public_phone": "+49 1577 3840073",
      "founded_year": 2022,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "note": "Registered address is not an operational headquarters. UK landing page indicates a service market, not headquarters.",
      "sources": [
        "https://elvision-studios.com/en/europe/united-kingdom",
        "https://uk.elvision-studios.com/imprint"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 39,
    "name": "Shevo Studio",
    "website_url": "https://www.shevostudio.com/",
    "description": "Shevo Studio describes its services as onlyFans and Fansly account management with fan retention and social media marketing.",
    "country": "United Kingdom",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.shevostudio.com/",
    "slug": "shevo-studio",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.shevostudio.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Creator marketing",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 40,
    "name": "Norvo Management",
    "website_url": "https://norvomanagement.com/",
    "description": "Norvo Management describes its services as onlyFans management with fan messaging, content strategy and creator growth planning.",
    "country": "United Kingdom",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://norvomanagement.com/",
    "slug": "norvo-management",
    "city": null,
    "directory_information": {
      "legal_name": "Norvo Ltd",
      "registration_number": "England and Wales company 17416436",
      "registered_address": null,
      "public_email": "contact@norvomanagement.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://norvomanagement.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Content strategy"
    ],
    "social_links": {}
  },
  {
    "id": 41,
    "name": "Creator House",
    "website_url": "https://creatorhouse.agency/",
    "description": "Creator House describes its services as creator management with social media strategy, fan messaging and privacy support.",
    "country": "Spain",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://creatorhouse.agency/",
    "slug": "creator-house",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "hello@creatorhouse.agency",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": [
        "Argentina",
        "Mexico"
      ],
      "sources": [
        "https://creatorhouse.agency/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Social media support",
      "Privacy support"
    ],
    "social_links": {}
  },
  {
    "id": 42,
    "name": "20MG",
    "website_url": "https://20mg.co/",
    "description": "20MG describes its services as onlyFans creator management and growth services for international creator accounts.",
    "country": "United States",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://20mg.co/",
    "slug": "20mg",
    "city": null,
    "directory_information": {
      "legal_name": "Twenty Management Group LLC",
      "registration_number": null,
      "registered_address": null,
      "public_email": "hello@20mg.co",
      "public_phone": "+1 332 265 3480",
      "founded_year": 2025,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://20mg.co/",
        "https://20mg.co/about"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registration_number",
      "registered_address",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 43,
    "name": "TOAgency",
    "website_url": "https://theonlyfans.agency/",
    "description": "TOAgency describes its services as creator account management with strategic content planning and ongoing fan engagement.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://theonlyfans.agency/",
    "slug": "toagency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "note": "Contact page contains stock-template address, phone and noreply@envato.com. Identity and usable contact need direct confirmation. Do not import until reviewed.",
      "sources": [
        "https://theonlyfans.agency/",
        "https://theonlyfans.agency/contact/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "hold — direct confirmation required",
    "services": [
      "Creator account management",
      "Content planning"
    ],
    "social_links": {}
  },
  {
    "id": 44,
    "name": "Lambert Agency",
    "website_url": "https://agencylambert.com/",
    "description": "Lambert Agency describes its services as onlyFans management with content planning, fan messaging and audience acquisition.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://agencylambert.com/",
    "slug": "lambert-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "contact_channel": "Telegram @lambert_agency",
      "sources": [
        "https://agencylambert.com/",
        "https://t.me/lambert_agency"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Content planning"
    ],
    "social_links": {}
  },
  {
    "id": 45,
    "name": "Empire of Agency",
    "website_url": "https://www.empireofagency.com/",
    "description": "Empire of Agency describes its services as creator management covering strategy, distribution, fan operations and reporting.",
    "country": "France",
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.empireofagency.com/",
    "slug": "empire-of-agency",
    "city": "Paris",
    "directory_information": {
      "legal_name": "Empire of Agency",
      "registration_number": "893032946 (agency-reported; registry verification pending)",
      "registered_address": null,
      "public_email": "legal@empireofagency.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "email_purpose": "Legal contact",
      "note": "Host/provider address has been excluded; it is not an agency address.",
      "sources": [
        "https://www.empireofagency.com/",
        "https://www.empireofagency.com/legal"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Performance reporting"
    ],
    "social_links": {}
  },
  {
    "id": 46,
    "name": "Elev Agency",
    "website_url": "https://elev.agency/",
    "description": "Elev Agency describes its services as creator management, social media planning and fan engagement services.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://elev.agency/",
    "slug": "elev-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "ethan@elev-agency.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://elev.agency/",
        "https://elev.agency/about"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Social media support"
    ],
    "social_links": {}
  },
  {
    "id": 47,
    "name": "OFAgency.co",
    "website_url": "https://www.ofagency.co/",
    "description": "OFAgency.co describes its services as onlyFans account management, traffic acquisition, fan messaging and content strategy.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.ofagency.co/about",
    "slug": "ofagency-co",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": null,
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "sources": [
        "https://www.ofagency.co/",
        "https://www.ofagency.co/about",
        "https://www.ofagency.co/contact"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_email",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging",
      "Content strategy"
    ],
    "social_links": {}
  },
  {
    "id": 48,
    "name": "TDM Business",
    "website_url": "https://tdmbusiness.com/",
    "description": "TDM Business describes its services as onlyFans management and support services for creators and agency businesses.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://tdmbusiness.com/",
    "slug": "tdm-business",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "info@tdmbusiness.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "operating_locations": [
        "United States",
        "United Kingdom"
      ],
      "sources": [
        "https://tdmbusiness.com/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management"
    ],
    "social_links": {}
  },
  {
    "id": 49,
    "name": "OFM Models Agency",
    "website_url": "https://www.onlyfansmanagement.info/",
    "description": "OFM Models Agency describes its services as OnlyFans account management, fan messaging, profile growth and mentoring.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://www.onlyfansmanagement.info/",
    "slug": "ofm-models-agency",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "modelsagency.ofm@gmail.com",
      "public_phone": null,
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "contact_channel": "Telegram @jfhello",
      "sources": [
        "https://www.onlyfansmanagement.info/"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "registered_address",
      "public_phone",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging"
    ],
    "social_links": {}
  },
  {
    "id": 50,
    "name": "BeaconOFM",
    "website_url": "https://beaconofm.com/",
    "description": "BeaconOFM describes its services as creator management with fan messaging, traffic strategy and an AI content production offering.",
    "country": null,
    "checked_on": "2026-10-10",
    "ownership": "unclaimed",
    "verification": "public website evidence; business credentials not independently certified",
    "source_url": "https://beaconofm.com/",
    "slug": "beaconofm",
    "city": null,
    "directory_information": {
      "legal_name": null,
      "registration_number": null,
      "registered_address": null,
      "public_email": "contact@beaconofm.com",
      "public_phone": "+995 591 268799",
      "founded_year": null,
      "team_size": null,
      "languages": null,
      "markets_served": null,
      "note": "Website publishes Gudauri Village, street 7, number 12; address type and country require confirmation. Registered legal entity is not confirmed. Phone country code is not headquarters evidence.",
      "sources": [
        "https://beaconofm.com/",
        "https://beaconofm.com/about"
      ],
      "checked_on": "2026-10-10",
      "evidence_status": "Agency website statements; registry, contact reachability and ownership not independently verified"
    },
    "missing_information": [
      "legal_name",
      "registration_number",
      "founded_year",
      "team_size",
      "languages",
      "markets_served",
      "social_links",
      "pricing",
      "minimum_requirements",
      "creator_niches",
      "registered_address"
    ],
    "publication_review": "candidate — owner source review required",
    "services": [
      "Creator account management",
      "Fan messaging"
    ],
    "social_links": {}
  }
]

```

## research/source-audit.md

```text
# 50 agency candidates — source audit
Checked: 10 October 2026

Public-source candidates, not independently certified businesses. 32 publish an email in inspected official pages; some are application, privacy or legal contacts. 18 state a legal business name. All 50 still have missing information. TOAgency is on hold: its contact page contains stock-template details. Reviewed import therefore contains 49 candidates.

Missing facts are null in JSON and display as Not yet confirmed. Registration and address statements are agency-reported; they have not been checked against company registries. Tax identifiers are labelled separately. Do not infer headquarters from a landing page, registered address or phone code. Public websites alone cannot establish legitimacy or ownership.

## Claim review
Confirm business identity against public registries or appropriate business documents. Verify the representative's authority. Independently contact the agency through a channel you found yourself, using a domain email challenge or website token where possible. A Google/Gmail login does not prove company ownership. Compare the saved profile, requested corrections and current facts; resolve material gaps before approval. Save corrections with a source and review explanation. Approve only after all four checks. Claim approval grants ownership of the existing profile, not a verification badge.

## Records

### 1. Creators Inc
- Status: candidate — owner source review required
- Website: https://www.creatorsinc.com/
- About: Creators Inc describes its services as account management, content planning, fan relationships and creator brand development.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.creatorsinc.com/
  - https://www.creatorsinc.com/contact/

### 2. FansHub
- Status: candidate — owner source review required
- Website: https://www.usefanshub.com/
- About: FansHub describes its services as account management, fan messaging, marketing, content strategy and content protection.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: United Kingdom, United States
- Official sources:
  - https://www.usefanshub.com/
  - https://www.usefanshub.com/services/

### 3. Sakura Management
- Status: candidate — owner source review required
- Website: https://www.sakura.agency/
- About: Sakura Management describes its services as creator account management, social media marketing, fan messaging and leak protection.
- Headquarters: Los Angeles, United States
- legal name: Sakura Management LLC
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.sakura.agency/

### 4. TEASY Agency
- Status: candidate — owner source review required
- Website: https://teasyagency.com/
- About: TEASY Agency describes its services as onlyFans management and marketing services for creator accounts.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: team@teasyagency.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://teasyagency.com/
  - https://teasyagency.com/contact-us/

### 5. Bunny Agency
- Status: candidate — owner source review required
- Website: https://bunny-agency.com/
- About: Bunny Agency describes its services as creator account management, fan communication and marketing across subscription platforms.
- Headquarters: United States
- legal name: Bunny Agency LLC
- registration number: Not yet confirmed
- registered address: 1309 Coffeen Avenue STE 1200, Sheridan, Wyoming 82801, USA
- public email: info@bunny-agency.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: 2019
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Florida, USA
- Official sources:
  - https://bunny-agency.com/
  - https://bunny-agency.com/impressum/

### 6. Louna's Models
- Status: candidate — owner source review required
- Website: https://lounasmodels.com/
- About: Louna's Models describes its services as onlyFans management, social media traffic, content planning and subscriber retention.
- Headquarters: Los Angeles, United States
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: 2018
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://lounasmodels.com/
  - https://lounasmodels.com/contact

### 7. MANGO
- Status: candidate — owner source review required
- Website: https://www.mangova.agency/
- About: MANGO describes its services as onlyFans management focused on developing an existing creator account.
- Headquarters: Not yet confirmed
- legal name: AG Media Pro LLC
- registration number: Wyoming filing 2025-001664576
- registered address: 5830 E 2nd St, Ste 7000 #24316, Casper, Wyoming 82609, USA
- public email: mangova.agency@gmail.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: 2025
- team size: 16 (agency-reported)
- languages: English, Spanish
- markets served: Europe, Asia
- operating locations: Not yet confirmed
- Note: Agency states business founded April 2025 and operations started June 2025.
- Official sources:
  - https://www.mangova.agency/
  - https://www.mangova.agency/about

### 8. FantasyRise
- Status: candidate — owner source review required
- Website: https://fantasyrise.com/
- About: FantasyRise describes its services as account management, fan messaging, pricing, content planning, marketing and reporting.
- Headquarters: Jacksonville, United States
- legal name: FantasyRise LLC
- registration number: Wyoming filing 2024-001405482
- registered address: Not yet confirmed
- public email: contact@fantasyrise.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: 2021
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Agency states operations since 2021; LLC formation is stated as 2024. These are separate dates.
- Official sources:
  - https://fantasyrise.com/

### 9. OnModelStudios
- Status: candidate — owner source review required
- Website: https://onmodelstudios.com/
- About: OnModelStudios describes its services as account management, fan messaging, creator marketing and performance reporting.
- Headquarters: Not yet confirmed
- legal name: ON INTERNATIONAL BUSINESS LLC
- registration number: Florida document L22000521896
- registered address: 2880 W Oakland Park Blvd, Suite 225C, Oakland Park, FL 33311, USA
- public email: management@on-studios.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: 2021
- team size: 35+ (agency-reported)
- languages: English, German
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://onmodelstudios.com/
  - https://onmodelstudios.com/about
  - https://onmodelstudios.com/legal-notice

### 10. Perlage Studios
- Status: candidate — owner source review required
- Website: https://perlagestudios.com/
- About: Perlage Studios describes its services as boutique OnlyFans management with content planning, messaging, marketing and reporting.
- Headquarters: Not yet confirmed
- legal name: Perlage Studios Marketing Agency LLC
- registration number: Not yet confirmed
- registered address: 2880 W Oakland Park Blvd, Suite 225C, Oakland Park, FL 33311, USA
- public email: perlagestudios@gmail.com
- email purpose: Not yet confirmed
- public phone: +43 664 75080133
- contact channel: Not yet confirmed
- founded year: 2021
- team size: Not yet confirmed
- languages: English, German
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://perlagestudios.com/
  - https://perlagestudios.com/impressum

### 11. Lumina Connect
- Status: candidate — owner source review required
- Website: https://lumina-connect.com/
- About: Lumina Connect describes its services as account management, fan messaging, content planning, marketing and leak removal.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: VAT DE451305405
- registered address: Bremerkampstraße 4, 49610 Quakenbrück, Germany
- public email: luminaconnected@gmail.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: 2021
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Imprint names Tom Hehler. Registered legal form has not been confirmed.
- Official sources:
  - https://lumina-connect.com/
  - https://lumina-connect.com/imprint

### 12. Foxy Studios
- Status: candidate — owner source review required
- Website: https://foxy-studios.com/
- About: Foxy Studios describes its services as creator management, social media strategy, content planning and fan engagement.
- Headquarters: Switzerland
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: hello@foxy-studios.com
- email purpose: Not yet confirmed
- public phone: +41 79 744 21 11
- contact channel: Not yet confirmed
- founded year: 2021
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://foxy-studios.com/
  - https://foxy-studios.com/contact

### 13. Aruna Talent
- Status: candidate — owner source review required
- Website: https://arunatalent.com/
- About: Aruna Talent describes its services as creator management with fan messaging, marketing, content strategy and privacy support.
- Headquarters: Not yet confirmed
- legal name: Aruna Talent LLC
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: intake@arunatalent.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: 2022
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Agency identifies a Wyoming LLC; registration number and street address require confirmation.
- Official sources:
  - https://arunatalent.com/
  - https://arunatalent.com/about

### 14. Hush Talent Inc.
- Status: candidate — owner source review required
- Website: https://hushtalentinc.com/
- About: Hush Talent Inc. describes its services as creator management across OnlyFans and other subscription and social platforms.
- Headquarters: Not yet confirmed
- legal name: Hush Talent Inc.
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: apps@hushtalentinc.com
- email purpose: Creator applications
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Connecticut, USA, New York, USA, Los Angeles, USA
- Note: Agency states incorporation in California; full registered address and company number not confirmed.
- Official sources:
  - https://hushtalentinc.com/

### 15. SirenCY
- Status: candidate — owner source review required
- Website: https://www.sirency.com/
- About: SirenCY describes its services as content planning, fan messaging workflows, monetization strategy and account operations.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: anyro@sirency.com
- email purpose: Partnership contact
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.sirency.com/
  - https://www.sirency.com/contact

### 16. TopStar MGMT
- Status: candidate — owner source review required
- Website: https://www.topstarmgmt.com/
- About: TopStar MGMT describes its services as account management, content strategy, fan messaging, brand development and social media.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.topstarmgmt.com/

### 17. AROA Agency
- Status: candidate — owner source review required
- Website: https://aroaagency.com/
- About: AROA Agency describes its services as onlyFans management, fan messaging, content calendars, branding and audience growth.
- Headquarters: Miami, United States
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: office@aroaagency.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://aroaagency.com/

### 18. AT Agency
- Status: candidate — owner source review required
- Website: https://at-agency.co/
- About: AT Agency describes its services as creator account operations, content planning, fan engagement and audience development.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://at-agency.co/

### 19. XCreatorMgmt
- Status: candidate — owner source review required
- Website: https://www.xcreatormgmt.com/
- About: XCreatorMgmt describes its services as account management, social media marketing, content ideas and subscriber communication.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: yourfriends@xcreatormgmt.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.xcreatormgmt.com/
  - https://www.xcreatormgmt.com/contact

### 20. Vanguard Star Management
- Status: candidate — owner source review required
- Website: https://vsmagency.com/
- About: Vanguard Star Management describes its services as onlyFans management, marketing, fan messaging, content strategy and brand protection.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://vsmagency.com/
  - https://vsmagency.com/contact

### 21. Model Starz
- Status: candidate — owner source review required
- Website: https://www.modelstarzmgmt.com/
- About: Model Starz describes its services as onlyFans and Fansly creator management, content strategy and audience promotion.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: United States, Europe, Asia
- operating locations: Not yet confirmed
- Official sources:
  - https://www.modelstarzmgmt.com/
  - https://www.modelstarzmgmt.com/contact

### 22. Vantage Agency
- Status: candidate — owner source review required
- Website: https://thevantage.agency/
- About: Vantage Agency describes its services as creator brand management across subscription platforms, social media and fan communities.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: hello@thevantage.agency
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://thevantage.agency/

### 23. Lush Management
- Status: candidate — owner source review required
- Website: https://www.lushmgt.com/
- About: Lush Management describes its services as onlyFans account management, content posting, subscriber messaging and social media support.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: info@lushmgt.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.lushmgt.com/

### 24. Rize Agency
- Status: candidate — owner source review required
- Website: https://rizeagency.co/
- About: Rize Agency describes its services as creator growth management with social media promotion and subscriber conversion.
- Headquarters: United Kingdom
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://rizeagency.co/

### 25. Hussar OFM
- Status: candidate — owner source review required
- Website: https://www.hussarofm.com/
- About: Hussar OFM describes its services as onlyFans account management, fan messaging, content planning, growth and administration.
- Headquarters: Not yet confirmed
- legal name: Hussar Technology
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: info@hussarofm.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: New York City, USA, Warsaw, Poland
- Note: Agency describes a Polish sole proprietorship (JDG); company registration number not confirmed.
- Official sources:
  - https://www.hussarofm.com/

### 26. Lookstars Agency
- Status: candidate — owner source review required
- Website: https://www.lookstarsagency.com/en
- About: Lookstars Agency describes its services as boutique OnlyFans management with fan engagement and social media marketing.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: info@lookstarsagency.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Europe
- operating locations: Not yet confirmed
- Official sources:
  - https://www.lookstarsagency.com/en
  - https://www.lookstarsagency.com/en/about-us

### 27. EROS Agency
- Status: candidate — owner source review required
- Website: https://www.agency-eros.com/
- About: EROS Agency describes its services as onlyFans account management, fan monetization, audience growth and creator brand strategy.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.agency-eros.com/

### 28. SVJ Talent
- Status: candidate — owner source review required
- Website: https://svjtalent.com/
- About: SVJ Talent describes its services as chatting-focused creator management with fan messaging and account communication support.
- Headquarters: Boise, United States
- legal name: SVJ Talent LLC
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Specialist chat service; content production and social marketing are not offered.
- Official sources:
  - https://svjtalent.com/
  - https://svjtalent.com/about

### 29. OnlyFans Management (Australia)
- Status: candidate — owner source review required
- Website: https://onlyfansmanagement.com.au/
- About: OnlyFans Management (Australia) describes its services as creator management with account strategy, marketing and ongoing account support.
- Headquarters: Australia
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: 2022
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://onlyfansmanagement.com.au/
  - https://onlyfansmanagement.com.au/contact/

### 30. FEM Management
- Status: candidate — owner source review required
- Website: https://www.fem-management.com/
- About: FEM Management describes its services as onlyFans management with fan messaging, content ideas, promotion and leak protection.
- Headquarters: Not yet confirmed
- legal name: FTD Media LLC
- registration number: EIN 92-1332408 (tax identifier; not a company registration number)
- registered address: 3833 Powerline Rd, Suite 301-B, Fort Lauderdale, FL 33309, USA
- public email: info@fem-management.com
- email purpose: Not yet confirmed
- public phone: +43 665 65677423
- contact channel: Not yet confirmed
- founded year: 2022
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.fem-management.com/
  - https://www.fem-management.com/imprint

### 31. Aura Management
- Status: candidate — owner source review required
- Website: https://www.auramgmt.com.au/
- About: Aura Management describes its services as australian creator talent management and OnlyFans account support.
- Headquarters: Australia
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Website states Australian registered and owned; legal entity details require confirmation.
- Official sources:
  - https://www.auramgmt.com.au/
  - https://www.auramgmt.com.au/talentenquiry

### 32. Nest Talent
- Status: candidate — owner source review required
- Website: https://www.nesttalent.com/
- About: Nest Talent describes its services as creator account strategy, social media growth, audience engagement and operational support.
- Headquarters: Australia
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: hello@nesttalent.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.nesttalent.com/
  - https://www.nesttalent.com/about-us

### 33. Blue Rose Talent
- Status: candidate — owner source review required
- Website: https://bluerosetalent.com/
- About: Blue Rose Talent describes its services as creator career management and support for OnlyFans and other creator platforms.
- Headquarters: Australia
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: info@bluerosetalent.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://bluerosetalent.com/
  - https://bluerosetalent.com/contact

### 34. The Scandilo Agency
- Status: candidate — owner source review required
- Website: https://scandiloagency.com/
- About: The Scandilo Agency describes its services as onlyFans management with promotion, fan messaging and a personal account manager.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Scandinavia, Europe
- operating locations: Not yet confirmed
- Official sources:
  - https://scandiloagency.com/

### 35. ALLURE
- Status: candidate — owner source review required
- Website: https://www.allureagencyparis.com/en
- About: ALLURE describes its services as creator management with account operations, social media traffic and growth strategy.
- Headquarters: Paris, France
- legal name: ALLURE SAS
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: allure.agency.paris@gmail.com
- email purpose: Privacy contact
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.allureagencyparis.com/en
  - https://www.allureagencyparis.com/mentions-legales

### 36. Unfiltered Management
- Status: candidate — owner source review required
- Website: https://www.unfiltered-management.com/
- About: Unfiltered Management describes its services as onlyFans creator management, account strategy and support for switching agency teams.
- Headquarters: Not yet confirmed
- legal name: UNLIMITED STUDIOS CONSULTING LLC
- registration number: Not yet confirmed
- registered address: 2880 W Oakland Park Blvd, STE 225C, Oakland Park, FL 33311, USA
- public email: info@unfiltered-management.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Miami, USA, Berlin, Germany, Poland
- Official sources:
  - https://www.unfiltered-management.com/
  - https://www.unfiltered-management.com/services/agency-switch
  - https://www.unfiltered-management.com/imprint

### 37. Xentra Group
- Status: candidate — owner source review required
- Website: https://xentragroup.co.uk/onlyfans-agency-uk
- About: Xentra Group describes its services as onlyFans creator management with fan messaging, account strategy and audience growth.
- Headquarters: United Kingdom
- legal name: CoachFlo Ltd
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: admin@xentragroup.co.uk
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://xentragroup.co.uk/onlyfans-agency-uk

### 38. Elvision Studios
- Status: candidate — owner source review required
- Website: https://elvision-studios.com/en/europe/united-kingdom
- About: Elvision Studios describes its services as remote OnlyFans management for creators, including support for UK-based accounts.
- Headquarters: Not yet confirmed
- legal name: Elvision LLC
- registration number: Not yet confirmed
- registered address: 30 N Gould St, Ste N, Sheridan, Wyoming 82801, USA
- public email: contact@elvision-studios.com
- email purpose: Not yet confirmed
- public phone: +49 1577 3840073
- contact channel: Not yet confirmed
- founded year: 2022
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Registered address is not an operational headquarters. UK landing page indicates a service market, not headquarters.
- Official sources:
  - https://elvision-studios.com/en/europe/united-kingdom
  - https://uk.elvision-studios.com/imprint

### 39. Shevo Studio
- Status: candidate — owner source review required
- Website: https://www.shevostudio.com/
- About: Shevo Studio describes its services as onlyFans and Fansly account management with fan retention and social media marketing.
- Headquarters: United Kingdom
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.shevostudio.com/

### 40. Norvo Management
- Status: candidate — owner source review required
- Website: https://norvomanagement.com/
- About: Norvo Management describes its services as onlyFans management with fan messaging, content strategy and creator growth planning.
- Headquarters: United Kingdom
- legal name: Norvo Ltd
- registration number: England and Wales company 17416436
- registered address: Not yet confirmed
- public email: contact@norvomanagement.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://norvomanagement.com/

### 41. Creator House
- Status: candidate — owner source review required
- Website: https://creatorhouse.agency/
- About: Creator House describes its services as creator management with social media strategy, fan messaging and privacy support.
- Headquarters: Spain
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: hello@creatorhouse.agency
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Argentina, Mexico
- operating locations: Not yet confirmed
- Official sources:
  - https://creatorhouse.agency/

### 42. 20MG
- Status: candidate — owner source review required
- Website: https://20mg.co/
- About: 20MG describes its services as onlyFans creator management and growth services for international creator accounts.
- Headquarters: United States
- legal name: Twenty Management Group LLC
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: hello@20mg.co
- email purpose: Not yet confirmed
- public phone: +1 332 265 3480
- contact channel: Not yet confirmed
- founded year: 2025
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://20mg.co/
  - https://20mg.co/about

### 43. TOAgency
- Status: hold — direct confirmation required
- Website: https://theonlyfans.agency/
- About: TOAgency describes its services as creator account management with strategic content planning and ongoing fan engagement.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Contact page contains stock-template address, phone and noreply@envato.com. Identity and usable contact need direct confirmation. Do not import until reviewed.
- Official sources:
  - https://theonlyfans.agency/
  - https://theonlyfans.agency/contact/

### 44. Lambert Agency
- Status: candidate — owner source review required
- Website: https://agencylambert.com/
- About: Lambert Agency describes its services as onlyFans management with content planning, fan messaging and audience acquisition.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Telegram @lambert_agency
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://agencylambert.com/
  - https://t.me/lambert_agency

### 45. Empire of Agency
- Status: candidate — owner source review required
- Website: https://www.empireofagency.com/
- About: Empire of Agency describes its services as creator management covering strategy, distribution, fan operations and reporting.
- Headquarters: Paris, France
- legal name: Empire of Agency
- registration number: 893032946 (agency-reported; registry verification pending)
- registered address: Not yet confirmed
- public email: legal@empireofagency.com
- email purpose: Legal contact
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Host/provider address has been excluded; it is not an agency address.
- Official sources:
  - https://www.empireofagency.com/
  - https://www.empireofagency.com/legal

### 46. Elev Agency
- Status: candidate — owner source review required
- Website: https://elev.agency/
- About: Elev Agency describes its services as creator management, social media planning and fan engagement services.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: ethan@elev-agency.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://elev.agency/
  - https://elev.agency/about

### 47. OFAgency.co
- Status: candidate — owner source review required
- Website: https://www.ofagency.co/
- About: OFAgency.co describes its services as onlyFans account management, traffic acquisition, fan messaging and content strategy.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: Not yet confirmed
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.ofagency.co/
  - https://www.ofagency.co/about
  - https://www.ofagency.co/contact

### 48. TDM Business
- Status: candidate — owner source review required
- Website: https://tdmbusiness.com/
- About: TDM Business describes its services as onlyFans management and support services for creators and agency businesses.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: info@tdmbusiness.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: United States, United Kingdom
- Official sources:
  - https://tdmbusiness.com/

### 49. OFM Models Agency
- Status: candidate — owner source review required
- Website: https://www.onlyfansmanagement.info/
- About: OFM Models Agency describes its services as OnlyFans account management, fan messaging, profile growth and mentoring.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: modelsagency.ofm@gmail.com
- email purpose: Not yet confirmed
- public phone: Not yet confirmed
- contact channel: Telegram @jfhello
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Official sources:
  - https://www.onlyfansmanagement.info/

### 50. BeaconOFM
- Status: candidate — owner source review required
- Website: https://beaconofm.com/
- About: BeaconOFM describes its services as creator management with fan messaging, traffic strategy and an AI content production offering.
- Headquarters: Not yet confirmed
- legal name: Not yet confirmed
- registration number: Not yet confirmed
- registered address: Not yet confirmed
- public email: contact@beaconofm.com
- email purpose: Not yet confirmed
- public phone: +995 591 268799
- contact channel: Not yet confirmed
- founded year: Not yet confirmed
- team size: Not yet confirmed
- languages: Not yet confirmed
- markets served: Not yet confirmed
- operating locations: Not yet confirmed
- Note: Website publishes Gudauri Village, street 7, number 12; address type and country require confirmation. Registered legal entity is not confirmed. Phone country code is not headquarters evidence.
- Official sources:
  - https://beaconofm.com/
  - https://beaconofm.com/about


```

## supabase/migrations/202610100018_curated_directory_claims.sql

```sql
begin;

-- Delete only explicitly labelled fictional/demo records, including their dependent demo data.
delete from public.ap_agencies where demo_profile = true;

create table public.ap_agency_claims (
 id uuid primary key default gen_random_uuid(),
 agency_id uuid not null references public.ap_agencies(id) on delete cascade,
 claimant_user_id uuid not null references auth.users(id) on delete cascade,
 evidence text not null check(length(trim(evidence)) between 40 and 5000),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewer_note text,
 reviewed_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), reviewed_at timestamptz
);
create unique index ap_one_pending_claim_per_user on public.ap_agency_claims(agency_id,claimant_user_id) where status='pending';
alter table public.ap_agency_claims enable row level security;
create policy claims_read on public.ap_agency_claims for select to authenticated
 using (claimant_user_id=auth.uid() or ap_private.is_staff(array['super_admin']));
grant select on public.ap_agency_claims to authenticated;
revoke insert,update,delete on public.ap_agency_claims from anon,authenticated;

create function public.ap_request_agency_claim(target_agency uuid, ownership_evidence text)
returns uuid language plpgsql security definer set search_path='' as $$
declare claim_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to claim a profile'; end if;
 if ap_private.is_staff(null) then raise exception 'Use a separate agency account to claim a profile'; end if;
 perform 1 from public.ap_agencies where id=target_agency and published and status='approved' and publication_status='published' and not demo_profile for update;
 if not found then raise exception 'Published agency not found'; end if;
 if exists(select 1 from public.ap_agency_memberships where agency_id=target_agency and role='owner' and status='active') then raise exception 'This profile already has an owner'; end if;
 if length(trim(coalesce(ownership_evidence,''))) not between 40 and 5000 then raise exception 'Provide 40 to 5000 characters of ownership evidence'; end if;
 insert into public.ap_agency_claims(agency_id,claimant_user_id,evidence) values(target_agency,auth.uid(),trim(ownership_evidence)) returning id into claim_id;
 return claim_id;
end; $$;

create function public.ap_review_agency_claim(target_claim uuid, decision text, review_note text)
returns void language plpgsql security definer set search_path='' as $$
declare claim public.ap_agency_claims; target_id uuid;
begin
 if not ap_private.is_staff(array['super_admin']) then raise exception 'Owner reviewer access required'; end if;
 if coalesce(decision,'') not in ('approved','rejected') or length(trim(coalesce(review_note,'')))<10 then raise exception 'Decision and review explanation required'; end if;
 select agency_id into target_id from public.ap_agency_claims where id=target_claim;
 perform 1 from public.ap_agencies where id=target_id for update;
 select * into claim from public.ap_agency_claims where id=target_claim for update;
 if not found or claim.status<>'pending' then raise exception 'Pending claim not found'; end if;
 if decision='approved' then
  if exists(select 1 from public.ap_agency_memberships where agency_id=claim.agency_id and role='owner' and status='active') then raise exception 'This agency already has an owner'; end if;
  if exists(select 1 from public.ap_staff_roles where user_id=claim.claimant_user_id) then raise exception 'Staff accounts cannot own agency profiles'; end if;
  insert into public.ap_agency_memberships(agency_id,user_id,role,status) values(claim.agency_id,claim.claimant_user_id,'owner','active')
  on conflict(agency_id,user_id) do update set role='owner',status='active',updated_at=now();
 end if;
 update public.ap_agency_claims set status=decision,reviewer_note=trim(review_note),reviewed_by=auth.uid(),reviewed_at=now() where id=target_claim;
 insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id) values(auth.uid(),claim.agency_id,'claim.'||decision,'agency_claim',target_claim::text);
end; $$;

create function public.ap_add_curated_agency(agency_name text, agency_slug text, official_website text, agency_country text, agency_about text)
returns uuid language plpgsql security definer set search_path='' as $$
declare agency_id uuid;
begin
 if not ap_private.is_staff(array['super_admin']) then raise exception 'Owner access required'; end if;
 if coalesce(official_website,'') !~ '^https://[^ /]+' or length(trim(coalesce(agency_about,'')))<40 then raise exception 'Official HTTPS website and agency description required'; end if;
 insert into public.ap_agencies(name,slug,website_url,country,about,status,published,publication_status,approved_at,published_at,demo_profile,accepting_inquiries)
 values(trim(agency_name),agency_slug,official_website,trim(agency_country),trim(agency_about),'approved',true,'published',now(),now(),false,false) returning id into agency_id;
 insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id) values(auth.uid(),agency_id,'agency.curated_added','agency',agency_id::text);
 return agency_id;
end; $$;
revoke all on function public.ap_request_agency_claim(uuid,text),public.ap_review_agency_claim(uuid,text,text),public.ap_add_curated_agency(text,text,text,text,text) from public,anon;
grant execute on function public.ap_request_agency_claim(uuid,text),public.ap_review_agency_claim(uuid,text,text),public.ap_add_curated_agency(text,text,text,text,text) to authenticated;
commit;

```

## supabase/migrations/202610100019_claim_profile_review.sql

```sql
begin;

alter table public.ap_agencies add column if not exists directory_information jsonb not null default '{}'::jsonb;
alter table public.ap_agency_claims
 add column if not exists representative_name text,
 add column if not exists representative_role text,
 add column if not exists business_contact text,
 add column if not exists profile_confirmed boolean not null default false,
 add column if not exists requested_corrections text,
 add column if not exists profile_snapshot jsonb,
 add column if not exists reviewer_checks jsonb,
 add column if not exists reviewed_snapshot jsonb;

create or replace function ap_private.claim_profile_snapshot(target_agency uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('name',a.name,'website_url',a.website_url,'about',a.about,
 'country',a.country,'city',a.city,'services',a.services,'social_links',a.social_links,
 'directory_information',a.directory_information,'tagline',a.tagline,'positioning_statement',a.positioning_statement,
 'category',a.category,'founded_year',a.founded_year,'employee_count_range',a.employee_count_range,
 'languages',a.languages,'regions_served',a.regions_served,'creator_niches',a.creator_niches,
 'ideal_client',a.ideal_client,'minimum_requirements',a.minimum_requirements)
 from public.ap_agencies a where a.id=target_agency;
$$;
revoke all on function ap_private.claim_profile_snapshot(uuid) from public,anon,authenticated;

-- Older clients cannot bypass the new profile review and representative fields.
create or replace function public.ap_request_agency_claim(target_agency uuid, ownership_evidence text)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 raise exception 'Please use the updated claim form to review the profile and provide representative details';
end; $$;

create or replace function public.ap_request_agency_claim_reviewed(
 target_agency uuid, ownership_evidence text, full_name text, job_role text,
 company_contact text, information_confirmed boolean, corrections text, expected_profile jsonb
)
returns uuid language plpgsql security definer set search_path='' as $$
declare claim_id uuid; current_profile jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in to claim a profile'; end if;
 if ap_private.is_staff(null) then raise exception 'Use a separate agency account to claim a profile'; end if;
 perform 1 from public.ap_agencies where id=target_agency and published and status='approved' and publication_status='published' and not demo_profile for update;
 if not found then raise exception 'Published agency not found'; end if;
 if exists(select 1 from public.ap_agency_memberships where agency_id=target_agency and role='owner' and status='active') then raise exception 'This profile already has an owner'; end if;
 if not coalesce(information_confirmed,false) then raise exception 'Review and confirm the profile information first'; end if;
 if length(trim(coalesce(full_name,''))) not between 2 and 160 or length(trim(coalesce(job_role,''))) not between 2 and 160 then raise exception 'Your full name and role are required'; end if;
 if coalesce(company_contact,'') !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' or length(company_contact)>254 then raise exception 'A valid business contact email is required'; end if;
 if length(trim(coalesce(ownership_evidence,''))) not between 40 and 5000 or length(coalesce(corrections,''))>5000 then raise exception 'Provide 40 to 5000 characters of evidence and at most 5000 characters of corrections'; end if;
 current_profile:=ap_private.claim_profile_snapshot(target_agency);
 if expected_profile is distinct from current_profile then raise exception 'The profile changed. Reload and review the latest information before submitting'; end if;
 insert into public.ap_agency_claims(agency_id,claimant_user_id,evidence,representative_name,representative_role,business_contact,profile_confirmed,requested_corrections,profile_snapshot)
 values(target_agency,auth.uid(),trim(ownership_evidence),trim(full_name),trim(job_role),lower(trim(company_contact)),true,nullif(trim(corrections),''),current_profile) returning id into claim_id;
 return claim_id;
end; $$;

create or replace function public.ap_review_agency_claim(target_claim uuid, decision text, review_note text)
returns void language plpgsql security definer set search_path='' as $$
declare claim public.ap_agency_claims; target_id uuid;
begin
 if not ap_private.is_staff(array['super_admin']) then raise exception 'Owner reviewer access required'; end if;
 if coalesce(decision,'') not in ('approved','rejected') or length(trim(coalesce(review_note,'')))<10 then raise exception 'Decision and review explanation required'; end if;
 select agency_id into target_id from public.ap_agency_claims where id=target_claim;
 perform 1 from public.ap_agencies where id=target_id for update;
 select * into claim from public.ap_agency_claims where id=target_claim for update;
 if not found or claim.status<>'pending' then raise exception 'Pending claim not found'; end if;
 if decision='approved' then
  if not claim.profile_confirmed or claim.profile_snapshot is null or claim.representative_name is null or claim.business_contact is null
   or claim.reviewer_checks is distinct from '{"identity":true,"authority":true,"contact":true,"information":true}'::jsonb then
   raise exception 'Representative details and all four reviewer checks are required. Legacy claims must be resubmitted using the updated form';
  end if;
  if claim.reviewed_snapshot is distinct from ap_private.claim_profile_snapshot(target_id) then raise exception 'Profile changed during review. Reload and review again'; end if;
  if exists(select 1 from public.ap_agency_memberships where agency_id=claim.agency_id and role='owner' and status='active') then raise exception 'This agency already has an owner'; end if;
  if exists(select 1 from public.ap_staff_roles where user_id=claim.claimant_user_id) then raise exception 'Staff accounts cannot own agency profiles'; end if;
  insert into public.ap_agency_memberships(agency_id,user_id,role,status) values(claim.agency_id,claim.claimant_user_id,'owner','active')
  on conflict(agency_id,user_id) do update set role='owner',status='active',updated_at=now();
 end if;
 update public.ap_agency_claims set status=decision,reviewer_note=trim(review_note),reviewed_by=auth.uid(),reviewed_at=now() where id=target_claim;
 insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id) values(auth.uid(),claim.agency_id,'claim.'||decision,'agency_claim',target_claim::text);
end; $$;

create or replace function public.ap_review_agency_claim_checked(
 target_claim uuid, decision text, review_note text, checks jsonb, expected_profile jsonb
)
returns void language plpgsql security definer set search_path='' as $$
declare target_id uuid;
begin
 if not ap_private.is_staff(array['super_admin']) then raise exception 'Owner reviewer access required'; end if;
 select agency_id into target_id from public.ap_agency_claims where id=target_claim;
 perform 1 from public.ap_agencies where id=target_id for update;
 if decision='approved' then
  if checks is distinct from '{"identity":true,"authority":true,"contact":true,"information":true}'::jsonb then raise exception 'Complete all four verification checks before approving'; end if;
  if expected_profile is distinct from ap_private.claim_profile_snapshot(target_id) then raise exception 'Profile changed. Reload and verify the latest information'; end if;
  update public.ap_agency_claims set reviewer_checks=checks,reviewed_snapshot=expected_profile where id=target_claim and status='pending';
 end if;
 perform public.ap_review_agency_claim(target_claim,decision,review_note);
end; $$;

create or replace function public.ap_correct_curated_profile(target_agency uuid, changes jsonb, expected_profile jsonb, source_url text, review_note text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not ap_private.is_staff(array['super_admin']) then raise exception 'Owner reviewer access required'; end if;
 perform 1 from public.ap_agencies where id=target_agency and not demo_profile for update;
 if not found then raise exception 'Agency not found'; end if;
 if expected_profile is distinct from ap_private.claim_profile_snapshot(target_agency) then raise exception 'Profile changed. Reload before saving corrections'; end if;
 if coalesce(jsonb_typeof(changes),'')<>'object' or length(trim(coalesce(changes->>'name',''))) not between 2 and 160
  or coalesce(changes->>'website_url','') !~ '^https://[^ /]+' or length(trim(coalesce(changes->>'about','')))<40
  or coalesce(jsonb_typeof(changes->'services'),'')<>'array' or coalesce(jsonb_typeof(changes->'directory_information'),'')<>'object'
  or coalesce(source_url,'') !~ '^https://[^ /]+' or length(trim(coalesce(review_note,'')))<10 then raise exception 'Valid profile details, official source and review explanation are required'; end if;
 if exists(select 1 from jsonb_array_elements(changes->'services') item where jsonb_typeof(item)<>'string') then raise exception 'Services must be text'; end if;
 update public.ap_agencies set name=trim(changes->>'name'),website_url=trim(changes->>'website_url'),about=trim(changes->>'about'),
 country=nullif(trim(changes->>'country'),''),city=nullif(trim(changes->>'city'),''),
 services=array(select jsonb_array_elements_text(changes->'services')),
 directory_information=directory_information || (changes->'directory_information') || jsonb_build_object('owner_reviewed_source',source_url,'owner_reviewed_at',now()),updated_at=now()
 where id=target_agency;
 insert into public.ap_security_audit(actor_user_id,agency_id,action,target_type,target_id,metadata)
 values(auth.uid(),target_agency,'agency.information_corrected','agency',target_agency::text,jsonb_build_object('source',source_url,'note',trim(review_note)));
end; $$;

revoke all on function public.ap_request_agency_claim_reviewed(uuid,text,text,text,text,boolean,text,jsonb),public.ap_review_agency_claim_checked(uuid,text,text,jsonb,jsonb),public.ap_correct_curated_profile(uuid,jsonb,jsonb,text,text) from public,anon;
grant execute on function public.ap_request_agency_claim_reviewed(uuid,text,text,text,text,boolean,text,jsonb),public.ap_review_agency_claim_checked(uuid,text,text,jsonb,jsonb),public.ap_correct_curated_profile(uuid,jsonb,jsonb,text,text) to authenticated;

-- Append research details without changing existing public view columns.
create or replace view public.ap_public_agencies as
select a.id,a.name,a.slug,a.tagline,a.positioning_statement,a.about,a.country,a.city,a.website_url,a.logo_url,a.cover_image_url,
 a.services,a.creator_niches,a.regions_served,a.social_links,a.published_at,a.category,a.founded_year,a.employee_count_range,
 a.languages,a.ideal_client,a.minimum_requirements,a.accepting_inquiries,a.demo_profile,a.demo_reputation_score,a.demo_review_count,
 case when a.demo_profile then false else exists(select 1 from public.ap_verifications v where v.agency_id=a.id and v.status='approved') end as verified,
 case when not a.demo_profile and exists(select 1 from public.ap_verifications v where v.agency_id=a.id and v.status='approved') then 'verified' else 'unverified' end as verification_status,
 coalesce((select round(avg(r.rating)::numeric,2) from public.ap_reviews r where r.agency_id=a.id and r.status='published'),0) as average_rating,
 (select count(*) from public.ap_reviews r where r.agency_id=a.id and r.status='published') as review_count,
 (select er.rating from public.ap_external_ratings er where er.agency_id=a.id and er.platform='trustpilot') as external_rating,
 (select er.review_count from public.ap_external_ratings er where er.agency_id=a.id and er.platform='trustpilot') as external_review_count,
 (select er.rating_status from public.ap_external_ratings er where er.agency_id=a.id and er.platform='trustpilot') as external_rating_status,
 (select er.is_demo from public.ap_external_ratings er where er.agency_id=a.id and er.platform='trustpilot') as external_rating_is_demo,
 a.directory_information
from public.ap_agencies a where a.published=true and a.publication_status='published' and a.status='approved';
commit;

```

## tests/agency-claims.test.ts

```ts
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const owner = "10000000-0000-4000-8000-000000000001";
const claimant = "10000000-0000-4000-8000-000000000002";
const other = "10000000-0000-4000-8000-000000000003";
const agency = "20000000-0000-4000-8000-000000000001";
let db: PGlite;
async function actor(id: string) {
  await db.query("select set_config('test.user',$1,false)", [id]);
}
async function request(id = agency) {
  const result = await db.query<{ id: string }>(
    "select public.ap_request_agency_claim($1,$2) as id",
    [
      id,
      "I represent this company and provide official domain ownership and company records for the reviewer.",
    ],
  );
  return result.rows[0].id;
}
describe("curated agency ownership database workflow", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
 create role anon; create role authenticated;
 create schema auth; create schema ap_private;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
 create table public.ap_agencies(id uuid primary key default gen_random_uuid(),name text,slug text unique,website_url text,country text,about text,status text,published boolean,publication_status text,approved_at timestamptz,published_at timestamptz,demo_profile boolean default false,accepting_inquiries boolean default false);
 create table public.ap_agency_memberships(agency_id uuid references public.ap_agencies(id) on delete cascade,user_id uuid references auth.users(id),role text,status text,updated_at timestamptz,unique(agency_id,user_id));
 create table public.ap_staff_roles(user_id uuid,role text);
 create table public.ap_security_audit(actor_user_id uuid,agency_id uuid,action text,target_type text,target_id text);
 create function ap_private.is_staff(required_roles text[] default null) returns boolean language sql stable security definer as $$ select exists(select 1 from public.ap_staff_roles where user_id=auth.uid() and (required_roles is null or role=any(required_roles))) $$;
 grant usage on schema auth,ap_private to authenticated;
 insert into auth.users values('${owner}'),('${claimant}'),('${other}');
 insert into public.ap_staff_roles values('${owner}','super_admin');
 insert into public.ap_agencies(id,name,slug,status,published,publication_status,demo_profile) values('${agency}','Real Agency','real-agency','approved',true,'published',false),('20000000-0000-4000-8000-000000000099','Demo Agency','demo-agency','approved',true,'published',true);
 `);
    await db.exec(
      readFileSync(
        "supabase/migrations/202610100018_curated_directory_claims.sql",
        "utf8",
      ),
    );
  }, 30000);
  afterAll(async () => {
    await db.close();
  });
  it("removes marked demos and preserves legitimate agencies", async () => {
    const { rows } = await db.query("select name from public.ap_agencies");
    expect(rows).toEqual([{ name: "Real Agency" }]);
  });
  it("rejects anonymous claims and staff claiming agency access", async () => {
    await actor("");
    await expect(request()).rejects.toThrow("Sign in");
    await actor(owner);
    await expect(request()).rejects.toThrow("separate agency account");
  });
  it("keeps claims private and never grants membership on submission", async () => {
    await actor(claimant);
    await request();
    expect(
      (await db.query("select * from public.ap_agency_memberships")).rows,
    ).toHaveLength(0);
    await db.exec("set role authenticated");
    expect(
      (await db.query("select evidence from public.ap_agency_claims")).rows,
    ).toHaveLength(1);
    await actor(other);
    expect(
      (await db.query("select evidence from public.ap_agency_claims")).rows,
    ).toHaveLength(0);
    await expect(
      db.query("update public.ap_agency_claims set status='approved'"),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role");
  });
  it("rejects duplicate pending claims and non-owner approval", async () => {
    await actor(claimant);
    await expect(request()).rejects.toThrow("duplicate key");
    const { rows } = await db.query<{ id: string }>(
      "select id from public.ap_agency_claims limit 1",
    );
    await expect(
      db.query(
        "select ap_review_agency_claim($1,'approved','Reviewed official ownership documents')",
        [rows[0].id],
      ),
    ).rejects.toThrow("Owner reviewer");
  });
  it("approves only one owner and preserves the existing profile", async () => {
    await actor(other);
    const second = await request();
    const { rows } = await db.query<{ id: string }>(
      "select id from public.ap_agency_claims where claimant_user_id=$1",
      [claimant],
    );
    await actor(owner);
    await db.query(
      "select ap_review_agency_claim($1,'approved','Reviewed official ownership documents')",
      [rows[0].id],
    );
    expect(
      (
        await db.query(
          "select agency_id,user_id,role,status from public.ap_agency_memberships",
        )
      ).rows,
    ).toEqual([
      { agency_id: agency, user_id: claimant, role: "owner", status: "active" },
    ]);
    await expect(
      db.query(
        "select ap_review_agency_claim($1,'approved','Reviewed official ownership documents')",
        [second],
      ),
    ).rejects.toThrow("already has an owner");
    expect(
      (await db.query("select id from public.ap_agencies")).rows,
    ).toHaveLength(1);
    await db.query(
      "select ap_review_agency_claim($1,'rejected','The ownership evidence was not sufficient')",
      [second],
    );
    expect(
      (await db.query("select * from public.ap_agency_memberships")).rows,
    ).toHaveLength(1);
  });
  it("only allows owners to publish curated unclaimed listings", async () => {
    await actor(claimant);
    await expect(
      db.query(
        "select ap_add_curated_agency('Another Agency','another-agency','https://example.org','Philippines','An official description with sufficient agency details.')",
      ),
    ).rejects.toThrow("Owner access");
    await actor(owner);
    await db.query(
      "select ap_add_curated_agency('Another Agency','another-agency','https://example.org','Philippines','An official description with sufficient agency details.')",
    );
    expect(
      (
        await db.query(
          "select published,demo_profile from public.ap_agencies where slug='another-agency'",
        )
      ).rows,
    ).toEqual([{ published: true, demo_profile: false }]);
    expect(
      (await db.query("select * from public.ap_agency_memberships")).rows,
    ).toHaveLength(1);
  });
});

```

## tests/claim-profile-review.test.ts

```ts
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const owner = "10000000-0000-4000-8000-000000000001";
const claimant = "10000000-0000-4000-8000-000000000002";
const other = "10000000-0000-4000-8000-000000000003";
const agency = "20000000-0000-4000-8000-000000000001";
let db: PGlite;
async function actor(id: string) {
  await db.query("select set_config('test.user',$1,false)", [id]);
}
describe("reviewed claim profile workflow", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
 create role anon; create role authenticated;
 create schema auth; create schema ap_private;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
 create table public.ap_agencies(id uuid primary key default gen_random_uuid(),name text,slug text unique,website_url text,country text,about text,status text,published boolean,publication_status text,approved_at timestamptz,published_at timestamptz,demo_profile boolean default false,accepting_inquiries boolean default false);
 create table public.ap_agency_memberships(agency_id uuid references public.ap_agencies(id) on delete cascade,user_id uuid references auth.users(id),role text,status text,updated_at timestamptz,unique(agency_id,user_id));
 create table public.ap_staff_roles(user_id uuid,role text);
 create table public.ap_security_audit(actor_user_id uuid,agency_id uuid,action text,target_type text,target_id text);
 create function ap_private.is_staff(required_roles text[] default null) returns boolean language sql stable security definer as $$ select exists(select 1 from public.ap_staff_roles where user_id=auth.uid() and (required_roles is null or role=any(required_roles))) $$;
 grant usage on schema auth,ap_private to authenticated;
 insert into auth.users values('${owner}'),('${claimant}'),('${other}');
 insert into public.ap_staff_roles values('${owner}','super_admin');
 insert into public.ap_agencies(id,name,slug,status,published,publication_status,demo_profile) values('${agency}','Real Agency','real-agency','approved',true,'published',false),('20000000-0000-4000-8000-000000000099','Demo Agency','demo-agency','approved',true,'published',true);
 `);
    await db.exec(
      readFileSync(
        "supabase/migrations/202610100018_curated_directory_claims.sql",
        "utf8",
      ),
    );
    await db.exec(`
 alter table public.ap_agencies add column city text,add column services text[] default '{}',add column social_links jsonb default '{}',add column updated_at timestamptz,add column tagline text,add column positioning_statement text,add column logo_url text,add column cover_image_url text,add column creator_niches text[],add column regions_served text[],add column category text,add column founded_year integer,add column employee_count_range text,add column languages text[],add column ideal_client text,add column minimum_requirements text,add column demo_reputation_score numeric,add column demo_review_count integer;
 alter table public.ap_security_audit add column metadata jsonb;
 create table public.ap_verifications(agency_id uuid,status text);
 create table public.ap_reviews(agency_id uuid,status text,rating numeric);
 create table public.ap_external_ratings(agency_id uuid,platform text,rating numeric,review_count integer,rating_status text,is_demo boolean);
 `);
    await db.exec(readFileSync("supabase/migrations/202610100019_claim_profile_review.sql","utf8"));
  }, 30000);
  afterAll(async () => {
    await db.close();
  });

  async function snapshot() {
    return (await db.query<{ profile: Record<string,unknown> }>("select ap_private.claim_profile_snapshot($1) profile",[agency])).rows[0].profile;
  }
  async function submit(profile: unknown, confirmed = true) {
    return (await db.query<{id:string}>("select ap_request_agency_claim_reviewed($1,$2,'Jane Doe','Director','jane@agency.example',$3,'',$4) id",[agency,"Official domain ownership evidence and authority documents are supplied for independent review.",confirmed,profile])).rows[0].id;
  }
  const checks={identity:true,authority:true,contact:true,information:true};
  let claimId:string;
  it("blocks legacy calls, unconfirmed profiles and stale submission snapshots",async()=>{
    await actor(claimant);
    await expect(db.query("select ap_request_agency_claim($1,'old evidence')",[agency])).rejects.toThrow("updated claim form");
    await expect(submit(await snapshot(),false)).rejects.toThrow("Review and confirm");
    await expect(submit({})).rejects.toThrow("profile changed");
    claimId=await submit(await snapshot());
    expect((await db.query("select * from ap_agency_memberships")).rows).toHaveLength(0);
  });
  it("requires owner access and every approval check, including when calling the legacy reviewer",async()=>{
    await expect(db.query("select ap_review_agency_claim_checked($1,'approved','Checked the official evidence',$2,$3)",[claimId,checks,await snapshot()])).rejects.toThrow("Owner reviewer");
    await actor(owner);
    await expect(db.query("select ap_review_agency_claim($1,'approved','Checked the official evidence')",[claimId])).rejects.toThrow("four reviewer checks");
    await expect(db.query("select ap_review_agency_claim_checked($1,'approved','Checked the official evidence',$2,$3)",[claimId,{...checks,contact:false},await snapshot()])).rejects.toThrow("all four");
    await expect(db.query("select ap_review_agency_claim_checked($1,'approved','Checked the official evidence',$2,'{}')",[claimId,checks])).rejects.toThrow("Profile changed");
  });
  it("protects correction writes and records reviewed corrections without granting ownership",async()=>{
    const profile=await snapshot();
    const changes={name:'Real Agency',website_url:'https://agency.example',about:'Reviewed agency description supported by official business sources.',country:'United States',city:'',services:['Creator management'],directory_information:{legal_name:'Real Agency LLC'}};
    await actor(other);
    await expect(db.query("select ap_correct_curated_profile($1,$2,$3,'https://agency.example/about','Confirmed official source')",[agency,changes,profile])).rejects.toThrow("Owner reviewer");
    await actor(owner);
    await expect(db.query("select ap_correct_curated_profile($1,null,$2,null,'Confirmed official source')",[agency,profile])).rejects.toThrow("Valid profile details");
    await db.query("select ap_correct_curated_profile($1,$2,$3,'https://agency.example/about','Confirmed official source')",[agency,changes,profile]);
    expect((await snapshot()).directory_information).toMatchObject({legal_name:'Real Agency LLC',owner_reviewed_source:'https://agency.example/about'});
    expect((await db.query("select * from ap_agency_memberships")).rows).toHaveLength(0);
    await expect(db.query("select ap_review_agency_claim_checked($1,'approved','Checked the official evidence',$2,$3)",[claimId,checks,profile])).rejects.toThrow("Profile changed");
  });
  it("approves the existing profile only after current information and all checks are confirmed",async()=>{
    await actor(owner);
    await db.query("select ap_review_agency_claim_checked($1,'approved','Business identity, authority, contact and profile were independently checked',$2,$3)",[claimId,checks,await snapshot()]);
    expect((await db.query("select user_id,role,status from ap_agency_memberships")).rows).toEqual([{user_id:claimant,role:'owner',status:'active'}]);
    expect((await db.query("select * from ap_verifications")).rows).toHaveLength(0);
    expect((await db.query("select id from ap_agencies")).rows).toHaveLength(1);
  });
  it("imports reviewed candidates idempotently, withholds the template listing and preserves owned information",async()=>{
    const add=readFileSync("research/add-50-agencies.sql","utf8");
    const enrich=readFileSync("research/enrich-researched-profiles.sql","utf8");
    await db.exec(add);
    await db.exec(enrich);
    expect((await db.query("select id from ap_agencies where slug='toagency'")).rows).toHaveLength(0);
    expect((await db.query("select id from ap_agencies")).rows).toHaveLength(50);
    expect((await db.query<{d:Record<string,unknown>}>("select directory_information d from ap_agencies where slug='fem-management'")).rows[0].d.public_email).toBe('info@fem-management.com');
    await db.exec("update ap_agencies set directory_information='{}' where slug='creators-inc'; insert into ap_agency_memberships(agency_id,user_id,role,status) select id,'10000000-0000-4000-8000-000000000003','owner','active' from ap_agencies where slug='creators-inc'");
    await db.exec(add);
    await db.exec(enrich);
    expect((await db.query("select directory_information from ap_agencies where slug='creators-inc'")).rows).toEqual([{directory_information:{}}]);
    expect((await db.query("select id from ap_agencies")).rows).toHaveLength(50);
  });
});

```
