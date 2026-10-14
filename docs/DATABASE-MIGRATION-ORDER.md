# Database migration order

This is the repository inventory, not a record of migrations applied to Supabase.

For existing environments, reconcile applied history and manually executed
queries before applying anything. Run only reviewed, unapplied migrations.
For an intentionally empty environment, follow the full filename order below.

Stop at the first error. Do not rerun the entire chain to resolve an error.

1. `202609210000_core_marketplace.sql`
2. `202609220001_identity_roles.sql`
3. `202609220002_workflow_states.sql`
4. `202609230003_profile_workflow.sql`
5. `202609230004_trust_workflows.sql`
6. `202609240005_review_dispute_operations.sql`
7. `202609280006_fraud_investigations.sql`
8. `202609280007_sponsored_placements.sql`
9. `202609280008_marketplace_analytics.sql`
10. `202609280009_editorial_cms.sql`
11. `202609280010_subscriptions_entitlements.sql`
12. `202609280011_agency_leads_analytics.sql`
13. `202609290012_team_invitations.sql`
14. `202609290013_support_system.sql`
15. `202609290014_public_directory.sql`
16. `202610030015_ofm_demo_agencies.sql`
17. `202610030016_demo_external_ratings.sql`
18. `202610080017_crypto_billing.sql`
19. `202610100018_curated_directory_claims.sql`
20. `202610100019_claim_profile_review.sql`
21. `202610100020_platform_reviews.sql`
22. `202610110021_reliable_crypto_payments.sql`
23. `202610110022_binance_credit_verification.sql`
24. `202610110023_shared_binance_checkout.sql`
25. `202610110024_paypal_checkout.sql`
26. `202610120025_trust_wallet_checkout.sql`
27. `202610120027_platform_password_setup.sql`
28. `202610120028_paypal_checkout_state.sql`
29. `20261013081725_protect_private_records_and_team_actions.sql`
30. `20261013085004_demo_request_delivery.sql`

Inventory count: 30. Update this list when migrations change.
