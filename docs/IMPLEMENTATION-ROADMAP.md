# Avera Privé implementation roadmap

The platform must be delivered in dependency order. A page that looks complete is not considered implemented until its server authorization, database state, audit trail, failure handling, and tests are complete.

## Delivery order

1. **Identity and access** — Supabase Auth, session cookies, user profiles, agency memberships, staff roles, RLS, audit logging.
2. **Agency lifecycle** — profile drafts, submission, moderation, approval, publishing, suspension, ownership claims.
3. **Trust workflows** — verification evidence, independent reviewer decisions, reviews, moderation, reports, disputes, fraud signals.
4. **Inquiry and lead workflows** — inquiry consent, routing, agency inbox, responses, status history, qualification, paid marketplace eligibility.
5. **Billing** — products and entitlements, Stripe Checkout, verified webhooks, subscription status, invoices, placement orders. Billing must never set verification or ranking.
6. **Analytics** — first-party event collection, deduplication, bot filtering, daily aggregation, conversion funnels, agency reports.
7. **Public discovery and SEO** — server-rendered directory, filters, agency pages, country/service/category routes, compare, rankings, reviews, editorial pages, metadata, sitemap, JSON-LD.
8. **Privacy operations** — consent log, data export, deletion request, retention jobs, legal holds, processor inventory.
9. **Launch verification** — unit, database policy, integration, webhook, accessibility, performance, security, and end-to-end testing.

## Non-negotiable separation

| State | Controlled by | Payment effect |
|---|---|---|
| Verified | Verification reviewer after evidence review | None |
| Featured / Sponsored | Active paid placement | Allowed, always labelled |
| Top Rated / ranking | Published methodology and eligible signals | None |
| Published | Profile moderation decision | Subscription may unlock fields, never bypass review |

## Definition of done for each workflow

- Database migration is repeatable and reviewed.
- RLS denies unauthorized reads and writes.
- Server action or route validates input and authorization.
- State transitions are explicit; clients cannot assign privileged states.
- Sensitive actions create immutable audit events.
- UI has empty, loading, validation, failure, and success states.
- Automated tests cover happy path and permission denial.
- Observability avoids storing secrets or unnecessary personal data.
