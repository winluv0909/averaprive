# Avera Privé

Avera Privé is one unified Next.js application with three clearly separated experiences:

| Side | Purpose | Primary route |
|---|---|---|
| Public website | Discovery, directory, comparison, rankings, editorial, pricing, trust information | `/` |
| Agency workspace | Registration, profiles, team access, submissions, verification, reviews, leads, analytics, billing, support | `/agency/login` |
| Owner operations | Moderation, verification, review integrity, disputes, fraud, placements, subscriptions, editorial, analytics, audit, support | `/owners/login` |

It deploys as **one Vercel project and one domain**. Authentication and authorization determine which private workspace a signed-in user may access.

## Requirements

- Node.js 20.9+
- npm 10+
- A new Supabase project
- A Vercel project for production deployment

## Local setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Fill `.env.local` before signing in. Open `http://localhost:3000`.

Do not copy `.next`, `node_modules`, `.git`, `.vscode`, `.vercel`, or an old `.env.local` from another project. Install dependencies from `package-lock.json` and enter environment values locally.

## Database

The database is a clean, ordered migration set. Follow [docs/DATABASE-SETUP.md](docs/DATABASE-SETUP.md). Every SQL file has a descriptive filename and must be applied once in filename order.

Core controls include:

- Separate agency publication and independent verification decisions.
- Evidence-gated review publication and anti-fraud investigations.
- Reports, disputes, decision history, and immutable staff audit events.
- Clearly labeled sponsored placements that do not modify objective trust status.
- Role-based agency teams and email-bound invitation acceptance.
- Support tickets, conversation history, internal staff notes, priority, assignment, SLA fields, and audit events.
- Editorial CMS for articles, interviews, reports, graphics, spotlights, and case studies.
- Subscription entitlements, inquiry operations, and privacy-aware marketplace analytics.

## Verification

```bash
npm run verify
```

This runs TypeScript, ESLint, unit/database-contract tests, and a production build.

## Deployment

1. Push this project to a private GitHub repository.
2. Import that repository into Vercel.
3. Add the values from `.env.example` to Vercel.
4. Add the production origin and `/auth/callback` to Supabase Auth URL configuration.
5. Follow [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md).

## Important launch boundaries

- The included subscription workflow does not process live cards until Stripe checkout, customer portal, and signed webhooks are connected.
- Trustpilot is third-party platform feedback, not Avera Privé verification. Follow [docs/TRUSTPILOT-SETUP.md](docs/TRUSTPILOT-SETUP.md).
- Real agencies must not be seeded with scraped or unsupported ratings. Publish only sourced, reviewed records and store provenance in `ap_agency_sources`.
- Legal policies and production security configuration require final review before public launch.
- The 20 included OFM demo profiles are fictional, cannot receive trust signals or leads, and can be hidden with `NEXT_PUBLIC_SHOW_DEMO_AGENCIES=false`. Any displayed external score is explicitly simulated and is not live Trustpilot data.
