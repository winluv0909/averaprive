# Step 07 — Search-engine settings and current setup notes

## What and why
Old static discovery files contain the earlier agency-prive.vercel.app host.
Generated robots/sitemap files also exist. This update keeps the generated files
as the source, normalizes their HTTPS domain, adds recovery-route crawl guidance,
adds noindex response headers for account/API routes, and blocks preview indexing.
It corrects the old canonical link on reviews.html and documents browser tests,
password recovery and outstanding email setup.

No SQL, account changes, database writes or dependency updates are included.
This does not guarantee Google indexing or replace authentication/permissions.
The sitemap still reads published editorial posts through existing permissions.

## Install — one step at a time with your assistant
1. Copy the ZIP contents into the existing project root and replace matching files.
2. In VS Code, DELETE ONLY `public/robots.txt` and `public/sitemap.xml`.
   Keep `app/robots.ts` and `app/sitemap.ts`: these generate the correct URLs.
   Git preserves the deleted files in history. Do not delete the public folder.
3. Run `npm run verify`, then `npm run test:e2e`.
4. Run `npm run dev`. Open /robots.txt and /sitemap.xml locally.
   Generated sitemap URLs intentionally use your HTTPS public domain, not localhost.
5. Check that /forgot-password responses have X-Robots-Tag: noindex, nofollow
   in browser developer tools → Network → document → Headers.

Keep this guide and README.md in the project root. Keep the other files at the
paths provided. There are no SQL files to save in database or migrations.

## Before committing
Stage only this patch and the two deleted files. Do not stage unrelated work:

```bash
git add app/robots.ts app/sitemap.ts next.config.ts lib/seo/settings.ts public/reviews.html tests/search-engine-settings.test.ts README.md STEP-07-READ-ME.md
git add -u public/robots.txt public/sitemap.xml
git diff --cached --stat
```

After checking the staged list, commit and push with your assistant. Confirm
Vercel Ready, then inspect https://averaprive.vercel.app/robots.txt and
https://averaprive.vercel.app/sitemap.xml. Public listing eligibility, real
search-engine indexing, the final domain and Search Console remain separate.

## Validation
New regression tests cover canonical origins, production crawl guidance,
recovery exclusions/noindex and preview crawling. The authoring environment's
package installation has been unavailable; full project checks and deployed
HTTP behavior must pass on your computer before this step is marked complete.
