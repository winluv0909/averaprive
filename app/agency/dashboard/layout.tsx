import "../../admin/admin.css";
import "../../dashboard/dashboard.css";
import "../../dashboard/billing.css";
import "../../dashboard/agency-performance.css";
import "../../dashboard/agency-team.css";
import "../../dashboard/payment-processing.css";

import "./agency-premium.css";

import "./checkout-reference.css";

import "./reliable-billing.css";

export const metadata = { robots: { index: false, follow: false } };

export default function AgencyDashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
