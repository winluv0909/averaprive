# Consolidated improvements — validation

## Completed locally

- Clean dependency installation from the uploaded package-lock.json completed (`npm ci --ignore-scripts`). No dependency versions were changed.
- TypeScript: passed.
- ESLint: 0 errors, 4 pre-existing warnings (three existing image-element warnings and one unused portal-shell variable).
- Unit/database fixture tests: **409 passed across 43 files**. Prior suite had 387 tests; 22 new cases cover bounded/chunked input, foreign/missing origins, correct local Host handling, spoofed forwarded hosts, consent, RPC dispatch, generic errors, CSP reporting, profile HTML escaping and server responses, and sitemap publication filtering.
- Production build: passed with dummy credentials and no production service access.
- Desktop/mobile browser suite: **54 passed** against isolated local production output. Includes branded 404/header checks, no-JavaScript profile readability, retained contact-modal submission using fixtures, real endpoint 400/403/413/415 rejection paths, and existing public-page/access/consent checks.
- Browser runtime: stock Playwright Chromium download was unavailable in this environment. The suite was run successfully using a separate Chromium 153 binary installed solely for local QA. No workaround paths or browser dependency changes are included in the update. On your computer use the normal `npx playwright install chromium` command.
- Public asset checker: **79 references checked, no missing assets**.
- PNG verification: dimensions, decoded RGBA pixels, and embedded ICC profiles preserved. Existing file URLs retained.

## Measured PNG sizes

| File | Before (bytes) | After (bytes) | Saved (bytes) |
| --- | ---: | ---: | ---: |
| empire-of-agency.png | 211,559 | 195,876 | 15,683 |
| sakura-management.png | 207,710 | 195,947 | 11,763 |
| elev-agency.png | 486,716 | 438,322 | 48,394 |
| hussar-ofm.png | 1,014,531 | 1,012,897 | 1,634 |
| shevo-studio.png | 261,237 | 248,048 | 13,189 |

Total saved: **90,663 bytes**, losslessly. Hussar is already close to its lossless size limit; there is no claim of a dramatic reduction.

## Important limits

- GitHub Actions is configured but has not been run on your repository; its first hosted run follows your push.
- No Git push, Vercel deployment, production SQL, email, real payment, domain, or account action was performed.
- Public profile server data access is tested through mocked publication-view responses. Browser profile tests use clearly named fixtures; they do not certify a live crawl of production records. Detailed profile sections remain browser-enhanced as before. Verify a real profile slug and sitemap after deployment.
- CSP is report-only. The collector logs directive names to runtime logs and caps logs per process; it is not enforcement or a durable monitoring service. Distributed ingress abuse protection remains a platform concern.
- Legal/operator choices remain an internal draft; no public policy claims were added.
- Archive script logic was checked against the ZIP hashes. Execution in Windows PowerShell remains part of installation on your PC.
- This work does not reopen domain/email/live-payment launch acceptance, which remains paused at your request.
