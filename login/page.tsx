import Link from "next/link";
import { signIn, signUp } from "./actions";

export const metadata = {
  title: "Sign in",
  description: "Secure access for Avera Privé agency owners and invited team members.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const creatingAccount = params.mode === "signup";

  return <div className="access-page">
    <a className="access-skip" href="#access-form">Skip to access form</a>
    <aside className="access-brand" aria-label="Avera Privé introduction">
      <div className="access-brand-inner">
        <Link className="access-logo" href="/" aria-label="Avera Privé homepage">
          <img
  src="/ap-monogram-transparent.png"
  alt="Avera Privé"
  className="access-monogram"
/>
          <span><strong>Avera Privé</strong><small>THE GLOBAL AGENCY DIRECTORY</small></span>
        </Link>
        <div className="access-message">
          <p className="access-kicker">AGENCY &amp; COMPANY ACCESS</p>
          <h1>Build trust.<br />Manage your profile.<br /><em>Grow visibly.</em></h1>
          <p>Agency and company owners manage their profile, evidence, reviews, and invited team access from one secure workspace.</p>
        </div>
        <div className="access-role-list" aria-label="Supported account types">
          <span>AGENCY OWNERS</span><i aria-hidden="true" /><span>COMPANY OWNERS</span><i aria-hidden="true" /><span>INVITED EMPLOYEES</span>
        </div>
      </div>
    </aside>
    <main className="access-main">
      <div className="access-form-wrap">
        <Link className="access-back" href="/">← &nbsp; RETURN TO HOMEPAGE</Link>
        <div className="access-heading">
          <p>{creatingAccount ? "AGENCY OWNER REGISTRATION" : "AGENCY WORKSPACE ACCESS"}</p>
          <h2>{creatingAccount ? "Create your account." : "Welcome back."}</h2>
          <span>{creatingAccount ? "Create the owner account that will manage your agency profile and invite your team." : "Sign in with your agency-owner or invited employee account."}</span>
        </div>
        <div className="access-context" aria-label="Account guidance">
          <div><b>Agency owners</b><small>Manage profiles, verification, reviews, and team access.</small></div>
          <div><b>Invited employees</b><small>Use the account invitation provided by your agency administrator.</small></div>
        </div>
        <form id="access-form" className="access-form" autoComplete="off">
          {params.error && <p className="access-alert error" role="alert">{params.error}</p>}
          {params.message && <p className="access-alert success" role="status">{params.message}</p>}
          <input type="hidden" name="next" value={params.next ?? "/agency/dashboard"} />
          <input type="hidden" name="loginPath" value="/agency/login" />
          <label><span>EMAIL ADDRESS</span><input name="email" type="email" placeholder="name@company.com" autoComplete="off" data-lpignore="true" data-1p-ignore required /></label>
          <label><span>PASSWORD</span><input name="password" type="password" placeholder={creatingAccount ? "Create a secure password" : "Enter your password"} minLength={8} autoComplete="new-password" data-lpignore="true" data-1p-ignore required /><small>Minimum of 8 characters.</small></label>
          <button className="access-submit" formAction={creatingAccount ? signUp : signIn}>{creatingAccount ? "CREATE AGENCY OWNER ACCOUNT" : "SIGN IN SECURELY"}<span>→</span></button>
        </form>
        <div className="access-switch">
          {creatingAccount ? <p>Already have an account? <Link href="/agency/login">Sign in</Link></p> : <p>Registering a new agency? <Link href="/agency/register">Create an owner account</Link></p>}
          <small>Employee access is invitation controlled. Avera Privé owners use the private owner portal.</small>
        </div>
        <div className="access-security"><span>◆</span><p><b>Role-protected access</b>Your permissions are verified securely after sign-in.</p></div>
      </div>
    </main>
  </div>;
}
