import Image from "next/image";
import Link from "next/link";
import { requireStaffRole } from "@/lib/auth/authorization";
import { needsPasswordChange, platformHome, platformRoles } from "@/lib/auth/platform-access";
import { signOutAdmin } from "@/app/login/actions";
import PasswordForm from "./PasswordForm";
import "./account-premium.css";

export const metadata = { title: "Account security", robots: { index: false, follow: false } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user, supabase } = await requireStaffRole([...platformRoles], { allowPasswordSetup: true });
  const query = await searchParams;
  const { data } = await supabase.from("ap_staff_roles").select("role").eq("user_id", user.id);
  const roles = (data || []).map(item => item.role);
  const required = needsPasswordChange(user.app_metadata);
  const owner = roles.includes("super_admin");

  return <main className="ap-security-page">
    <header className="ap-security-topbar"><Link className="ap-security-brand" href="/" aria-label="Avera Privé homepage"><Image src="/ap-monogram-transparent.png" width={42} height={42} alt=""/><span><strong>Avera Privé</strong><small>PRIVATE PLATFORM WORKSPACE</small></span></Link><span className="ap-security-top-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 3 20 6v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></svg> Account security</span></header>
    <div className="ap-security-layout">
      <aside className="ap-security-story" aria-label="Account setup introduction"><div className="ap-security-story-content"><p className="ap-security-kicker">YOUR WORKSPACE. YOUR ACCESS.</p><h1>Your access.<br/>Your control.<br/><em>Your private<br/>password.</em></h1><p className="ap-security-story-description">A considered first step for the people behind Avera Privé. Set a password you keep private, then continue to your workspace.</p><div className="ap-security-story-rule"/><div className="ap-security-steps"><div data-active={required}><span>01</span><p><strong>{required ? "Personalize your access" : "Keep your access private"}</strong><small>Choose a new password for your account.</small></p></div><div><span>02</span><p><strong>Continue with confidence</strong><small>Sign in again to enter your workspace.</small></p></div></div></div><div className="ap-security-story-footer"><span>AVERA PRIVÉ</span><small>For the people who build trust.</small></div><span className="ap-security-watermark" aria-hidden="true">AP</span></aside>
      <section className="ap-security-card" aria-labelledby="ap-security-title"><div className="ap-security-card-top"><span className="ap-security-shield" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M12 3 20 6v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></svg></span><span className="ap-security-stage">{required ? "ACCOUNT SETUP · FINAL STEP" : "ACCOUNT SETTINGS · SECURITY"}</span></div><p className="ap-security-kicker">{required ? "WELCOME TO YOUR WORKSPACE" : "YOUR ACCOUNT SECURITY"}</p><h2 id="ap-security-title">{required ? "Make it yours." : "A fresh password."}</h2><p className="ap-security-card-description">{required ? "Replace your sign-in password with one you keep private. Complete this step to unlock your workspace." : "Verify your current password, then choose a new one to protect your account."}</p>
        <div className="ap-security-identity"><span className="ap-security-avatar" aria-hidden="true">{owner ? "AP" : "TM"}</span><div><small>YOU ARE SIGNED IN AS</small><strong>{user.email}</strong></div><span className="ap-security-role">{owner ? "Owner" : "Staff"}</span></div>
        {query.error && <div className="ap-security-error" role="alert"><strong>Password not updated</strong><p>{query.error}</p></div>}
        <PasswordForm required={required}/>
        <footer className="ap-security-card-footer"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 3 20 6v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/></svg> Your new password is not shown to other users.</span><div>{!required && <Link href={platformHome(roles)}>Back to workspace</Link>}<form action={signOutAdmin}><button type="submit">Sign out <span aria-hidden="true">↗</span></button></form></div></footer>
      </section>
    </div>
    <footer className="ap-security-page-footer"><span>AVERA PRIVÉ · PRIVATE PLATFORM ACCESS</span><Link href="/">Return to homepage →</Link></footer>
  </main>;
}
