# Avera Privé release readiness

## Code status

This package is deployment-ready application code for one Vercel project containing the public website, agency workspace, and owner operations workspace. The production build, TypeScript check, ESLint, unit tests, database-contract tests, local-asset validation, and navigation-link validation pass in the delivery environment.

The public layout uses a consistent responsive vertical rhythm: approximately 80–88px between major desktop sections and 58–64px on mobile, with separate hero/header clearance. Agency and owner workspaces use compact 34–44px page padding and responsive side navigation.

## Required before official public launch

1. Create a clean Supabase project and apply all 17 queries in `DATABASE-QUERIES.md` in order.
2. Create the first `super_admin`; configure Supabase Site URL, redirect URLs, SMTP, email templates, and CAPTCHA.
3. Configure every Vercel environment variable from `.env.example`. Never expose the service-role key in browser code.
4. Replace the generic Trustpilot destination only after the official Avera Privé business profile is active. Trustpilot is independent of Avera Privé verification.
5. Replace placeholder support contact details and add official social-profile destinations when those accounts are active.
6. Obtain qualified legal review of `public/legal.html`, then add the registered entity, jurisdiction, contact details, retention schedule, service providers, payment terms, and consent implementation.
7. Connect Stripe Checkout, customer portal, and signed webhooks before accepting live payments. Current subscription records and entitlements do not process cards by themselves.
8. Configure production monitoring, backups, rate limiting, incident contacts, and data-retention operations.
9. Decide whether demo agencies should remain visible. Set `NEXT_PUBLIC_SHOW_DEMO_AGENCIES=false` to hide all fictional profiles in production.
10. Complete final acceptance tests with separate agency-owner, moderator, verification-reviewer, support, finance, and super-admin accounts.

## Demo-data boundary

The 20 included agencies are fictional OFM demonstrations. They are disclosed as samples, cannot accept inquiries or obtain verification, are excluded from sponsorship and production analytics, and contain no fabricated Trustpilot profile URLs. Simulated external scores exist only to test rating, unavailable, and no-profile interface states.
