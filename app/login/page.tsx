import Link from "next/link";
import { signIn, signUp, signInWithSocial } from "./actions";
import AppleSignIn from "./AppleSignIn";

export const metadata = {
  title: "Sign in",
  description:
    "Secure access for Avera Privé agency owners and invited team members.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const creatingAccount = params.mode === "signup";

  const googleAction = signInWithSocial.bind(
    null,
    "google",
    creatingAccount ? "register" : "login",
  );

  return (
    <div className="access-page">
      <a className="access-skip" href="#access-form">
        Skip to access form
      </a>

      <aside
        className="access-brand"
        aria-label="Avera Privé introduction"
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

          <div className="access-message">
            <p className="access-kicker">
              AGENCY &amp; COMPANY ACCESS
            </p>

            <h1>
              Build trust.
              <br />
              Manage your profile.
              <br />
              <em>Grow visibly.</em>
            </h1>

            <p>
              Agency and company owners manage their profile,
              evidence, reviews, and invited team access from one
              secure workspace.
            </p>
          </div>

          <div
            className="access-role-list"
            aria-label="Supported account types"
          >
            <span>AGENCY OWNERS</span>
            <i aria-hidden="true" />
            <span>COMPANY OWNERS</span>
            <i aria-hidden="true" />
            <span>INVITED EMPLOYEES</span>
          </div>
        </div>
      </aside>

      <main className="access-main">
        <div className="access-form-wrap">
          <Link className="access-back" href="/">
            ← &nbsp; RETURN TO HOMEPAGE
          </Link>

          <div className="access-heading">
            <p>
              {creatingAccount
                ? "AGENCY OWNER REGISTRATION"
                : "AGENCY WORKSPACE ACCESS"}
            </p>

            <h2>
              {creatingAccount
                ? "Create your account."
                : "Welcome back."}
            </h2>

            <span>
              {creatingAccount
                ? "Create the owner account that will manage your agency profile and invite your team."
                : "Sign in with your agency-owner or invited employee account."}
            </span>
          </div>

          <div
            className="access-context"
            aria-label="Account guidance"
          >
            <div>
              <b>Agency owners</b>
              <small>
                Manage profiles, verification, reviews, and team
                access.
              </small>
            </div>

            <div>
              <b>Invited employees</b>
              <small>
                Use the account invitation provided by your
                agency administrator.
              </small>
            </div>
          </div>

          <form
            id="access-form"
            className="access-form"
            autoComplete="off"
          >
            {params.error && (
              <p className="access-alert error" role="alert">
                {params.error}
              </p>
            )}

            {params.message && (
              <p className="access-alert success" role="status">
                {params.message}
              </p>
            )}

            <input
              type="hidden"
              name="next"
              value={params.next ?? "/agency/dashboard"}
            />

            <input
              type="hidden"
              name="loginPath"
              value="/agency/login"
            />

            <label>
              <span>EMAIL ADDRESS</span>

              <input
                name="email"
                type="email"
                placeholder="name@company.com"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore
                required
              />
            </label>

            <label>
              <span>PASSWORD</span>

              <input
                name="password"
                type="password"
                placeholder={
                  creatingAccount
                    ? "Create a secure password"
                    : "Enter your password"
                }
                minLength={creatingAccount ? 12 : undefined}
                autoComplete="new-password"
                data-lpignore="true"
                data-1p-ignore
                required
              />

              {creatingAccount && <small>Minimum of 12 characters.</small>}
            </label>

            <button
              type="submit"
              className="access-submit"
              formAction={creatingAccount ? signUp : signIn}
            >
              {creatingAccount
                ? "CREATE AGENCY OWNER ACCOUNT"
                : "SIGN IN SECURELY"}
              <span>→</span>
            </button>
          </form>
          <p><Link href="/forgot-password">Forgot your password?</Link></p>

          <div
            className="access-google-divider"
            aria-hidden="true"
          >
            <span />
            <small>OR</small>
            <span />
          </div>

          <form
            className="access-google-form"
            action={googleAction}
          >
            <button
              className="access-google-button"
              type="submit"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  fill="#4285F4"
                  d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.36Z"
                />
                <path
                  fill="#34A853"
                  d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.23-2.51c-.9.6-2.05.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"
                />
              </svg>

              <span>Continue with Google</span>
            </button>
          </form>
          <AppleSignIn intent={creatingAccount ? "register" : "login"} />
          <div className="access-switch">
            {creatingAccount ? (
              <p>
                Already have an account?{" "}
                <Link href="/agency/login">Sign in</Link>
              </p>
            ) : (
              <p>
                Registering a new agency?{" "}
                <Link href="/agency/register">
                  Create an owner account
                </Link>
              </p>
            )}

            <small>
              Employee access is invitation controlled. Avera
              Privé owners use the private owner portal.
            </small>
          </div>

          <div className="access-security">
            <span>◆</span>

            <p>
              <b>Role-protected access</b>
              Your permissions are verified securely after
              sign-in.
            </p>
          </div>
        </div>
      </main>

      <style>{`
        .access-page .access-google-divider {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: 22px 0;
        }

        .access-page .access-google-divider > span {
          flex: 1;
          height: 1px;
          background: #ded6c9;
        }

        .access-page .access-google-divider > small {
          color: #746b5e;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 2px;
        }

        .access-page .access-google-form {
          width: 100%;
          margin: 0;
        }

        .access-page .access-google-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          min-height: 54px;
          padding: 14px 20px;
          border: 1px solid #d7cdbd;
          border-radius: 0;
          background: #fff;
          color: #171714;
          font-family: Arial, sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .access-page .access-google-button:hover {
          background: #faf7f1;
          border-color: #b69a66;
        }

        .access-page .access-google-button:focus-visible {
          outline: 2px solid #a98a51;
          outline-offset: 4px;
        }

        .access-page .access-google-button > svg {
          flex-shrink: 0;
        }
                  .access-page .access-message h1 {
          font-size: clamp(44px, 5.5vw, 96px);
          line-height: 1.15;
          letter-spacing: 0.01em;
font-variant-ligatures: none;
font-kerning: normal;
          height: auto;
          overflow: visible;
        }

        .access-page .access-message h1 em {
          line-height: inherit;
        }
      `}</style>
    </div>
  );
}