# Consolidated review before domain purchase

This package follows Step 09 and the owner invoice/cookie fix. It contains regression tests, a read-only SQL inventory, updated operating documents and a Word guide. It does not alter app behavior, production data, Auth settings or payment configuration. No SQL installation or Vercel deployment is required.

## Where to put these files

Extract into your existing Avera Privé project ROOT (the folder containing package.json), merging docs, database and tests. Replace only files named in NO-DOMAIN-REVIEW-FILES.txt. Keep docs/Avera-Prive-Owner-Staff-Guide.docx for owners and staff; it may also be stored outside the project for reading.

Start with docs/NO-DOMAIN-REVIEW.md. The owner decisions and remaining live acceptance are grouped in docs/OWNER-DECISION-SHEET.md. Production backup limitations and the separate restore procedure are in docs/PRODUCTION-BACKUP-RUNBOOK.md. No domain or SMTP changes are included.

## Tests and optional source control

The isolated tests cannot send emails, contact a live payment provider or publish production records. Their Auth/Storage tables are stand-ins. Their archive restore is not a production Supabase restore.

After copying, run npm test to execute the updated 387-test suite locally. You do not need another deployment to obtain the report. If you want these tests/documents versioned, run the following in PowerShell from the ROOT. Inspect the staged summary for unrelated already-staged work before committing.

```powershell
npm test
$reviewFiles = Get-Content .\NO-DOMAIN-REVIEW-FILES.txt
git --literal-pathspecs add -- $reviewFiles
git --no-pager diff --cached --stat
git commit -m "Document launch audit and add role and workflow regression checks"
git push
```

A Git push may trigger the repository's normal Vercel pipeline, but this package changes no application runtime files. Do not copy environment files or credentials. The SQL inventory is optional/read-only and has already been inspected during the review; do not run old install SQL or replay the migration folder.
