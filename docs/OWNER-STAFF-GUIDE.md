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
