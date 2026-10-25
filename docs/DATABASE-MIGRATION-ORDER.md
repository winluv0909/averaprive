# Database migration order

This is the repository inventory, not a record of migrations applied to Supabase.

For existing environments, reconcile applied history and manually executed queries
before applying anything. Run only reviewed, unapplied migrations.
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
31. `20261014155413_secure_server_public_views.sql`
32. `20261014161158_restrict_private_function_execution.sql`
33. `20261014163004_restrict_editorial_media_listing.sql`
34. `20261015054208_harden_public_inquiry_validation.sql`
35. `20261015055529_revoke_role_table_truncate_access.sql`
36. `20261015062045_revoke_remaining_client_truncate_access.sql`
37. `20261015064002_prevent_default_client_truncate_grants.sql`
38. `20261015071114_restrict_client_trigger_and_reference_privileges.sql`
39. `20261015134247_agency_registration_email_verification.sql`
40. `20261016082225_agency_registration_numbers.sql`
41. `20261025090249_protect_subscription_trials_and_decisions.sql`
42. `20261025090252_restrict_agency_profile_update_columns.sql`
43. `20261025103742_require_registration_number_for_submission.sql`

Inventory count: 43. Updated 25 October 2026.

Entries 41 and 42 are AP Fix 01 and AP Fix 02 from the Step 01 update.
They replace subscription functions and restrict agency-column UPDATE grants;
they do not update existing agency or subscription records.
See STEP-01-READ-ME.md for titled SQL Editor steps and verification.

Entry 43 is AP Fix 03 from Step 03. It requires a verified, bound platform
registration number before submission, while preserving reviewed curated claims.
It changes no existing records. See STEP-03-READ-ME.md.
