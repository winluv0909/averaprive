# Step 03 — Registration submission safeguard

This update makes the database require a verified Avera Privé registration number
assigned to the agency before a new profile can be submitted for review.
The number is a platform identifier, not a government registration number.

A draft can still be created: normal signup needs that draft before the trusted
server assigns its number. A draft without a number cannot be submitted.
Knowing a number, editing signup metadata, or owning a different numbered agency
will not satisfy the check.

Existing published listings remain unchanged. The separate curated-profile claim
route remains available. Resubmission through that route requires a completed,
fully reviewed approved claim held by a current active owner. Old drafts without
a number or a qualifying claim must complete registration before submission.

## 1. Copy the files

Copy the contents of this update into your Avera Privé project root. Keep the
folder structure. Replace the migration-order document when prompted.

| File | Location | Purpose |
| --- | --- | --- |
| STEP-03-READ-ME.md | Project root | These instructions |
| registration-submission-safety.test.ts | tests/ | Database regression tests |
| release-safety.test.ts | tests/ | Existing tests updated with a valid registration fixture |
| DATABASE-MIGRATION-ORDER.md | docs/ | Updated migration inventory |
| step-03-preflight.sql | database/ | Read-only before check; not a migration |
| step-03-verify.sql | database/ | Read-only after check; not a migration |
| 20261025103742_require_registration_number_for_submission.sql | supabase/migrations/ | The actual database fix |

No dependency installation or environment-variable change is required.

## 2. Check the code locally

In the VS Code terminal, run:

```bash
npm run verify
```

Wait for type checking, lint, tests, and the production build to finish.
The existing four lint warnings are not new errors.

## 3. Run the before check in Supabase

SQL Editor title: **AP Check 04 - Before Registration Safeguard**

Open `database/step-03-preflight.sql` in VS Code. Copy its entire contents into
a new Supabase SQL Editor query with the title above, then click Run.
Keep the results for comparison. This query only reads counts.
Save the local file under `database/`, not in `supabase/migrations/`.

## 4. Install the database fix

SQL Editor title: **AP Fix 03 - Require Registration Number Before Submission**

Open `supabase/migrations/20261025103742_require_registration_number_for_submission.sql`.
Copy its entire contents into a new Supabase SQL Editor query with the title
above, then click Run once. Expected result: `Success. No rows returned`.

Keep this file in `supabase/migrations/`. Do not run the older migrations again.
This fix replaces one submission function and resets its EXECUTE permissions.
It does not edit or delete existing agencies, numbers, claims, or payment records.

## 5. Check installation

SQL Editor title: **AP Check 05 - Verify Registration Safeguard**

Copy all of `database/step-03-verify.sql` into a new Supabase SQL Editor query
with the title above, then click Run. Every `passed` value in the first result
must be `true`. The second result contains counts to compare with AP Check 04.
Save this local file under `database/`, not in `supabase/migrations/`.

These read-only checks verify installation and permissions. The automated tests
exercise allowed and blocked submissions in an isolated database; they do not
send emails or create test data in your live Supabase project. A real email
signup on the deployed site remains a separate acceptance check.

## 6. Commit and deploy after the checks pass

```bash
git add STEP-03-READ-ME.md docs/DATABASE-MIGRATION-ORDER.md database/step-03-preflight.sql database/step-03-verify.sql tests/registration-submission-safety.test.ts tests/release-safety.test.ts supabase/migrations/20261025103742_require_registration_number_for_submission.sql
git diff --cached --stat
git commit -m "Require verified registration numbers before agency submission"
git push
```

No application page files are changed. The database safeguard takes effect as
soon as AP Fix 03 succeeds; the commit preserves its source and tests.
