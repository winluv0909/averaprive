import type { NextConfig } from "next";
import { privateIndexHeaders, previewDeployment } from "./lib/seo/settings";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/login.html", destination: "/agency/login", permanent: true },
      { source: "/register.html", destination: "/agency/register", permanent: true },
      { source: "/dashboard.html", destination: "/agency/dashboard", permanent: true },
      { source: "/owner-login", destination: "/owners/login", permanent: true },
    ];
  },
  async headers() {
    return [...privateIndexHeaders(), ...(previewDeployment() ? [{source:"/:path*",headers:[{key:"X-Robots-Tag",value:"noindex, nofollow"}]}] : []), {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    }];
  },
};

export default nextConfig;
