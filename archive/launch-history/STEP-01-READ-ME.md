# Avera Privé — Step 01: dependencies and database corrections

Prepared for **Avera Privé(7).zip**, 25 October 2026.

This update fixes the dependency findings and three reproduced database problems:
1. A trial could replace a paid subscription.
2. Owner/finance manual plan decisions failed on an ambiguous `decision_note` reference.
3. Agency users could change internal approval/provenance columns on editable drafts.

The database corrections contain no cleanup, account deletion, agency deletion, price changes or modifications to existing subscriptions. They protect subsequent operations. They do not attempt to reconstruct any records previously affected by these bugs. Existing paid records needing correction require individual review.

## A. Put the supplied files into VS Code

1. Extract this ZIP into a separate folder.
2. Open your existing Avera Privé project in VS Code. The **project root** is the folder containing `package.json`, `app`, `lib`, `public` and `supabase`.
3. Copy this update's contents into that existing root, preserving the folders below. Merge folders and replace only matching supplied files. Do not replace the whole project with this small update package.
4. Keep your existing environment files, Supabase project, Vercel project and official data.

| File | Where to save it | Replaces an existing file? |
|---|---|---|
| `package.json` | Project root | Yes |
| `package-lock.json` | Project root | Yes |
| `STEP-01-READ-ME.md` | Project root | New |
| `supabase/migrations/20261025090249_protect_subscription_trials_and_decisions.sql` | Exact supplied migrations path | New |
| `supabase/migrations/20261025090252_restrict_agency_profile_update_columns.sql` | Exact supplied migrations path | New |
| `tests/release-safety.test.ts` | `tests/` | New |
| `database/step-01-preflight.sql` | `database/` | New; read-only check, not a migration |
| `database/step-01-verify.sql` | `database/` | New; read-only check, not a migration |
| `docs/DATABASE-MIGRATION-ORDER.md` | `docs/` | Yes |

No old migration should be overwritten. This package includes only two new migration files.

## B. Install and test locally

Open **Terminal > New Terminal** in VS Code, at the project root, and run:

```bash
npm ci
npm run verify
npm audit
npm audit --omit=dev
```

Run each command after the previous one finishes successfully. `npm ci` uses the supplied lockfile. These commands do not apply SQL to Supabase.

This package pins Next.js and `eslint-config-next` to **16.4.3**, and updates the compatible transitive Zod dependency. No API keys need changing for these fixes.

Verified here: TypeScript passed; lint had 0 errors and the same 4 existing warnings; 248 tests across 26 files passed; production build passed. Full and production-only audits both reported 0 vulnerabilities at preparation time. Browser acceptance and live database/provider checks remain separate.

## C. SQL entry 1 — AP Step 01 - Check Existing Database (READ ONLY)

**Purpose:** confirm the expected tables, functions, RLS and draft-edit policy exist; record current counts before applying the fixes.

**File to open in VS Code:** `database/step-01-preflight.sql`.

**Save it locally?** Yes, at that path. It is a read-only diagnostic and does **not** belong under `supabase/migrations/`.

1. Open Supabase and select your **existing Avera Privé project**.
2. Open **SQL Editor > New query**.
3. Set the query title to **AP Step 01 - Check Existing Database**.
4. Copy the complete contents of `database/step-01-preflight.sql` into the editor and click **Run**.
5. It returns two result sets: compatibility checks, then data counts. Inspect both results/tabs. Every compatibility field except `database_name` should be **true**. Keep the count result for comparison.
6. If a compatibility field is false/null or any statement errors, stop before the fixes and share the exact result/error. Do not recreate tables or replay the old migrations to force this to pass.

This query reads counts only; it does not print emails, credentials or payment details. Confirm the counts are consistent with your intended existing project.

## D. SQL entry 2 — AP Fix 01 - Protect Subscription Trials and Manual Plan Decisions

**Purpose:** block trials from replacing paid/history-bearing subscriptions, serialize trial decisions with payment activation, and fix named-argument manual subscription approval/decline.

**File to open:** `supabase/migrations/20261025090249_protect_subscription_trials_and_decisions.sql`.

