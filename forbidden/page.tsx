import Link from "next/link";

export const metadata = { title: "Access restricted", robots: { index: false, follow: false } };

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ portal?: string }>;
}) {
  const { portal } = await searchParams;
  const ownerPortal = portal === "owner";

  return <main className="forbidden-page">
    <section className="forbidden-card">
      <Link className="forbidden-brand" href="/">AP <span>Avera Privé</span></Link>
      <p className="eyebrow">ACCESS RESTRICTED</p>
      <h1>This workspace is not assigned to your account.</h1>
      <p>{ownerPortal
        ? "The private owner portal is available only to authorized Avera Privé platform owners."
        : "Ask your agency owner to confirm your active membership and workspace permissions."}</p>
      <div>
        <Link className="forbidden-primary" href={ownerPortal ? "/owners/login" : "/agency/dashboard"}>{ownerPortal ? "RETURN TO OWNER LOGIN" : "RETURN TO AGENCY WORKSPACE"}</Link>
        <Link href="/">VIEW PUBLIC WEBSITE</Link>
      </div>
    </section>
  </main>;
}
