# Avera Privé — owner and staff operating guide

## Accounts and responsibilities

Sign in at `/owners/login`. Agency owners and their team sign in at `/agency/login`; platform staff use separate platform accounts. Staff accounts do not belong in agency workspaces.

| Role | Normal destination | Responsibility |
|---|---|---|
| super_admin (platform owner) | Owner overview | Staff accounts, platform administration, commercial decisions and refunds |
| moderator | Moderation | Agency submissions, reviews, disputes/fraud and editorial operations allowed by the role |
| verification_reviewer | Verifications | Verification and fraud evidence checks |
| support | Support | Tickets, inquiries and permitted dispute work |
| finance | Payment review | Payment records, subscriptions, placements and permitted analytics; only owners open or record refund cases |

Navigation is a convenience; the server and database enforce permissions. Multiple assigned roles are allowed. Owner priority no longer depends on the order in which database rows are returned. This patch creates no users or role assignments.

## Creating staff

An owner opens Staff accounts, enters the person's controlled email, selects a supported staff role and supplies a unique temporary password of at least 12 characters. Deliver the temporary password privately through an appropriate channel. Do not paste it into a support ticket or commit. The account must set a new password before operational access. The form cannot create super_admin owners; creating another official owner is a separate controlled administration task. There is no artificial staff-count limit.

For recovery use Forgot your password, open the latest email, set a new password and sign in at the correct portal. Staff password-setup flags are administrator-controlled metadata and cannot be cleared by editing user profile data. If the account is still gated, finish setup rather than bypassing the flag.

## Agency publication and claims

Review the official company identity, site and submitted profile. Registration numbers must be verified and bound before new submissions; curated claims follow their own reviewed path. A claim should have independent ownership evidence and checked corrections before approval. Do not publish test agencies. Paid subscriptions do not substitute for verification or moderation.

## Reviews, verification and editorial

Check the relationship/evidence behind reviews; record a meaningful rationale. Private files and evidence must remain within authorized operations. A verification badge describes completed checks and is not a guarantee of performance. Sponsored content must be disclosed. Do not alter objective scores or verification because of payment. Use the permitted editorial upload types and size limits.

## Support and inquiries

Use the correct agency and record before replying or changing status. Share personal details only with the intended authorized recipient. The profile inquiry form records a consented contact request. Optional page-view analytics are separate and now require a visitor's choice to allow directory analytics. Requests and email delivery should be verified independently; a queue entry is not proof of receipt.

## Billing and payment review

Open Payment review for configuration, records, exceptions, unmatched deposits and unsent notification status. Configured channels and active schedules do not prove a payment was credited. A customer-provided TXID is a lookup hint only. Match provider evidence and the correct invoice, receiving address, token, amount, network and confirmations. Never mark a sandbox purchase as a live receipt. Never manually approve a plan to compensate for missing payment evidence.

Agency billing shows invoice history scoped to the authorized agency. Error loading invoices must be treated as an error, not an empty history. Downloaded PDFs now distinguish void/refund/expired records, hide unsafe QR instructions and retain historical billing details. Long names/addresses continue on following pages. The renderer supports its configured WinAnsi fonts; unsupported writing systems still need a separate Unicode-font upgrade before invoicing customers whose names use those characters.

## Temporary refund-and-retry policy

1. Identify a genuine underpaid, overpaid or late payment on a current wallet invoice. Customer ownership of the deposit must be checked through support; an incoming hash alone is not ownership proof.
2. Owner records checked evidence and opens the refund case. This permanently cancels the unpaid order and voids its invoice. Existing subscriptions remain unchanged and the exact amount stays reserved.
3. Confirm the payer's refund destination independently. Do not assume an exchange's sending address is their receiving address. Send the full received amount in the same asset/network from the external wallet, paying network fees separately.
4. Record the outgoing TXID, amount, destination and support note only after actually sending and checking the transfer. The website records an owner attestation; it does not sign transfers or independently verify outgoing finality.
5. Confirm arrival with the payer before asking them to create a new invoice. Old instructions must not be reused. Wrong-token/network, partial refunds, paid invoices and historical systems need separate support review.

The future owner-approval policy for accepting individual exceptions is deferred. This patch does not enable it.

## Monitoring, backups and incidents

Check the most recent scheduler outcome, provider result and notification state, not just the active-job toggle. If verification is unavailable, leave payment unconfirmed and investigate. Avoid repeated customer transfers. Keep the two monitor secrets distinct and private; rotate any exposed secret through the provider and deployment configuration, not in a public ticket.

Record both owners' incident responsibilities. Verify your actual Supabase backup/export capability and perform a restore drill in a separate project before relying on it. Preserve payment records, private evidence and audit trails according to the operator-approved retention policy. Cleanup starts with the read-only inventory; the patch contains no deletion SQL. Do not delete an account just because it has a password-setup flag or an unpaid invoice.

## Daily route and permission reference

Use the current site https://averaprive.vercel.app. Owners/staff sign in at /owners/login. The nine protected areas below were exercised through their actual server-page guards with all five supported roles; this table describes page entry, not every individual action or record-level rule.