**Save it locally?** Yes. Keep this exact file inside `supabase/migrations/`.

1. Continue only after entry 1 passes in the correct project.
2. In **SQL Editor > New query**, set the title to **AP Fix 01 - Protect Subscription Trials and Manual Plan Decisions**.
3. Paste the complete file, including `begin;` and `commit;`.
4. Click **Run**. Expected result: **Success. No rows returned.**
5. Stop if there is an error; share its exact message before proceeding.

The update preserves the existing RPC function signatures used by the website. A new trial is available for an agency without a subscription, or an untouched Free subscription. Previous trials, paid plans and subscriptions with paid-period/reference history cannot be replaced by a trial. Authorized manual approvals retain the existing one-month activation behavior; this does not alter PayPal capture processing.

## E. SQL entry 3 — AP Fix 02 - Restrict Agency Profile Updates to Editable Columns

**Purpose:** keep ordinary profile editing while preventing direct client changes to approval state, publication state, reviewed-source data, identifiers and other internal fields.

**File to open:** `supabase/migrations/20261025090252_restrict_agency_profile_update_columns.sql`.

**Save it locally?** Yes. Keep this exact file inside `supabase/migrations/`.

1. In **SQL Editor > New query**, set the title to **AP Fix 02 - Restrict Agency Profile Updates to Editable Columns**.
2. Paste the complete file and click **Run**.
3. Expected result: **Success. No rows returned.**
4. Stop if there is an error and share its exact message.

This preserves SELECT access and the existing row-level security policies. Signup profile updates, normal draft edits, and trusted moderation/publication operations passed the isolated regression checks. Staff continue to use their authorized operations; direct SQL executed as database administrator is not the same as an agency client's access.

## F. SQL entry 4 — AP Check 03 - Verify Subscription and Profile Fixes (READ ONLY)

**Purpose:** verify the replacement functions, expected column permissions, RLS, read access and anonymous restrictions; compare data counts.

**File to open:** `database/step-01-verify.sql`.

**Save it locally?** Yes, at that path, outside migrations.

1. In **SQL Editor > New query**, set the title to **AP Check 03 - Verify Subscription and Profile Fixes**.
2. Paste the complete file and click **Run**.
3. The first result set should contain **true for every check**.
4. Compare the second result set with entry 1. With no unrelated activity, the counts should match. These migrations themselves do not change those records.
5. If a check is false or counts change unexpectedly, share the results before proceeding further.

These are installation checks, not proof of every live workflow. Next, check normal agency profile saving and authorized moderation in your actual app. Avoid creating fake paid records or overwriting real subscription data just to test these functions.

## G. Record and deploy

After local checks and SQL verification succeed, keep the changed/new files in your Git repository and record which SQL entries were applied and when. Running SQL in the dashboard does **not** automatically register those migration filenames in the Supabase CLI migration-history table. Do not run a blanket `supabase db push` against the existing project; reconcile applied history first if you later switch to CLI-driven deployment.

Use the existing Git/Vercel workflow when ready. These fixes require no environment changes. Commit only the supplied changed/new paths, alongside any other work you have separately reviewed; do not use a blanket `git add .` without checking your working tree.

Example, after every step above succeeds:

```bash
git add package.json package-lock.json STEP-01-READ-ME.md tests/release-safety.test.ts database/step-01-preflight.sql database/step-01-verify.sql docs/DATABASE-MIGRATION-ORDER.md supabase/migrations/20261025090249_protect_subscription_trials_and_decisions.sql supabase/migrations/20261025090252_restrict_agency_profile_update_columns.sql
git diff --cached --stat
git commit -m "Protect subscription trials and agency profile fields; update dependencies"
git push
```

Inspect the staged file list before committing. Confirm the corresponding Vercel deployment reaches **Ready**.

## Remaining work after Step 01

Registration-number enforcement, directory option/sort alignment, crypto exception handling, account recovery, usable Playwright browser tests, robots/SEO, legal-policy completion and live acceptance remain separate tasks. This package does not claim those are fixed.
