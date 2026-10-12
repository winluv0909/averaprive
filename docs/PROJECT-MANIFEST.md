# Project manifest

## Public website

- Homepage, About, Directory, Agency Profile, Compare, Rankings, Reviews, Trust, Pricing, For Agencies, Demo, and The Privé Edit.
- Responsive desktop, tablet, and mobile styles in `public/css/`.
- Public directory and editorial APIs backed by moderated Supabase data.

## Agency workspace

- Separate registration and sign-in.
- Agency drafts, editing, moderation submission, and publication state.
- Independent verification submission.
- Reviews and agency responses.
- Team invitations and roles.
- Lead inbox, profile analytics, plan entitlements, and support center.

## Owner operations

- Dashboard metrics and inquiries.
- Agency profile moderation with approve, reject, request changes, and publish decisions.
- Independent verification queue.
- Review moderation and evidence checks.
- Reports, disputes, fraud investigations, case decisions, and audit trail.
- Sponsored placement operations kept separate from trust and objective ranking.
- Subscription operations.
- Editorial CMS for long-form and visual posts.
- Support queue with public replies and internal notes.

## Database

- Seventeen named, ordered SQL migrations in `supabase/migrations/`.
- Row-level security and role-aware RPC functions.
- Publication, verification, reviews, reports, disputes, fraud, support, subscriptions, analytics, invitations, editorial, audit, and source provenance.
- Twenty fictional OFM demonstration profiles with permanent disclosure and exclusions from verification, inquiries, sponsorship, and production analytics. Simulated external-rating states are visually disclosed and never presented as live Trustpilot data.

## Quality gates

- TypeScript typecheck.
- ESLint.
- Vitest unit and database-contract tests.
- Next.js production build.

See `README.md`, `docs/DATABASE-SETUP.md`, `docs/TRUSTPILOT-SETUP.md`, and `docs/LAUNCH-CHECKLIST.md` before deployment.