| Area | Owner | Moderator | Verification reviewer | Support | Finance |
|---|---|---|---|---|---|
| Staff accounts /owners/dashboard/team | Yes | No | No | No | No |
| Directory and claims /owners/dashboard/directory | Yes | No | No | No | No |
| Moderation /owners/dashboard/moderation | Yes | Yes | No | No | No |
| Verification /owners/dashboard/verifications | Yes | No | Yes | No | No |
| Review queue /owners/dashboard/reviews | Yes | Yes | No | No | No |
| Support tickets /owners/dashboard/support | Yes | No | No | Yes | No |
| Inquiry operations /owners/dashboard/inquiries | Yes | No | No | Yes | No |
| Payment review /owners/dashboard/payments | Yes | No | No | No | Yes |
| Marketplace analytics /owners/dashboard/analytics | Yes | No | No | No | Yes |

Refund-case opening and outgoing-refund recording remain owner-only. Finance can view invoices and download PDFs, but that permission does not grant owner-only refund controls. Multiple roles combine access; assess every assigned role before investigating an apparent extra permission.

## First shift for each role

Platform owners open Overview, Staff accounts and Payment review. Check incident ownership, role assignments, public publication decisions, monitor results and unresolved payment exceptions. Use the completed sandbox invoice as a display check, never as evidence of live revenue. Open the payment record, choose View invoice or Download PDF; return through Payment review.

Moderators open Moderation and Review queue. Start from a submitted record, compare evidence and requested changes, and record a meaningful decision. Approval and publication are separate. Do not use owner-only Directory and claims to bypass the moderation process. Review agency responses/disputes only within the role's permitted screens.

Verification reviewers open Verification. Compare submitted evidence against the requested checks and record what was verified. Ask for missing information instead of approving incomplete evidence. Private evidence must not be copied into public notes. Verification does not depend on the subscription purchased.

Support staff open Support tickets, Inquiry operations and permitted demo requests. Check the correct customer/agency first, distinguish internal notes from customer-visible messages, and use a traceable status note. Internal support messages are not visible to ticket owners; unrelated accounts cannot read a ticket. Escalate payment ownership/refund decisions to an owner and provider-verification problems to finance/owners.

Finance staff open Payment review and Subscriptions, plus permitted placements/analytics. Compare provider environment, merchant, currency, amount, invoice and subscription period. Review notes document investigation and do not credit a payment. Expand an order to open its invoice/PDF. Escalate unsupported assets, duplicate claims and refunds to owners.

## Agency account walkthrough

Agency accounts are separate from platform-staff accounts. Use /register for controlled onboarding and /agency/login afterward. Complete the email steps and request/verify the registration number with an inbox you control. Fill the draft profile and bind the verified number before submission; account creation alone does not publish the agency. A reviewed claim uses the separate claim process.

In the agency workspace, owners/admins manage the profile and permitted team actions; billing members handle permitted invoices/payment pages, editors work on editable profile content and analysts use permitted analytics/lead views. Membership status must be active and agency-scoped. Platform ownership alone is not agency membership. Do not add owners to a customer's agency merely to view an invoice: use the staff invoice route.

For the controlled launch test, keep the test agency unpublished. Check the number cannot be reused or forged, the review queue receives the draft, approval remains private until publication, and unrelated agency members cannot read its private records. Use isolated fixtures for public publication exercises until a real production listing is approved.

## Recovery and cookies

The default email recovery currently depends on the browser profile that requested it. Request and open the newest link in the same profile; after saving a new password, sign in through the correct portal and check the old password fails. A successful email request message alone does not prove delivery or reset. Cross-browser recovery, custom SMTP and domain changes remain paused by the owner. Do not promise phone-to-computer recovery until that separate acceptance test passes.

On a visitor's first public-page load, Privacy choices appear at the bottom of the screen without scrolling. Essential only leaves optional directory analytics off. Allow directory analytics enables that choice; reopening Cookie Settings permits changing it later. Saved choices close the panel on later loads in that browser. Contact-form consent remains separate from analytics. Use a fresh incognito window for first-visit checks, rather than clearing a customer's cookies.

## Incident handling and handover

Record the incident time, affected record IDs, observed status and assigned responder. Keep secrets, recovery links, passwords, wallet seed phrases and private customer evidence out of public screenshots or Git. For suspected unauthorized access preserve audit evidence, restrict the affected account through the supported administration process, rotate compromised secrets where used and verify sessions and permissions. Existing access tokens can outlive refresh-session revocation until expiry.

For a failed monitor, compare both the scheduler run and HTTP response; a queued request may not yet have been collected. Do not count zero verified payments as a failure when no eligible payment exists. If a provider is unavailable, keep payment unconfirmed and tell support what is actually known. Verify notification delivery separately from payment verification.

Before a handover, list open tickets, pending moderation, genuine payment exceptions, notification failures, account setup tasks and backup status. Assign an owner and due time for unresolved work. Review docs/OWNER-DECISION-SHEET.md for outstanding launch decisions and docs/PRODUCTION-BACKUP-RUNBOOK.md for the real restore procedure.
