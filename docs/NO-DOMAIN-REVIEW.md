# Avera Privé review before domain purchase

Review date 30 October 2026, Philippines time. Current origin https://averaprive.vercel.app. This review covers the consolidated Step 09 source plus the deployed owner invoice and cookie fix. It does not certify an unobserved newer deployment.

## Result by workstream

| Workstream | Completed evidence | Still requires external acceptance |
|---|---|---|
| Staff permissions | 45 new tests exercise the actual page entry guards for five roles across nine areas. Database workflow tests exercise staff and agency boundaries. Owner invoice page and PDF previously confirmed live by owner. | Actual sign-in sessions for each staff role, including first-login setup. Only owners and moderators currently exist. No accounts were created. |
| Agency registration and recovery | Existing isolated migration tests verify registration binding, submission restrictions, recovery validation, callback, password change and sign-out behavior. | A controlled inbox and agency account must complete the real signup and same-browser reset. A moderator reset link previously opened in the same browser; full reset/sign-in/old-password rejection was not confirmed. |
| Main workflows | New full-migration tests cover approval remaining private until publication, rejected unauthorized reviewers, inquiry consent and contact isolation, review relationship checks, own-agency review rejection, support private notes and unrelated-user denial. Existing claims tests cover claim/reviewer paths. | Signed-in UI round-trips, actual email routing and uploaded-file downloads need controlled user sessions. No live test claims, inquiries, reviews or tickets were submitted. |
| Payment readiness | Read-only live evidence: both cron jobs active; most recent HTTP responses 200 without timeout; preceding hour had 30 completed crypto and 29 completed PayPal requests with HTTP 200, plus one PayPal request awaiting collection. Last cron runs succeeded. Local suites exercise provider matching, duplicate prevention, sandbox/live separation, refunds and invoice rules. | Vercel secret/config presence, live merchant identity, webhook registration, wallet control and real settlement are not verified by cron success. No real payment or refund initiated. |
| Operator and policies | Actual current operational rules and missing decisions documented; operator decision sheet supplied. | Actual operator identity, mailing details, retention decisions and policy approval remain required. No facts or retention periods were invented or published. |
| Backup and restore | Full isolated migration schema archived and restored into a second PGlite instance. Audit data, support RLS and role isolation survived. Live organization is Free. Production restore runbook supplied. | No production backup inventory/export, Storage-object backup, or hosted Supabase restore was accessible through the available tools. No paid branch/project created. |
| Cleanup and guide | Read-only inventory and preservation plan supplied; guide expanded for all roles. No records deleted. | The retained Northstar draft has sandbox financial history and must not be deleted as a casual demo cleanup. Confirm any disposable IDs and a real backup before deletion. |

## Automated validation

All 387 tests across 39 files passed, including 50 new role/workflow/archive cases. Typecheck passed, lint had zero errors and four existing warnings, clean production build passed, and 79 asset references had zero missing files. All 46 desktop/mobile browser checks also passed. See REVIEW-VALIDATION.md for test scope.

## Live database findings

The database reported ACTIVE_HEALTHY on Postgres 17.11 in Tokyo. Latest monitor snapshot was 30 October 2026 00:15:27 Philippines time (database clock); it is a point-in-time observation, not a continuing uptime guarantee.

- 50 agency rows, 49 published, zero rows flagged demo_profile. This is the current observed count; older references to 52 agencies are historical and are not a reason to recreate rows.
- Two super_admin role assignments and two moderator assignments. No finance, support or verification_reviewer assignments currently exist.
- Two PayPal orders, both sandbox: one paid and one pending. Two invoices, one paid and one open. Notification table empty; this is not evidence of receipt delivery.
- Zero claims, inquiries, reviews, support tickets and crypto refund cases; one registration-number record. An empty production workflow cannot demonstrate an end-to-end completion.
- No public ap_ table has RLS disabled. Eight checked private payment/registration tables deny direct anonymous and authenticated reads/inserts/updates.
- All three retired payment RPCs deny anonymous/authenticated execution. The public consent-event RPC intentionally remains callable.
- Security Advisor: 15 informational no-policy findings on protected server-only tables; two anonymous and 43 authenticated SECURITY DEFINER findings (categories overlap); leaked-password protection disabled. Do not automatically grant table access or revoke every intended RPC to silence findings. Existing purpose/guards and tested paths are documented; this is not an independent penetration test of every function.

## Boundaries preserved

Domain, SMTP, reset-email template and cross-browser recovery remain unchanged as requested. No production DDL, account changes, test submissions, data deletions, provider charges, wallet transfers or external messages were performed in this review.

## Sources

- Supabase backups and Free-plan export guidance: https://supabase.com/docs/guides/platform/backups
- Supabase Storage downloads: https://supabase.com/docs/guides/storage/management/download-objects
- Password protection finding: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- No-policy finding: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Anonymous definer finding: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- Signed-in definer finding: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable


## Follow up monitor observation

At 30 October 2026 00:24 Philippines time the latest collected crypto request returned HTTP 200 with errors=0, checked=0, email_sent=0 and email_failed=0. At 00:25 the latest collected PayPal request returned HTTP 200 with payments_failed=0, payments_verified=0, email_sent=0 and email_failed=0. These responses support monitor execution, not a payment-settlement or email-delivery claim.
