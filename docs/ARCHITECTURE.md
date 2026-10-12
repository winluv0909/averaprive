# Avera Privé — lead generation and paid lead marketplace

## What this package does

`database/lead-marketplace-foundation.sql` defines private storage for the future workflow. It does **not** activate submissions, matching, messaging, payments, or an agency inbox. The site currently has zero approved agencies. No leads, purchases, or charges are created.

Prerequisite: the previously tested `trust-foundation.sql` must exist in the **same Supabase project**. Work in the test project first. Review the SQL before running it anywhere; it is an architecture migration, not a finished application.

## Flow

1. **Creator inquiry.** A server endpoint accepts a creator's contact details, goals, services, niches, target countries, consent choice and source. It validates the request, rate limits abuse, protects against repeated submissions using a submission key, and writes one `ap_lead_inquiries` record. Only a trusted server stores identity; the browser receives a reference and a truthful submitted status after successful storage.
2. **Screen and match.** Staff or a trusted matching worker rejects spam, checks consent and relevance, then selects only approved, published agencies currently accepting inquiries. `ap_lead_agency_coverage` supplies relevant services, niches, countries, and capacity. `ap_lead_matches` records score and reason codes for debugging; it is **not** the objective directory ranking.
3. **Prepare offers.** An eligible agency may see a redacted `ap_lead_offers.summary_safe`. Offer access may be included under a validated entitlement, paid once, or deducted from an authorized lead-credit balance (credit balance itself is a later phase). A marketplace preview must never include the creator's contact details, original message, or identifying attachments. No offer is published if the creator did not agree to share with relevant agencies.
4. **Purchase or included access.** An agency member requests the offer. The server checks agency ownership, availability, price and source of entitlement. For a paid offer, it creates one `ap_lead_orders` row with an immutable price snapshot, starts a payment flow with an idempotency key, and does **not** unlock the lead from a browser return URL. A signed payment webhook verifies the event, records its unique provider event ID, confirms the actual paid order and grants access exactly once in a transaction. For included access, the server verifies an active entitlement in the same transaction. Credits require an atomic ledger debit before granting access; do not switch on credit mode before implementing that ledger.
5. **Conversation and outcome.** Only after access is granted may the server reveal permitted creator details and create `ap_lead_conversations`. It verifies agency membership and access on every read and reply. Responses go through an authenticated endpoint; creator messages require creator authentication or a separately verified reply token. Outcome changes are recorded in `ap_lead_outcomes`. Refunds, disputes or revoked access restrict future reads and trigger a staff review.
6. **Reporting.** Trusted server events record inquiry source, matched agency, offer, access, contact and reply without embedding raw personal data in analytics. Aggregate by agency, time range and source to show views → leads offered → leads accessed → agency replies → outcomes. Do not present untracked actions as real analytics.

## Suggested server routes (contracts, not implemented endpoints)

| Route | Auth and server checks | Response |
|---|---|---|
| `POST /api/inquiries` | CAPTCHA/rate limit, consent, request validation, idempotency | Inquiry reference; actual saved status |
| `GET /api/agency/leads` | Signed-in agency member, approved agency, valid entitlement | Redacted offers and legitimately unlocked conversations only |
| `POST /api/agency/leads/{offer}/checkout` | Signed-in active member, available offer, server price, checkout idempotency | Payment session URL; never creator identity |
| `POST /api/payments/webhook` | Verify provider signature on raw body; dedupe event; verify paid amount/currency | Acknowledge and fulfill or log failure |
| `POST /api/agency/conversations/{id}/messages` | Active membership, active access, open conversation, limits | Stored message ID and delivery state |
| `POST /api/agency/conversations/{id}/outcome` | Active membership and ownership; controlled state transition | Current recorded outcome |
| `GET /api/agency/performance` | Active membership and scoped agency ID | Aggregates, time range, source, data freshness |

## Invariants before launch

- The browser never receives a Supabase service key, raw lead tables, staff evidence, or unpurchased identity. Use server authentication plus agency membership checks and private database grants. RLS has **no browser policies** in this migration; a server service credential can bypass it, so every server handler must enforce identity and agency scope itself.
- Matching is based on declared fit and availability; buying a plan cannot create a Verified badge or objective Top Rated rank. Paid offers and sponsored directory placements remain separate systems.
- The creator chooses whether their data can be shared with matching agencies and can see the number or scope of recipients in the eventual user flow. Decide retention and deletion rules before collecting real information.
- One inquiry may match several agencies; each offer is one agency plus one inquiry. Enforce a recipient cap and reserve availability before checkout to avoid selling unavailable access. Use row locks and transaction checks to prevent duplicate fulfillment and overselling. Decide whether access is exclusive and how refunds work **before assigning any price**.
- A webhook success signal is not enough by itself: check provider event signature, object ownership, live vs test mode, order ID, paid state, amount and currency. Dedupe webhook events and handle late/refund events. Notify the agency via an outbox worker only after the transaction commits.
- Source tracking uses a controlled enum plus a safe reference. Do not trust browser-supplied agency IDs for authorization or view counts without server verification and deduplication.
- Do not make `ap_lead_agency_coverage.accepting_inquiries` public until a staff-reviewed agency profile exists; intake matching should ignore suspended agencies and those over capacity.

## Minimal release gates

1. Test migration in the existing **test** Supabase project; confirm every `ap_lead_*` table has RLS and no anonymous/authenticated privileges, and that all row counts remain zero.
2. Build authenticated creator and agency accounts with membership checks; add tests for unauthorized cross-agency reads and responses.
3. Build screened inquiry submission and a private agency inbox using the server routes; test no contact details appear before legitimate access.
4. Define actual paid lead pricing, scope, exclusivity, recipient limit, refund and dispute terms. Then implement checkout, verified webhook and atomic fulfillment; test duplicate and delayed webhooks.
5. Add notifications, reporting and retention/deletion procedures. Perform an independent security review before processing real creator information or payments.

No current website file is replaced in this architecture step. Do **not** put the SQL into HTML/JS or run it in the production project as part of copying site files.
