# Final acceptance — one consolidated checklist

Keep this checklist with the deployed commit. A code test, configured channel or scheduled job is not evidence that a real payment or email succeeded. Use accounts you control and never put passwords, API keys, recovery URLs or private evidence into screenshots.

| Area | Check to complete | Pass evidence |
|---|---|---|
| Install | Copy the consolidated patch, apply only Step 09 install SQL, inspect Step 09 verification results | Query results and commit |
| Local validation | `npm run verify`, `npm run test:e2e`, `node scripts/check-public-assets.mjs` | Successful output; browser suite now has 46 cases |
| Owner access | Owner opens Payment review and Staff accounts; signed-out visitor cannot open private pages | Expected page/redirect; no case submitted just to test |
| Agency recovery | A real agency member requests recovery, receives the latest link, changes password and signs in to the correct agency | New password works, old password fails, records remain accessible |
| Staff recovery | Staff repeats recovery and reaches their permitted operations; another role's private page stays forbidden | Role boundary and forced first-login password setup confirmed |
| Registration and OAuth | Register a controlled agency account, receive email and registration number, verify/bind number, submit a draft; check Google/Apple only if enabled for launch | Correct membership and reviewed publication; no automatic public test listing |
| Core business flows | Controlled claim, inquiry, review, support ticket and moderation round-trip; confirm private evidence stays private | Saved records, correct recipient/role, public changes only after moderation |
| PayPal | Keep sandbox/live separate; verify configured merchant and webhook; controlled live purchase only when owners decide to accept live money | Provider capture, one paid invoice, one subscription period, no duplicate activation; downloaded PDF and receipt |
| Crypto | Confirm wallet control, exact amount/token/network, detection, finality and invoice activation on a controlled real payment when owners choose | Explorer evidence, monitor result, paid invoice, correct plan period and receipt |
| Refunds | On a genuine supported exception, check independent payer ownership, open case, verify cancelled/void state, send refund externally and record it | Old invoice cannot activate; outgoing transfer confirmed by customer; no duplicate refund |
| Email | Verify sender domain, SMTP, registration mail and payment mail; check inbox/spam and provider delivery status | Real delivery to intended recipients; neutral recovery success message alone is insufficient |
| Domain | Connect chosen domain and HTTPS; update Vercel origin, public canonicals, Supabase redirects, OAuth, PayPal callbacks and email templates | Sign-in/recovery/payment return work on final domain; live robots/sitemap correct |
| Policies | Supply actual operator identity, valid contact/mailing details, approved retention choices and completed terms/privacy/refund policy | Owner-approved, reviewed published documents; draft wording removed only after completion |
| Security/operations | Rerun live Security Advisor, review intentional RPCs, enable leaked-password protection if available, check backup/restore and monitoring | Findings resolved or individually documented; recent successful jobs, known incident owner |
| Cleanup | Review read-only inventory; retain real agencies, two official owners, plans, payment evidence and content | Explicit list of disposable IDs and verified backup before any deletion |

## What does not require a real transfer

All automated tests use isolated fixtures and dummy local auth configuration. Inspecting an empty refund list is enough for the deployment smoke check. Do not manufacture a production refund case or send money merely to obtain a screenshot.

## Recovery test procedure

Use the latest email only. With the default PKCE email link, request and open it in the same browser profile. With the optional recovery TokenHash template in EMAIL-DOMAIN-SETUP.md, test opening the link in a different browser as a separate acceptance case. Tokens are single-use and may expire. Avoid repeated requests; rate limits still apply. After changing a password, check that refresh sessions were revoked; existing short-lived access tokens can survive until their expiry.

## Sign-off record

Record: release commit, deployed origin, date, owner checking, test results, SQL verification result, outstanding items and the person responsible. Do not label the whole website launch-ready while any required external item is unverified.


## Latest no domain review

See NO-DOMAIN-REVIEW.md for the 30 October 2026 evidence and remaining limits. Owner invoice webpage/PDF and first-visit cookie controls have passed live smoke checks. Staff recovery opened in the same browser, but complete password-change/sign-in acceptance and agency email onboarding still require controlled inbox sessions. The owner explicitly paused domain, SMTP, template and cross-browser recovery changes. Do not repeatedly request those changes as prerequisites for unrelated local tests.

The production database was inspected read-only. New launch workflow tests replay all source migrations in an isolated database with Auth/Storage stand-ins. The archive restore is a fixture restore, not a production Supabase/Storage restore. No live synthetic reviews or agencies were published, no financial evidence deleted and no transfer initiated.
