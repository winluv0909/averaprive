# Analytics implementation and release gates

## What is implemented in this package

- Private database tables for pseudonymous sessions, searches, interaction events, trusted business events, daily agency facts and monthly subscription snapshots.
- A Vercel event endpoint that checks origin, consent, identifiers, public agency status and supported event fields before writing through a server-held Supabase secret.
- A browser helper that sends events only after an explicit `granted` preference.
- One set of metric definitions for product, aggregation and reporting.

This package is not active after copying. The SQL must exist, environment variables must be configured, the endpoint must be deployed, a consent interface must call `grant()` or `deny()`, page actions must call `track()`, and authenticated reporting endpoints must be built before the dashboard can show measured values.

## Required event connections

| Product action | Event or trusted action |
|---|---|
| Approved profile becomes visible | `profile_view` once per page load after consent |
| Directory search submits or filters settle | `creator_search` once, returning/retaining a `searchKey` |
| Search results render | One `search_appearance` for each visible agency, linked to that `searchKey` |
| Result opens an agency profile | `search_profile_click` before navigation, linked to the same search |
| Contact form opens | `contact_started` |
| Inquiry is successfully stored | `contact_submitted`; send from the server where possible so failed forms do not count |
| Screening marks a lead qualified | Trusted `lead_qualified`; never accepted from public browser JS |
| Agency records lead decision | Trusted `lead_accepted` or `lead_rejected` after authentication and ownership checks |
| Payment provider confirms lifecycle change | Trusted subscription event after verified webhook; browser checkout redirects never count |

## Environment variables for the event endpoint

Configure these in Vercel, not in Git or browser JavaScript:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `ANALYTICS_HASH_SECRET` — a long independent random secret used only to pseudonymize session IDs
- `ANALYTICS_ALLOWED_ORIGIN` — final origin such as `https://agency-prive.vercel.app`

Supabase secret/service credentials bypass RLS. Every server endpoint must therefore validate its inputs and authorization scope even though the tables have RLS enabled.

## Remaining production services

1. A consent banner and preference page with an accurate cookie/storage notice.
2. Durable server-side rate limiting and bot filtering. Function memory is not a rate-limit database.
3. Event connections in the directory, profile, compare and inquiry code.
4. Billing webhook and lead workflow integrations for trusted business events.
5. A scheduled aggregation job that recomputes affected UTC days and monthly cohorts idempotently.
6. An authenticated reporting endpoint that verifies `ap_agency_memberships` and returns only the requesting agency's aggregates.
7. Dashboard charts with range controls, data freshness, accessible tables and empty/incomplete states.
8. Retention, deletion, consent withdrawal, access request and incident procedures appropriate to the markets served.
9. Automated tests for duplicate events, unauthorized agency access, failed inquiries, webhook retries, refunds, plan transitions and tracking disabled by consent.

Do not replace dashboard em dashes with zero until collection, aggregation and reporting pass end-to-end tests. A displayed zero means the system observed the full period and counted no events.
