import { createAdminClient } from "@/lib/supabase/admin";
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
  const { data: agency } = await createAdminClient()
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
                  minLength={12}
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
