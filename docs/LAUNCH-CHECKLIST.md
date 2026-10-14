# Public launch checklist

Leave an item unchecked until its result is confirmed for the target environment.

- [ ] Finish remaining public pages, workspaces, popups, and responsive review.
- [ ] Confirm production billing settings and invoice PDF character handling.
- [ ] Reconcile applied database migrations, including manually run queries.
- [ ] Resolve or document remaining database access-rule and advisor findings.
- [ ] Verify private records and role boundaries with separate accounts.
- [ ] Review environment configuration without exposing secret values.
- [ ] Finish legal policies and identify the actual service operator.
- [ ] Confirm support and billing contact details.
- [ ] Confirm domain ownership, DNS, HTTPS, and canonical origin.
- [ ] Update authentication URLs and verify sign-in and recovery flows.
- [ ] Verify email sender configuration and actual email delivery.
- [ ] Confirm PayPal and crypto production settings and payment monitoring.
- [ ] Complete controlled payment, invoice, notification, and recovery checks.
- [ ] Confirm backups, monitoring, retention operations, and incident contacts.
- [ ] Run npm run verify and review all warnings.
- [ ] Review full and production-only dependency audits.
- [ ] Complete final browser and role-based acceptance checks.
- [ ] Confirm the intended commit is deployed and Vercel reports Ready.

Do not recreate the existing database or rerun applied migrations as part
of this checklist. The production migration chain does not seed fictional
agency profiles or simulated ratings.