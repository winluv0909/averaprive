# Avera Privé

One Next.js application deployed through one Vercel project.

| Experience | Entry route |
|---|---|
| Public website | `/` |
| Agency workspace | `/agency/login` |
| Owner operations | `/owners/login` |

## Requirements

- Use Node.js 24 for consistency with the verified local environment.
- Install dependencies using npm and the committed package-lock.json.
- Use the existing Supabase and Vercel projects for ongoing deployment.

## Local setup

Run `npm ci`. For a new checkout, copy `.env.example` to `.env.local`
and populate the required values. Preserve an existing `.env.local`.

Run `npm run dev` and open http://localhost:3000.

Never commit secrets or expose the Supabase service-role key in browser code.

## Database

See docs/DATABASE-SETUP.md and docs/DATABASE-MIGRATION-ORDER.md.

Existing databases must receive only reviewed, unapplied migrations.
Do not recreate the database or replay the entire migration chain.

The production migration chain no longer inserts fictional agencies or
simulated external ratings. Demo safeguards remain in the schema.
Removing seed inserts does not delete records in an existing database.

## Verification

Run `npm run verify` for typecheck, lint, tests, and production build.
Run `npm audit` for all dependencies and `npm audit --omit=dev`
for production dependencies.

Browser acceptance tests are separate: `npm run test:e2e`.

## Deployment

Push reviewed changes to the connected repository and confirm the matching
Vercel deployment is Ready. Configure environment values for the intended
deployment environment; use `.env.example` as a reference, not as proof
that production configuration is complete.

## Billing and launch

The current billing work uses PayPal and crypto payment workflows.
Live payment activation, provider settings, monitoring, invoice delivery,
and recovery behavior require separate production confirmation.

Trustpilot feedback is independent of Avera Privé verification.
Publish only sourced and reviewed agency information.

See docs/LAUNCH-CHECKLIST.md and docs/RELEASE-READINESS.md.
A successful deployment does not by itself establish public-launch readiness.