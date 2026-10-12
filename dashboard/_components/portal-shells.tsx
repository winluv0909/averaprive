import Link from "next/link";
import { signOut, signOutAdmin } from "@/app/login/actions";
import { AgencyNavigation } from "./agency-navigation";

type OwnerSection =
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
  | "support";

type AgencySection =
  | "overview"
  | "create"
  | "review"
  | "support";

export function OwnerOperationsShell({
  active,
  email,
  children,
}: {
  active: OwnerSection;
  email?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/owners/dashboard">
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

          <Link href="/owners/dashboard">
            <span>⌂</span>
            Overview
          </Link>

          <p>TRUST OPERATIONS</p>

          <Link
            className={
              active === "moderation" ? "active" : ""
            }
            href="/owners/dashboard/moderation"
          >
            <span>◇</span>
            Moderation
          </Link>

          <Link
            className={
              active === "verification" ? "active" : ""
            }
            href="/owners/dashboard/verifications"
          >
            <span>✓</span>
            Verification
          </Link>

          <Link
            className={
              active === "reviews" ? "active" : ""
            }
            href="/owners/dashboard/reviews"
          >
            <span>☆</span>
            Review queue
          </Link>

          <Link
            className={
              active === "trust" ? "active" : ""
            }
            href="/owners/dashboard/trust"
          >
            <span>!</span>
            Reports &amp; disputes
          </Link>

          <Link
            className={
              active === "fraud" ? "active" : ""
            }
            href="/owners/dashboard/fraud"
          >
            <span>⌁</span>
            Fraud review
          </Link>

          <p>COMMERCIAL</p>

          <Link
            className={
              active === "placements" ? "active" : ""
            }
            href="/owners/dashboard/placements"
          >
            <span>◆</span>
            Sponsored placements
          </Link>

          <Link
            className={
              active === "analytics" ? "active" : ""
            }
            href="/owners/dashboard/analytics"
          >
            <span>↗</span>
            Marketplace analytics
          </Link>

          <Link
            className={
              active === "inquiries" ? "active" : ""
            }
            href="/owners/dashboard/inquiries"
          >
            <span>✉</span>
            Inquiry operations
          </Link>

          <Link
            className={
              active === "subscriptions" ? "active" : ""
            }
            href="/owners/dashboard/subscriptions"
          >
            <span>$</span>
            Subscriptions
          </Link>

          <p>SUPPORT</p>

          <Link
            className={
              active === "support" ? "active" : ""
            }
            href="/owners/dashboard/support"
          >
            <span>?</span>
            Support tickets
          </Link>

          <p>EDITORIAL</p>

          <Link
            className={
              active === "editorial" ? "active" : ""
            }
            href="/owners/dashboard/editorial"
          >
            <span>¶</span>
            The Privé Edit
          </Link>

          <p>GOVERNANCE</p>

          <Link
            className={
              active === "audit" ? "active" : ""
            }
            href="/owners/dashboard/audit"
          >
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
          <span>AP</span>

          <div>
            <b>Platform owner</b>
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

            <p>PRIVATE PLATFORM CONTROL</p>
          </div>

          <div className="admin-top-actions">
            <Link href="/owners/dashboard">
              OVERVIEW
            </Link>

            <form action={signOutAdmin}>
              <button>LOG OUT</button>
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
    <span>VIEW WEBSITE</span>
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