import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Access restricted",
  robots: { index: false, follow: false },
};

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ portal?: string; error?: string }>;
}) {
  const { portal } = await searchParams;
  const ownerPortal = portal === "owner";

  let platformAccount = false;
  let accessCheckFailed = false;

  if (!ownerPortal) {
    const supabase = await createClient();

    const {
      data: { user },
      error: authenticationError,
    } = await supabase.auth.getUser();

    if (authenticationError) {
      accessCheckFailed = true;
    } else if (user) {
      const { data: staffRoles, error: roleError } = await supabase
        .from("ap_staff_roles")
        .select("role")
        .eq("user_id", user.id);

      accessCheckFailed = Boolean(roleError) || staffRoles === null;
      platformAccount = !accessCheckFailed && Boolean(staffRoles?.length);
    }
  }

  const title = platformAccount
    ? "Please use the owner portal."
    : accessCheckFailed
      ? "We couldn’t verify your access."
      : "This workspace is not assigned to your account.";

  const description = platformAccount
    ? "You’re signed in with a platform staff account. Agency workspaces require a separate agency account."
    : accessCheckFailed
      ? "Your account permissions could not be checked. Please return to login and try again."
      : ownerPortal
        ? "The private owner portal is available only to authorized Avera Privé platform owners."
        : "Ask your agency owner to confirm your active membership and workspace permissions.";

  const primaryHref =
    ownerPortal || platformAccount ? "/owners/login" : "/agency/login";

  const primaryLabel = platformAccount
    ? "Go to owner login"
    : ownerPortal
      ? "Return to owner login"
      : "Return to agency login";

  return (
    <main className="forbidden-page forbidden-page--refined">
      <section
        className="forbidden-card"
        aria-labelledby="access-restricted-title"
      >
        <Link
          className="forbidden-brand"
          href="/"
          aria-label="Avera Privé homepage"
        >
          <span className="forbidden-monogram" aria-hidden="true">
            AP
          </span>

          <span className="forbidden-wordmark">Avera Privé</span>
        </Link>

        <div className="forbidden-status-icon" aria-hidden="true">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
          >
            <rect
              x="5"
              y="10"
              width="14"
              height="11"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M8 10V7a4 4 0 0 1 8 0v3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle
              cx="12"
              cy="15"
              r="1"
              fill="currentColor"
            />
            <path
              d="M12 16v2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <p className="eyebrow">ACCESS RESTRICTED</p>

        <h1 id="access-restricted-title">{title}</h1>

        <p className="forbidden-description">{description}</p>

        <div className="forbidden-actions">
          <Link className="forbidden-primary" href={primaryHref}>
            {primaryLabel}
            <span aria-hidden="true">→</span>
          </Link>

          <Link className="forbidden-secondary" href="/">
            View public website
          </Link>
        </div>

        <p className="forbidden-footer">
          Separate workspaces. Protected access.
        </p>
      </section>

      <style>{`
        .forbidden-page.forbidden-page--refined {
          box-sizing: border-box;
          display: grid;
          place-items: center;
          width: 100%;
          max-width: none;
          min-height: 100svh;
          margin: 0;
          padding: 40px 20px;
          background: #f5f2ec;
          color: #171513;
        }

        .forbidden-page--refined,
        .forbidden-page--refined * {
          box-sizing: border-box;
        }

        .forbidden-page--refined .forbidden-card {
          width: 100%;
          max-width: 560px;
          padding: 44px;
          border: 1px solid #e3dcd0;
          border-radius: 16px;
          background: #ffffff;
          box-shadow: 0 18px 60px rgba(35, 30, 22, 0.06);
        }

        .forbidden-page--refined .forbidden-brand {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          width: auto;
          margin: 0 0 36px;
          color: #171513;
          text-decoration: none;
        }

        .forbidden-page--refined .forbidden-monogram {
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border: 1px solid #d6c5ab;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 23px;
          font-weight: 600;
          letter-spacing: -1px;
        }

        .forbidden-page--refined .forbidden-wordmark {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 18px;
          font-weight: 600;
          letter-spacing: 1px;
        }

        .forbidden-page--refined .forbidden-status-icon {
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          margin: 0 0 22px;
          border: 1px solid #e9dfcf;
          border-radius: 12px;
          background: #faf6ee;
          color: #957446;
        }

        .forbidden-page--refined .eyebrow {
          margin: 0 0 12px;
          color: #957446;
          font-family: Arial, sans-serif;
          font-size: 10px;
          font-weight: 700;
          line-height: 1.5;
          letter-spacing: 2px;
        }

        .forbidden-page--refined .forbidden-card h1 {
          max-width: none;
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(30px, 4vw, 40px);
          font-weight: 400;
          line-height: 1.15;
          letter-spacing: -1px;
          text-wrap: balance;
        }

        .forbidden-page--refined
          .forbidden-card > .forbidden-description {
          max-width: none;
          margin: 18px 0 0;
          color: #746c61;
          font-family: Arial, sans-serif;
          font-size: 14px;
          line-height: 1.75;
        }

        .forbidden-page--refined .forbidden-actions {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
          margin: 28px 0 0;
        }

        .forbidden-page--refined .forbidden-actions a {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 48px;
          padding: 14px 18px;
          border-radius: 7px;
          font-family: Arial, sans-serif;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.5;
          letter-spacing: 0.2px;
          text-align: center;
          text-decoration: none;
          transition:
            background-color 150ms ease,
            border-color 150ms ease;
        }

        .forbidden-page--refined
          .forbidden-actions .forbidden-primary {
          gap: 12px;
          border: 1px solid #171513;
          background: #171513;
          color: #ffffff;
        }

        .forbidden-page--refined .forbidden-primary:hover {
          border-color: #39332b;
          background: #39332b;
        }

        .forbidden-page--refined
          .forbidden-actions .forbidden-secondary {
          border: 1px solid #e3dcd0;
          background: #ffffff;
          color: #51493e;
        }

        .forbidden-page--refined .forbidden-secondary:hover {
          border-color: #cdbda5;
          background: #faf7f1;
        }

        .forbidden-page--refined a:focus-visible {
          outline: 2px solid #957446;
          outline-offset: 4px;
        }

        .forbidden-page--refined
          .forbidden-card > .forbidden-footer {
          max-width: none;
          margin: 26px 0 0;
          padding-top: 20px;
          border-top: 1px solid #eee8de;
          color: #9a9185;
          font-family: Arial, sans-serif;
          font-size: 11px;
          line-height: 1.6;
          text-align: center;
        }

        @media (max-width: 560px) {
          .forbidden-page.forbidden-page--refined {
            padding: 24px 16px;
          }

          .forbidden-page--refined .forbidden-card {
            padding: 30px 24px;
            border-radius: 12px;
          }

          .forbidden-page--refined .forbidden-brand {
            margin-bottom: 28px;
          }

          .forbidden-page--refined .forbidden-card h1 {
            font-size: 32px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .forbidden-page--refined .forbidden-actions a {
            transition: none;
          }
        }
      `}</style>
    </main>
  );
}