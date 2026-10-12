import Link from "next/link";
import { signIn } from "@/app/login/actions";

export const metadata = {
  title: "Owner sign in",
  description: "Private owner access for Avera Privé platform administration.",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;

  return <div className="access-page owner-access-page">
    <a className="access-skip" href="#access-form">Skip to owner sign-in</a>
    <aside className="access-brand" aria-label="Avera Privé owner portal">
      <div className="access-brand-inner">
        <Link className="access-logo" href="/" aria-label="Avera Privé homepage">
          <img
  src="/ap-monogram-transparent.png"
  alt="Avera Privé"
  className="access-monogram"
/>
          <span><strong>Avera Privé</strong><small>PRIVATE OWNER PORTAL</small></span>
        </Link>
        <div className="access-message">
          <p className="access-kicker">OWNERS & AUTHORIZED STAFF</p>
          <h1>Private control.<br />Trusted decisions.<br /><em>Protected access.</em></h1>
          <p>This portal is reserved for authorized Avera Privé owners and staff. Moderation, verification, review, and trust operations remain separated from agency workspaces.</p>
        </div>
        <div className="access-role-list" aria-label="Owner portal functions">
          <span>MODERATION</span><i aria-hidden="true" /><span>VERIFICATION</span><i aria-hidden="true" /><span>TRUST OPERATIONS</span>
        </div>
      </div>
    </aside>
    <main className="access-main">
      <div className="access-form-wrap">
        <Link className="access-back" href="/">← &nbsp; RETURN TO HOMEPAGE</Link>
        <div className="access-heading">
          <p>PRIVATE OWNER ACCESS</p>
          <h2>Platform sign in.</h2>
          <span>Continue with your assigned owner or staff account.</span>
        </div>
        <div className="access-context owner-context" aria-label="Owner access notice">
          <div><b>Restricted portal</b><small>Access is granted only to authorized Avera Privé platform owners.</small></div>
          <div><b>No public registration</b><small>Additional owners must be assigned securely by an existing owner.</small></div>
        </div>
        <form id="access-form" className="access-form" autoComplete="off">
          {params.changed && <p className="access-alert" role="status">Password updated. Sign in with your new password.</p>}
          {params.error && <p className="access-alert error" role="alert">{params.error}</p>}
          <input type="hidden" name="next" value="/owners/dashboard" />
          <input type="hidden" name="loginPath" value="/owners/login" />
          <label><span>ACCOUNT EMAIL ADDRESS</span><input name="email" type="email" placeholder="owner@agencyprive.com" autoComplete="off" data-lpignore="true" data-1p-ignore required /></label>
          <label><span>PASSWORD</span><input name="password" type="password" placeholder="Enter your password" minLength={8} autoComplete="current-password" data-lpignore="true" data-1p-ignore required /></label>
          <button className="access-submit" formAction={signIn}>ENTER OWNER PORTAL<span>→</span></button>
        </form>
        <div className="access-switch"><p>Managing an agency profile? <Link href="/agency/login">Use agency sign in</Link></p></div>
        <div className="access-security"><span>◆</span><p><b>Role-protected access</b>Authentication alone does not grant entry; the owner role is checked on every protected page.</p></div>
      </div>
    </main>
  </div>;
}
