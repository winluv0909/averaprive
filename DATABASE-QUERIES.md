# Avera Privé — named Supabase queries

Use a new, empty Supabase project. In **SQL Editor**, create a separate query for every file below, use the exact query name shown, paste the entire file, and run the queries once in order. Do not continue after an error.

| No. | Supabase query name | Source file |
|---:|---|---|
| 01 | `AP 01 — Core Marketplace` | `supabase/migrations/202609210000_core_marketplace.sql` |
| 02 | `AP 02 — Identity and Roles` | `supabase/migrations/202609220001_identity_roles.sql` |
| 03 | `AP 03 — Workflow States` | `supabase/migrations/202609220002_workflow_states.sql` |
| 04 | `AP 04 — Agency Profile Workflow` | `supabase/migrations/202609230003_profile_workflow.sql` |
| 05 | `AP 05 — Trust Workflows` | `supabase/migrations/202609230004_trust_workflows.sql` |
| 06 | `AP 06 — Review and Dispute Operations` | `supabase/migrations/202609240005_review_dispute_operations.sql` |
| 07 | `AP 07 — Fraud Investigations` | `supabase/migrations/202609280006_fraud_investigations.sql` |
| 08 | `AP 08 — Sponsored Placements` | `supabase/migrations/202609280007_sponsored_placements.sql` |
| 09 | `AP 09 — Marketplace Analytics` | `supabase/migrations/202609280008_marketplace_analytics.sql` |
| 10 | `AP 10 — Editorial CMS` | `supabase/migrations/202609280009_editorial_cms.sql` |
| 11 | `AP 11 — Subscriptions and Entitlements` | `supabase/migrations/202609280010_subscriptions_entitlements.sql` |
| 12 | `AP 12 — Leads and Agency Analytics` | `supabase/migrations/202609280011_agency_leads_analytics.sql` |
| 13 | `AP 13 — Team Invitations` | `supabase/migrations/202609290012_team_invitations.sql` |
| 14 | `AP 14 — Support System` | `supabase/migrations/202609290013_support_system.sql` |
| 15 | `AP 15 — Public Directory` | `supabase/migrations/202609290014_public_directory.sql` |
| 16 | `AP 16 — OFM Demo Agencies` | `supabase/migrations/202610030015_ofm_demo_agencies.sql` |
| 17 | `AP 17 — Demo External Rating States` | `supabase/migrations/202610030016_demo_external_ratings.sql` |

## Final setup

After all 17 queries succeed, register the real platform owner through the website, confirm the email, and run the owner bootstrap statement from `docs/DATABASE-SETUP.md`. Configure the exact production and local callback URLs in Supabase Authentication.

Queries 16–17 create **fictional demonstration data only**. It is visibly labeled, cannot be verified or contacted, does not enter production analytics, and may be hidden in production with `NEXT_PUBLIC_SHOW_DEMO_AGENCIES=false`.
