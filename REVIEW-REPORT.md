# Avera Privé website review

Status: automated checks passed; live acceptance checks remain. This is not a claim that every page and live workflow has been tested in a browser.

## Verification

| Check | Result |
|---|---|
| TypeScript | Passed |
| Optimized Next.js production build | Passed |
| Automated tests | 198 tests across 22 files passed |
| ESLint | Zero errors; eight existing image/unused-property warnings |
| Static public HTML asset references | Three missing logo references found and fixed |
| Changed public JavaScript syntax | Passed Node syntax checks |
| Browser/mobile acceptance | Not performed in this environment |
| Live Supabase, email, RPC providers and payment transactions | Not performed; credentials were intentionally excluded |

The database tests use isolated PGlite fixtures, and external payment/provider tests use controlled responses. They do not verify your deployed database or real payments. The Next.js build completed with 64 static-generation tasks and compiled the dynamic routes. An early local build failed due to my dependency symlink, corrected before the successful build. A security fixture timed out when heavy tasks ran concurrently; its budget was adjusted to accommodate database startup, and the final full suite passed.

## Changes

- Added Account security for owners and staff, with current-password verification, matching new passwords and 12–128 character validation.
- Mandatory first-login setup uses administrator-controlled app metadata. Every guarded staff server operation redirects pending users to setup. The migration also blocks database staff privileges through ap_private.is_staff until the password changes.
- An auth.users password-change trigger clears the setup gate only when the stored password changes. User-editable profile metadata cannot clear it.
- Successful password rotation requests global Supabase sign-out and returns to login. Existing access tokens can remain valid until their expiry; Supabase global sign-out revokes refresh sessions.
- Added owner-only staff account creation with moderator, verification reviewer, support and finance roles. Each account gets a temporary password and first-login setup. The form has no artificial count limit and cannot create or promote owners.
- Staff can now sign in and land on their permitted operations. Navigation shows the operations assigned to their roles. Existing server role checks and database policies remain the permission boundary.
- A failed role lookup now fails closed in the staff authorization helper.
- Agency OAuth callbacks reject platform accounts before agency provisioning.
- Fixed the stale brand-name slug expectation without changing valid slug behavior.
- Replaced obsolete duplicate checkout/payment implementations outside app/ with forwards to the active implementation. Backup folders are excluded from linting.
- Fixed missing logo references on the homepage, about and pricing pages.
- The comparison page previously fetched an empty static JSON file. It now fetches the same approved-agency API as the live directory. Improved its failure message and fixed garbled characters in comparison/profile text.

## Role access

| Role | Default landing page | Typical operations |
|---|---|---|
| Platform owner (super_admin) | Overview | Full platform administration and staff creation |
| Moderator | Moderation | Moderation, reviews, reports/disputes, fraud, editorial |
| Verification reviewer | Verifications | Verification and fraud review |
| Support | Support tickets | Support, inquiries, reports/disputes |
| Finance | Payment review | Payments, subscriptions, placements and analytics |

The current standalone editor database role is not offered by this form because the existing editorial operations authorize moderator/super_admin. The user requested two official owners; create/assign those separately. This update does not impose a database-wide two-owner cap while the test owner still exists.

## Required live acceptance checks

1. Apply the migration in the actual Avera Privé project and complete first-login setup with the test owner.
2. Create a test moderator from the owner page. Verify setup redirect and role-restricted pages with both direct URLs and normal navigation. Repeat with support, verification and finance if those roles will be used at launch.
3. Verify anonymous visitors cannot open protected pages or invoke staff actions; agency users cannot open owner operations; staff cannot use the agency portal.
4. Test registration, email confirmation/OAuth, agency provisioning, claims, publication, reviews, moderation, support, inquiries and agency team permissions against the real database.
5. Check public directory search/filtering, comparison, published profiles, rankings and editorial content against real published records. Check desktop and phone layouts.
6. Verify invoice amount, copy buttons, countdown, QR address, monitor timestamps, expired invoices, PDF downloads and refresh behavior.
7. Test actual payment detection, required confirmations/finality, subscription activation and invoice email delivery end to end. The completed monitoring test does not prove these remaining stages.
8. Configure/verify a public password-recovery flow and email sender before launch. This package includes signed-in password changes only.
9. Create and verify both official owner accounts before deleting either test account. Inventory all test records and take a real database backup before cleanup.

## Deployment prerequisites

- Configure the actual Vercel production variables; no credentials were added to this package. Set NEXT_PUBLIC_SITE_URL to the production URL and later the canonical domain. Verify Supabase Site URL and redirect allowlist.
- Confirm the hard-coded receiving wallets in lib/billing/wallet/config.ts are the intended wallets you control. No wallet addresses were changed.
- Host/schedule the crypto and PayPal monitor endpoints with their distinct bearer secrets. A successful deployment alone does not schedule them, and the local terminal stops when closed. Confirm your hosting plan supports the required frequency and function runtime.
- Confirm PayPal sandbox/live choices, webhook verification, email configuration, and invoice/customer details before accepting customer payments.
- The public demo request form is currently a frontend preview and explicitly does not send or save a request. Connect real lead handling if that is required at launch.
- Keep test cleanup, domain purchase and production deployment as separate verified stages. No live database mutation, account deletion, purchase or deployment was performed by this review.
