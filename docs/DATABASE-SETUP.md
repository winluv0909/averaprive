# Avera Privé database setup

Use a new Supabase project or an empty database. The files in `supabase/migrations/` are deliberately named and ordered. Run every file once, in filename order, through the Supabase CLI or SQL Editor.

## Named query order

1. `202609210000_core_marketplace.sql` — agencies, verification, reviews, reports, fraud foundations.
2. `202609220001_identity_roles.sql` — profiles, agency memberships, staff roles, audit log.
3. `202609220002_workflow_states.sql` — profile publication states and moderation cases.
4. `202609230003_profile_workflow.sql` — agency draft, submission, approval, and publication functions.
5. `202609230004_trust_workflows.sql` — verification, review, response, report, and dispute workflows.
6. `202609240005_review_dispute_operations.sql` — staff decisions and case resolution.
7. `202609280006_fraud_investigations.sql` — fraud investigation queue and risk signals.
8. `202609280007_sponsored_placements.sql` — clearly labeled commercial placement inventory.
9. `202609280008_marketplace_analytics.sql` — events, inquiries, lead qualification, and metrics.
10. `202609280009_editorial_cms.sql` — The Privé Edit articles and visual editorial posts.
11. `202609280010_subscriptions_entitlements.sql` — plan catalog and access entitlements.
12. `202609280011_agency_leads_analytics.sql` — privacy-aware agency analytics and lead inbox.
13. `202609290012_team_invitations.sql` — invitation acceptance and least-privilege team roles.
14. `202609290013_support_system.sql` — support cases, conversation history, priority, SLA fields, private notes, and audit events.
15. `202609290014_public_directory.sql` — public directory view and source provenance.
16. `202610030015_ofm_demo_agencies.sql` — 15 clearly labeled fictional OFM profiles and permanent demo safeguards.
17. `202610030016_demo_external_ratings.sql` — five additional fictional OFM profiles plus clearly disclosed simulated external-rating states for UI testing.

## Create the first owner

1. Register the owner through Supabase Authentication and confirm the email.
2. In SQL Editor, replace the email and run:

```sql
insert into public.ap_staff_roles (user_id, role)
select id, 'super_admin'
from auth.users
where lower(email) = lower('OWNER_EMAIL_HERE')
on conflict (user_id, role) do nothing;
```

Do not use a service-role key in the browser. Never grant an agency account a platform staff role.

## Authentication URLs

- Site URL: the final HTTPS deployment URL.
- Redirect URL (local): `http://localhost:3000/auth/callback`
- Redirect URL (production): `https://YOUR_DOMAIN/auth/callback`

## Seed-data policy

Do not publish allegations, scraped ratings, or unverified claims about real agencies. Add real organizations only after recording the official source in `ap_agency_sources`, checking permission and accuracy, and completing moderation. Trustpilot is a separate third-party platform and its score must never be written into Avera Privé verification status.

The final two migrations create 20 fictional OFM demonstration profiles. They cannot be verified, sponsored, contacted, or counted in marketplace analytics. Their external scores are simulated UI states, not real Trustpilot data, and contain no fabricated Trustpilot profile URLs. Set `NEXT_PUBLIC_SHOW_DEMO_AGENCIES=false` in production when you are ready to hide them.
