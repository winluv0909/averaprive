# Avera Prive — consolidated improvements

This is a source update for the existing project supplied in Avera Prive(2).zip. It is not a standalone replacement project. No SQL installation is required.

## Install in your existing root folder

1. Keep the downloaded ZIP outside your project. Extract it into a temporary folder.
2. Copy ALL extracted contents (including `.github`, `.gitignore`, and `.env.example`) into `C:\Users\winlu\Avera Privé` and replace matching files. Do not create a second nested project folder. Do not replace your private `.env.local` file.
3. In the VS Code PowerShell terminal at that existing project root, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Apply-Consolidated-Improvements.ps1
npm ci
npm run verify
```

The script removes only byte-identical old root README duplicates after checking their archived copies. Modified historical documents are preserved with a warning. No accounts, agency records, invoices, payment history, database backups, or real environment variables are edited.

To run optional isolated browser checks on your computer:

```powershell
npx playwright install chromium
npm run test:e2e
```

## Commit and deploy after verification

```powershell
git status --short
git add .
git commit -m "Add platform hardening SEO error pages and CI"
git push
```

Unlike the earlier backup exercise, this update changes website source and needs a Git push to reach your connected Vercel deployment. GitHub Actions starts after the workflow is pushed. It is configured for pushes and pull requests with read-only repository permission, pinned action revisions, a timeout, and cancellation of superseded runs. Dummy test credentials are used; do not add production secrets to CI. A workflow file alone does not make checks required for merging: configure a branch rule later if desired. Included Actions usage depends on your GitHub plan and budget.

## What changed

1. **Branded errors:** root 404, segment error and global error UI with home/directory recovery and retry. Global fallback uses inline styling and works without the normal root layout. Error messages and stack traces are not displayed.
2. **CSP observation:** `Content-Security-Policy-Report-Only` plus `Reporting-Endpoints`, legacy `report-uri` fallback and `/api/csp-report`. This is monitoring, not CSP enforcement. The collector bounds incoming bytes, caps logs per process, and logs directive names only, not full URLs or script samples. Inspect `csp_report` entries in Vercel runtime logs after deployment. Counts are best-effort, not a durable monitoring dashboard. Review legitimate PayPal/Supabase/font/analytics violations before any later enforcement change.
3. **Agency SEO:** `/agencies/[slug]` is a Node server-rendered HTML route using the existing trusted profile template. Name, overview, location, title, description, canonical, Open Graph and Organization structured data are present before JavaScript. The original scripts still populate detailed sections and handle inquiries, claims and reviews; all relative template assets/links are rooted correctly. Directory, compare, rankings and related profiles link to the new route. Legacy query URLs remain usable and get a client canonical when data loads. Publication remains controlled by the existing `ap_public_agencies` view, with demonstration profiles excluded. Sitemap includes valid published agency slugs. No ratings or business claims are invented. Canonicals follow `NEXT_PUBLIC_SITE_URL` and can change after the domain is purchased.
4. **Inquiry hardening:** reject cross-origin submissions and non-JSON content; enforce a 12,000-byte limit on the actual stream, even with a missing or false Content-Length. Keep the existing honeypot, consent, field checks and database RPC protections. No database migration is needed. Origin checks are not a substitute for database rate limits. Host matching ignores forwarded-host headers.
5. **CI:** typecheck, lint, unit tests and production build on push/PR. Browser tests remain an optional separate command; they are not claimed as part of this CI job.
6. **Repository maintenance:** historical STEP READMEs and FULL-CHANGED-CODE.md retained in `archive/launch-history/`; active instructions updated. Stale Stripe placeholders removed only from `.env.example`; corrected demonstration comment; ignore local dumps, restore folders and private key files. `.gitignore` does not untrack files already committed.
7. **Lossless compression:** five large PNGs optimized with unchanged dimensions and identical decoded RGBA pixels. Existing image URLs stay valid. See validation report for measured savings; Hussar has very little lossless headroom.
8. **Legal preparation:** `docs/OPERATOR-POLICY-INTERNAL-DRAFT.md` contains marked missing decisions and is not rendered on the public site. Operator identity, address, final mailboxes, refunds, retention, deletion, governing law and effective date remain for later owner approval. Existing temporary crypto refund-and-retry behavior remains in place.

## Scope and verification limits

See `docs/CONSOLIDATED-IMPROVEMENTS-VALIDATION.md`. Tests use fixtures and dummy credentials. No production database, domain settings, authentication email templates or payment provider settings were changed. Domain/email/live-payment launch testing remains paused as requested. Existing public legal pages are unchanged. Errors originating outside the application (for example a hosting outage) cannot all be caught by Next.js boundaries.

For SEO fixture tests, server HTML rendering is tested directly and in a browser; it is not a live crawl of your production agency database. First deployment still needs a quick check of one real published slug and the sitemap. Do not rerun old archived installers or migrations.
