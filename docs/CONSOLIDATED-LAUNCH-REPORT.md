# Consolidated launch review — 29 October 2026

## Result and scope

This is a source patch and a read-only production review, not a declaration that the website is ready to accept public live payments. The latest uploaded project included deployed Step 08. The temporary **refund and retry** policy is preserved. Future owner acceptance of individual crypto exceptions remains deferred.

The author did not change the live database, send email, create accounts, change DNS, delete records, activate live PayPal, sign wallet transfers or deploy this patch. Supabase reads were restricted to project identification, advisory findings, function definitions, privilege checks and aggregate counts; secret values and private payer/contact records were not retrieved.

## Changes in this package

- Invoice PDFs no longer offer a receiving QR on void, overdue, refund-case, paid, expired or review-state records. Native Bitcoin is labelled correctly. Refund records and owner-recorded outgoing TXIDs are shown without claiming independently verified receipt. Totals fit their column; long billing information continues on later pages. Invoice web/text displays use the same state rules.
- Recovery requests handle invalid origin configuration and upstream throws without leaking account eligibility. Missing/invalid recovery callbacks fail before auth initialization; provider exceptions return a usable recovery error. PKCE and recovery TokenHash callbacks are tested.
- Role selection honors the caller's role priority even when a multi-role account's database rows arrive in a different order. Owner Payment review gets its own active navigation item and scoped responsive typography/forms. Invoice-history tables have a keyboard-focusable horizontal scroll region on small screens.
- Optional directory analytics require an explicit choice. Public pages offer Essential only and Allow directory analytics, with Cookie Settings for withdrawal. Browser tracking and the server event endpoint skip absent consent. Step 09 SQL enforces the same rule for direct RPC callers. Contact-inquiry consent remains separate. Historical records are retained.
- Three retired payment APIs with no active application callers lose client execution through the supplied SQL. This prevents old interfaces from changing current wallet invoices. No historic function or record is deleted and the current refund functions remain available to their authorized owners.
- Public canonicals and og:url values are consistent for the 12 marketing pages. The domain update helper previews or updates those tags for the chosen origin. Misleading old billing FAQ wording and the obsolete public-profile URL hint were corrected.
- Browser testing now uses a separate production build and dedicated TypeScript config with dummy auth settings. This removes intermittent development-server route 404s and avoids sharing output with normal development. Generated reports/render output are excluded from lint and version control.
- Added safe configuration and public-asset checks, read-only verification/inventory SQL, an owner/staff guide, email/domain setup, policy decision list and one final acceptance checklist.

## Authoring validation

- `npm run verify`: TypeScript, lint, isolated tests and production build. Final counts are recorded in STEP-09-READ-ME.md.
- Browser suite: **44 checks passed**, desktop Chromium and Pixel 7 viewport. Includes all 12 marketing-page headings/viewport overflow, privacy choice persistence/withdrawal, profile inquiry popup keyboard handling, recovery errors, login links, private-route redirects and mocked directory filters. It does not exercise signed-in business operations with real accounts or real payment/email services.
- Public asset check: **79 local asset references, zero missing files**. Changed public JavaScript passed syntax checks.
- Both full and production-only `npm audit` reported **zero known vulnerabilities** against the installed lockfile on the review date. This supersedes earlier dated development-tool findings; future advisories may differ.
- Real PDF files were generated and rendered for long billing details, void/refund and sandbox states. Punctuation, continued billing details and total positioning were inspected. The current font renderer still requires a separate Unicode-font upgrade for unsupported scripts.

## Live read-only findings before this patch

| Item | Observed |
|---|---|
| Project | avera-prive, active/healthy |
| Agencies | 50 total; 49 published; zero demo_profile-labelled records |
| Official owner-role assignments | 2 |
| Payment records | 2 PayPal records: one paid sandbox and one pending sandbox; no crypto orders in this aggregate |
| Invoices | 2 |
| Refund cases / pending payment notifications | 0 / 0 |
| Platform accounts requiring password setup | 2; these were not classified as disposable test accounts |
| Scheduler | Crypto active every two minutes; PayPal active on alternate minutes |
| Public ap_* tables with RLS disabled | None found |
| Private tables flagged “RLS enabled, no policy” | All 15 checked had RLS and no anon/authenticated SELECT/INSERT/UPDATE/DELETE grant |
| Migration ledger | Only two recorded versions, despite many SQL Editor-installed updates; do not infer missing schema from this |

No production live-payment settlement was established. Scheduler configuration does not establish recent HTTP success, deposit matching, provider credit or delivery. Existing sandbox evidence must not be presented as real revenue.

## Security Advisor disposition

Before this patch, Security Advisor returned 15 informational RLS/no-policy findings, two anonymous elevated-function warnings, 46 signed-in elevated-function warnings and disabled leaked-password protection. They are not all the same issue:

- The 15 no-policy tables are deliberately server-controlled and direct client grants are absent. Do not add permissive policies simply to clear the information notices. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- The anonymous inquiry and event RPCs are deliberate public write interfaces with input, eligibility, consent and repetition checks. Event consent is tightened by this patch. These remain intentional elevated interfaces, not “zero warnings.” Public-abuse controls still deserve operational monitoring. [Anonymous function warning](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- All 46 returned function definitions were inspected for their permission model: agency membership, staff-role guards, signed-in submission/ownership checks or disabled legacy paths. The warning does not prove every signed-in user can perform its action. Step 09 revokes three obsolete client APIs; the remaining elevated RPCs retain their current authorization checks. Isolated tests cover important boundaries, but a complete live role acceptance session is still required. Do not blanket-revoke active RPCs or turn definer functions into invokers without testing their data-access needs. [Signed-in function warning](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Review and enable leaked-password protection in Supabase Auth if available for the project plan. This setting was not changed. [Password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

After manually applying Step 09, run its verification SQL and rerun Security Advisor. Do not claim the new SQL is installed until its results are checked. Keep deliberate exceptions documented with an accountable owner.

## Outstanding external decisions and acceptance

Use FINAL-ACCEPTANCE.md for one session covering controlled account recovery/role boundaries, real mail delivery, real provider settlement, final domain and production callbacks, backups, cleanup approval and deployment evidence. EMAIL-DOMAIN-SETUP.md has the exact email/domain sequence. POLICY-DECISIONS.md lists missing operator details and retention decisions. Public legal content remains visibly a draft; code review cannot invent or approve those details.

Cleanup is inventory only: the single pending sandbox purchase is a review candidate, not an automatic deletion target. No demo-labelled agencies were found. Preserve real directory content, subscription plans, both owners, payment configuration, invoices, audit evidence and all records until a specific deletion list and verified backup are approved.
