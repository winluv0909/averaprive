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
## Browser checks (Step 06)

Run `npx playwright install chromium` once after installing dependencies, then
`npm run test:e2e`. Playwright starts its own isolated local server on port 3106.
The current suite contains 16 desktop/mobile cases. It uses sample directory
responses and submits no account or payment forms. This suite is separate from
`npm run verify` and is not automatically run by GitHub without a CI workflow.
Passing these checks is not full acceptance testing of real login or payments.

## Password recovery (Step 05)

Agency and owner/staff login link to `/forgot-password`. The email callback is
`/auth/recovery`; the new password form is `/reset-password`. Add the HTTPS
recovery callback to Supabase Authentication's permitted redirect URLs.
The default email template uses PKCE: request and open the link in the same
browser profile. Custom token-hash templates are supported by the callback.
Never reuse recovery links or share their tokens. Owner recovery was manually
confirmed; agency/staff recovery and production SMTP need separate validation.
Supabase's built-in email sender is limited; invoice delivery via Resend does
not configure Supabase Auth SMTP.

## Search-engine configuration (Step 07)

`app/robots.ts` and `app/sitemap.ts` are the discovery-file sources. Remove the
obsolete `public/robots.txt` and `public/sitemap.xml` copies during Step 07
installation. `NEXT_PUBLIC_SITE_URL` should be the intended HTTPS public origin;
the generated files default to https://averaprive.vercel.app if it is invalid.
Update this setting and the reviews-page canonical link when changing domains.
Preview deployments advertise no crawling and receive noindex headers.
Account/API routes receive noindex headers; login and permissions protect data.
Crawl directives and noindex headers do not guarantee removal of old search
results, immediate indexing or rankings. Inspect the deployed discovery files
and use Search Console after choosing the official domain.
