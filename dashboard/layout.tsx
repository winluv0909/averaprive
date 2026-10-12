import "../admin/admin.css";
import "./dashboard.css";

export const metadata = { robots: { index: false, follow: false } };
import "./editorial/editorial.css";
import "./billing.css";
import "./agency-performance.css";
import "./agency-team.css";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
