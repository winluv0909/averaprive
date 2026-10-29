# Step 09 — Consolidated review and launch package

This is a patch for your existing Avera Privé project, including Step 08. It is not a replacement website or a database reset. The temporary refund-and-retry policy stays in place. All changes are grouped in this single package.

## Install the package

1. Extract the ZIP and copy **all contents into your existing Avera Privé root folder**, beside package.json. Merge folders and replace matching files. No dependency install or new environment variable is required for the application. Browser tests set their own AP_BROWSER_TEST flag internally; do not add that flag to Vercel.
2. In the **Avera Privé** Supabase project's SQL Editor, create **Step 09 — Consent and legacy payment access**. Copy all of `database/step-09-install.sql` and run it. This changes the optional event RPC and removes client execution of retired payment APIs. It does not delete records, send messages, create accounts, change live payments, activate subscriptions or alter wallet addresses.
3. Create **Step 09 — Verify consolidated update** and run the SELECT statements in `database/step-09-verify.sql` separately. The event RPC intentionally remains callable by anon/authenticated; the retired payment APIs must show false/false. The listed private tables must have RLS=true and every shown client permission=false. The final RLS-disabled-table query should return no rows. Rerun Security Advisor and compare with the report's documented exceptions.
4. In VS Code terminal, from the project root:

```powershell
npm run verify
npm run test:e2e
node scripts/check-public-assets.mjs
```

Expected current counts: **329 tests**, **44 browser checks**, **79 local asset references and zero missing assets**. Lint has four pre-existing warnings and no errors. Chromium must already be installed (you installed it in Step 06). If it is missing, run `npx playwright install chromium`. Browser checks compile/start a separate `.next-e2e` server at 127.0.0.1:3106 with dummy Supabase settings; they do not send email or process real payments. Your normal build/development output remains separate.

The SQL file in `supabase/migrations/20261029072018_launch_consent_and_legacy_payment_access.sql` is identical to the install SQL and supports clean rebuilds. Run only the **database/step-09-install.sql** copy in your existing SQL Editor workflow. Do not replay the migration directory or repair migration history by assuming missing versions are unapplied; see the report.

## Commit and deploy the complete patch

`STEP-09-FILES.txt` lists every supplied file. Stage only that list so unrelated local work is not swept into the commit:

```powershell
$stepFiles = Get-Content .\STEP-09-FILES.txt
git --literal-pathspecs add -- $stepFiles
git diff --cached --stat
```

Review that the staged paths correspond to the manifest. Then:

```powershell
git commit -m "Complete consolidated launch review fixes and operating guides"
git push
```

Wait for Vercel Ready. Open the live Payment review page and a public page, hard-refresh, and check the refund section and Cookie Settings. Download a genuine existing invoice to check its display; do not create a real payment/refund solely for screenshots. This deployment smoke check is not proof of settlement.

## Finish the external items in one session

Read **docs/FINAL-ACCEPTANCE.md** for the complete remaining checklist. Related guides:

| File | Purpose |
|---|---|
| docs/CONSOLIDATED-LAUNCH-REPORT.md | What was fixed, tested and read from production; remaining Security Advisor findings |
| docs/EMAIL-DOMAIN-SETUP.md | Supabase Auth SMTP, Resend, optional cross-browser recovery template and final domain sequence |
| docs/OWNER-STAFF-GUIDE.md | Responsibilities and operating workflows for every platform role |
| docs/POLICY-DECISIONS.md | Actual operator details, retention and policy decisions still required |
| database/step-09-inventory.sql | Optional read-only record/scheduler inventory; no deletion |

I could complete the code, isolated tests, read-only database review and preparation here. These require your real environment or decisions: mailbox delivery, agency/staff acceptance, wallet/merchant ownership and real settlement, final domain purchase/DNS/provider configuration, complete operator/legal details and backup/cleanup sign-off. They are not marked complete in the report.

## Authoring validation and boundaries

- TypeScript and lint passed; 329 tests passed across 36 files; production build passed. Invoice changes were tested and PDF output rendered/inspected.
- 44 Chromium checks passed using an isolated production build. The authoring container used a compatible Chromium 153 executable; no container-specific path or browser package is supplied or required on your machine.
- Both complete and production-only lockfile audits reported zero known vulnerabilities on 29 October 2026.
- An intermediate development-server run intermittently returned a route 404; isolated production browser testing replaced that setup. An intermediate repeated build hit a Turbopack persistence-cache panic; the final clean build completed. Do not delete source files or production data to address generated-cache failures.
- No live database writes, account changes, email delivery, financial transfer, record deletion, domain changes or deployment were performed by the author.
- The legal page remains a draft, with current billing/refund operations added. Missing operator identity, mailing details and retention decisions were not invented. Unsupported invoice writing systems still need a separate font upgrade.
