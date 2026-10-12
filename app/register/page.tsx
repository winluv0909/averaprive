import Link from "next/link";
import RegistrationWizard from "./RegistrationWizard";
import { signInWithSocial } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Register your agency",
  description:
    "Create an Avera Privé owner account and begin building your agency profile.",
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const selectedPlan = ["free", "prive", "select", "elite"].includes(
    params.plan ?? "",
  )
    ? String(params.plan)
    : "free";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const socialRegistration = params.oauth === "1" && Boolean(user);

  const socialName = String(
    user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      "",
  )
    .trim()
    .split(/\s+/);

  return (
    <div className="access-page registration-access-page">
      <a className="access-skip" href="#registration-form">
        Skip to registration form
      </a>

      <aside
        className="access-brand registration-access-brand"
        aria-label="Avera Privé registration benefits"
      >
        <div className="access-brand-inner">
          <Link
            className="access-logo"
            href="/"
            aria-label="Avera Privé homepage"
          >
            <img
  src="/ap-monogram-transparent.png"
  alt="Avera Privé"
  className="access-monogram"
/>

            <span>
              <strong>Avera Privé</strong>
              <small>THE GLOBAL AGENCY DIRECTORY</small>
            </span>
          </Link>

          <div className="access-message registration-message">
            <p className="access-kicker">
              FOR CREATOR-MANAGEMENT AGENCIES
            </p>

            <h1>
              Start free.
              <br />
              Grow with
              <br />
              <em>Privé.</em>
            </h1>

            <p>
              Create the owner account for your agency. After confirming your
              email, you can build a private profile, invite team members, and
              submit it for moderation.
            </p>

            <div className="registration-benefits">
              <div>
                <span>01</span>
                <p>
                  <b>Create owner access</b>
                  <small>Secure account and private workspace</small>
                </p>
              </div>

              <div>
                <span>02</span>
                <p>
                  <b>Build your profile</b>
                  <small>
                    Services, expertise, location, and company story
                  </small>
                </p>
              </div>

              <div>
                <span>03</span>
                <p>
                  <b>Submit for review</b>
                  <small>
                    Moderation, verification, and publication remain separate
                  </small>
                </p>
              </div>
            </div>
          </div>

          <div className="access-role-list">
            <span>FREE PROFILE</span>
            <i aria-hidden="true" />
            <span>NO CARD REQUIRED</span>
            <i aria-hidden="true" />
            <span>INDEPENDENT REVIEW</span>
          </div>
        </div>
      </aside>

      <main className="access-main registration-main">
        <div className="access-form-wrap">
          <Link className="access-back" href="/">
            ← &nbsp; RETURN TO HOMEPAGE
          </Link>

          <div className="access-heading">
            <p>AGENCY REGISTRATION &amp; CLAIM FLOW</p>
            <h2>Build your profile.</h2>
            <span>
              Complete one structured submission for owner access, profile
              moderation, and your independent verification pathway.
            </span>
          </div>

          {!socialRegistration && (
            <>
              <div className="social-registration-intro">
                <p>CREATE YOUR SECURE OWNER ACCOUNT</p>
                <span>
                  Use Google or continue with an email address and
                  password in Step 01.
                </span>
              </div>

              <div
  className="social-access registration-social-access"
  aria-label="Social account registration"
>
  <form
    action={signInWithSocial.bind(
      null,
      "google",
      "register",
    )}
  >
    <button
      type="submit"
      className="social-access-button"
    >
      <span
        className="social-provider-icon social-google-icon"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 18 18"
          role="img"
          focusable="false"
        >
          <path
            fill="#4285F4"
            d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.874 2.684-6.615Z"
          />

          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.468-.806 5.956-2.18l-2.909-2.258c-.806.54-1.836.859-3.047.859-2.344 0-4.328-1.584-5.037-3.713H.956v2.332A9 9 0 0 0 9 18Z"
          />

          <path
            fill="#FBBC05"
            d="M3.963 10.708A5.417 5.417 0 0 1 3.681 9c0-.593.102-1.169.282-1.708V4.96H.956A9 9 0 0 0 0 9c0 1.452.347 2.826.956 4.04l3.007-2.332Z"
          />

          <path
            fill="#EA4335"
            d="M9 3.579c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.427 0 9 0A9 9 0 0 0 .956 4.96l3.007 2.332C4.672 5.163 6.656 3.579 9 3.579Z"
          />
        </svg>
      </span>

      <b>REGISTER WITH GOOGLE</b>
    </button>
  </form>
</div>

              <div className="access-divider">
                <span>OR REGISTER WITH EMAIL</span>
              </div>
            </>
          )}

          {socialRegistration && (
            <div className="social-connected" role="status">
              <span>✓</span>
              <p>
                <b>Secure account connected</b>
                <small>
                  {user?.email} · Complete the agency information below.
                </small>
              </p>
            </div>
          )}

          <RegistrationWizard
            selectedPlan={selectedPlan}
            error={params.error}
            socialAccount={
              socialRegistration
                ? {
                    email: user?.email || "",
                    firstName: socialName[0] || "",
                    lastName: socialName.slice(1).join(" "),
                  }
                : undefined
            }
          />

          <div className="access-switch">
            <p>
              Already registered?{" "}
              <Link href="/agency/login">Sign in securely</Link>
            </p>

            <small>
              Creating an account does not automatically publish or verify an
              agency.
            </small>
          </div>
        </div>
      </main>
    </div>
  );
}