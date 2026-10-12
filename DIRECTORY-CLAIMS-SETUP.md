# Curated agencies and ownership claims

## Apply the update
1. Back up Supabase. Apply migration 202610100018_curated_directory_claims.sql only if it has not already been applied. It removes explicitly marked demo rows; do not rerun the earlier demo-seeding migrations.
2. Apply supabase/migrations/202610100019_claim_profile_review.sql. This update adds researched profile information and the reviewed claim workflow. It does not delete agency records.
3. Replace the app code and restart. Open /owners/dashboard/directory as the super-admin.
4. Read research/source-audit.md and review the official sources before importing. There are 50 candidates, with TOAgency held for direct confirmation. All candidates have missing information; none is independently certified by this research.
5. Optionally run research/add-50-agencies.sql to publish the 49 reviewed candidates as unclaimed listings. It skips existing names, slugs and website matches. Review before executing: this step publishes records.
6. Run research/enrich-researched-profiles.sql to fill empty researched metadata and blank location/services on exact matching unowned records. Existing reviewed metadata and active-owned profiles are preserved. Re-running is idempotent.

No live database has been changed. The ZIP is an update for you to apply, not evidence that the live site is updated.

## Claim a profile
The representative opens a listing, clicks Claim this profile, signs in or creates an account, and reviews the profile details. They provide full name, role, business contact, evidence and requested corrections, and confirm review and authority. Submitting creates a private pending claim; it grants no membership.

The owner verifies business identity, representative authority, official contact and the latest information. Independently use a public company registry or suitable documentation and an official channel you find yourself; a Google login or an email typed by the claimant is not company ownership proof. Domain email challenges and website tokens are manual verification steps; this update does not automatically send challenges or verify documents.

Review the claimant's saved profile and compare it with the current listing. Use Correct this agency's information to save supported changes with a source and explanation. Resolve material missing information and conflicts before checking all four approval boxes. The database blocks approval without all checks and blocks stale forms if the profile changes. Declining does not require those approval checks.

Approval grants ownership of the existing listing, not a verification badge. It preserves the profile instead of creating a duplicate. Existing pending claims submitted before migration 019 lack the new fields: decline with an explanation and ask the representative to resubmit through the updated form.

## Accuracy and missing information
Public agency pages are statements, not registry certification. Information can change. Missing legal details, social accounts, fees, team sizes, minimum requirements and other facts are marked Not yet confirmed. Never invent them. Keep registered addresses separate from headquarters and markets served. Some published emails are application, legal or privacy contacts and are labelled accordingly.

## Validation
TypeScript and lint on changed TypeScript files passed. Database tests cover legacy bypass, reviewer checks, stale snapshots, correction permissions, ownership approval, held listings, idempotent import and preservation of owned information. Google/email authentication and the live Supabase deployment still require testing after migration. Previously known full-suite slug and billing-lint failures are unrelated to these changes.
