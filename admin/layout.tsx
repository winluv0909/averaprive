import "./admin.css";
import "../dashboard/dashboard.css";

export const metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
