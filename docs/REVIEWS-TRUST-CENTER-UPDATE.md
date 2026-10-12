# Reviews & Trust Center update

## Added

- Authenticated independent review submission with private relationship evidence.
- Staff review queue with publish, reject, and hide decisions.
- Relationship verification required before publication.
- Agency review center with moderated public responses.
- Review reporting and formal disputes with private evidence.
- Staff queues for responses, reports, and disputes.
- Evidence-based response moderation, report decisions, and dispute resolution.
- Immutable security-audit events for privileged decisions.

## Required migration

Run `supabase/migrations/202609240005_review_dispute_operations.sql` once in the test Supabase project before testing the new trust-operation decision screens.

## Separation rules

- A paid plan cannot publish, remove, or improve a review.
- Agency responses require moderation.
- Reports do not automatically remove content.
- Disputes require an independent staff resolution.
- Review moderation does not change verification, billing, ranking, or profile publication state.

## Suggested test order

1. Create a second authenticated test user without agency membership.
2. Submit a controlled review using the test agency UUID.
3. Moderate and publish the review as platform staff after checking the test evidence.
4. Return to the agency review center and submit an agency response.
5. Moderate that response.
6. Submit a report and a dispute, then resolve each from the trust queue.
