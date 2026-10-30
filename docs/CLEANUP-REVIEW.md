# Cleanup review without deletion

Live read-only inventory observed 50 agencies, 49 published, no demo_profile rows. Preserve all curated public agencies. Do not reconcile an old count of 52 by deleting or recreating agencies without checking history.

The remaining unpublished draft named NOrthstar management has ID 56e14264-0820-440f-9272-ca39e80c3be1 and is linked to sandbox payment/invoice history already reviewed. It is a cleanup candidate for owner classification, not approved for deletion. Preserve its orders, invoices and audit trail until the retention policy and backup are confirmed. Do not delete the whole agency to remove a test label.

Both official owner accounts must remain. Password-setup flags do not identify disposable accounts. The two moderator accounts may be real staff; they are not deletion candidates merely because recovery was tested.

No live claims, inquiries, reviews, tickets or refund cases were present at this review. One registration-number record exists; classify it by its actual binding/delivery state, not its age alone. Expiration cleanup must preserve necessary audit evidence and must not revoke valid registrations.

Production cleanup sequence: verified database and Storage backup; owner-approved exact IDs; dependency/financial review; scoped reversible archival where supported; verify preserved counts and login; record action. This package contains no delete/truncate/update SQL.

Local generated folders such as .next, .next-e2e, playwright-report, test-results and tmp contain build/test output, not the production database. Only remove them when their processes are stopped and any needed test evidence is saved. Keep app, lib, public, database, supabase/migrations, scripts, docs, package files and configuration.
