# Verification interface update

## Added routes

- `/dashboard/agencies/[agencyId]/verification` — agency verification status and private evidence submission.
- `/dashboard/verifications` — independent staff verification queue.
- `/dashboard/verifications/[verificationId]` — evidence review and decision screen.

## Security and trust rules

- Agency owners and administrators may submit evidence, but cannot approve it.
- Only `super_admin` and `verification_reviewer` roles can make verification decisions.
- Approval records all four required evidence checks through the database function.
- Verification never publishes an agency.
- Subscription, placement, and ranking are not inputs to verification.
- Evidence is held in the private verification record and is not exposed through public views.
