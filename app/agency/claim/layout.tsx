import "./claim.css";
export default function ClaimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="claim-page">{children}</div>;
}
