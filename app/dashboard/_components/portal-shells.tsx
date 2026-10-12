import Link from "next/link";
import { signOut, signOutAdmin } from "@/app/login/actions";
import { AgencyNavigation } from "./agency-navigation";

type OwnerSection =
  | "platform_reviews"
  | "directory"
  | "moderation"
  | "verification"
  | "reviews"
  | "trust"
  | "fraud"
  | "placements"
  | "analytics"
  | "inquiries"
  | "subscriptions"
  | "editorial"
  | "audit"
  | "team"
  | "support";

type AgencySection =
  | "overview"
  | "create"
  | "review"
  | "support";

export async function OwnerOperationsShell({
  active,
  email,
  children,
}: {
  active: OwnerSection;
  email?: string;
  children: React.ReactNode;
}) {
  const { createClient } = await import("@/lib/supabase/server");
  const { platformHome } = await import("@/lib/auth/platform-access");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = user ? await supabase.from("ap_staff_roles").select("role").eq("user_id", user.id) : { data: null };
  const roles = (data || []).map(item => item.role);
  const owner = roles.includes("super_admin");
  return (
    <div className="admin-shell owner-premium">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href={platformHome(roles)}>
          <span className="admin-brand-mark">
            AP<i>✦</i>
          </span>

          <span>
            <b>Avera Privé</b>
            <small>OWNER OPERATIONS</small>
          </span>
        </Link>

        <nav className="admin-nav" aria-label="Platform workspace navigation">
          <p>WORKSPACE</p>
          {owner && <Link href="/owners/dashboard"><span aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg></span>Overview</Link>}
          {[
            {path:"moderation",label:"Moderation",roles:["moderator"]},
            {path:"verifications",label:"Verification",roles:["verification_reviewer"]},
            {path:"reviews",label:"Review queue",roles:["moderator"]},
            {path:"directory",label:"Directory & claims",roles:[]},
            {path:"platform-reviews",label:"Platform reviews",roles:[]},
            {path:"trust",label:"Reports & disputes",roles:["moderator","support"]},
            {path:"fraud",label:"Fraud review",roles:["moderator","verification_reviewer"]},
            {path:"placements",label:"Sponsored placements",roles:["finance"]},
            {path:"analytics",label:"Marketplace analytics",roles:["finance"]},
            {path:"inquiries",label:"Inquiry operations",roles:["support"]},
            {path:"subscriptions",label:"Subscriptions",roles:["finance"]},
            {path:"payments",label:"Payment review",roles:["finance"]},
            {path:"support",label:"Support tickets",roles:["support"]},
            {path:"editorial",label:"The Privé Edit",roles:["moderator"]},
            {path:"audit",label:"Audit log",roles:[]},
          ].filter(item=>owner||item.roles.some(role=>roles.includes(role))).map(item=><Link key={item.path} href={`/owners/dashboard/${item.path}`} className={active===item.path||(active==="verification"&&item.path==="verifications")?"active":""}><span aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg></span>{item.label}</Link>)}
          <p>ACCOUNT</p><Link href="/owners/account"><span aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg></span>Account security</Link>
          {owner && <Link href="/owners/dashboard/team" className={active==="team"?"active":""}><span aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg></span>Staff accounts</Link>}
          <p>QUICK ACCESS</p><Link href="/" target="_blank" rel="noopener noreferrer"><span aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg></span>View public website ↗</Link>
        </nav>

        <div className="admin-sidebar-account">
          <span>AP</span>

          <div>
            <b>{owner ? "Platform owner" : "Platform staff"}</b>
            <small>{email}</small>
          </div>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <span className="admin-mobile-brand">
              AP
            </span>

            <p className="owner-breadcrumb">Owner portal <span>/</span> Workspace</p>
          </div>

          <div className="admin-top-actions">
            <Link className="owner-public-link" href="/" target="_blank" rel="noopener noreferrer">
              View public website <span aria-hidden="true">↗</span>
            </Link>

            <form action={signOutAdmin}>
              <button type="submit">Log out</button>
            </form>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}



export function AgencyWorkspaceShell({
  active = "overview",
  email,
  children,
}: {
  active?: AgencySection;
  email?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="agency-shell">
      <aside className="agency-sidebar">
        <Link className="agency-brand" href="/">
          <span>
            AP<i>✦</i>
          </span>

          <div>
            <b>Avera Privé</b>
            <small>AGENCY WORKSPACE</small>
          </div>
        </Link>
         <AgencyNavigation />

        <div className="agency-account">
          <span>
            {email?.[0]?.toUpperCase() ?? "A"}
          </span>

          <div>
            <b>Signed in</b>
            <small>{email}</small>
          </div>
        </div>
      </aside>

      <div className="agency-workspace">
        <header className="agency-topbar">
          <p>SECURE AGENCY PORTAL</p>

          <div>
  <Link
    href="/"
    target="_blank"
    rel="noopener noreferrer"
    className="agency-view-site-btn"
  >
    <span>View website</span>
    <span
      className="agency-view-site-arrow"
      aria-hidden="true"
    >
      ↗
    </span>
  </Link>

  <form action={signOut}>
    <button>LOG OUT</button>
  </form>
</div>
        </header>

        {children}
      </div>
    </div>
  );
}