# Step 06 — Browser test setup

## Why we are doing this
The project already had `npm run test:e2e`, but had no Playwright configuration or usable browser suite. This update gives that command eight checks, run in desktop and mobile Chromium configurations (16 cases).

Checks: recovery page controls and horizontal overflow; agency and owner login recovery links; blocked unauthenticated reset; invalid recovery links; protected agency and owner dashboard redirects; directory service selection, Clear and publication sorting using two sample records.

These checks do not establish that all pages are visually correct or that actual login/payment/email workflows work. Those need separate tests.

## Files and where they go
Copy the contents into your existing project root, merging folders and replacing matching files:
- `playwright.config.ts` — root; starts an isolated local Next.js server.
- `vitest.config.ts` — root; keeps unit tests separate from browser specs.
- `e2e/public-flows.spec.ts` — e2e folder; browser checks.
- `STEP-06-READ-ME.md` — root; these instructions.

No package or lockfile update, SQL, Supabase setting change or production deployment is needed to try these checks.

## Run one step at a time
1. Stop the local dev server with Ctrl+C.
2. Run `npx playwright install chromium` once. This downloads Playwright's testing browser; it does not replace Chrome or change the website. The project already includes Playwright as a development dependency. If npx asks to install Playwright itself, cancel and run npm ci first.
3. Run `npm run test:e2e`.
4. Expected result after successful execution: `16 passed`. Send failures to your assistant rather than assuming the setup is validated.
5. Run `npx playwright show-report` to inspect the HTML report if needed. Test reports and failure artifacts are already excluded by the project's .gitignore.
6. Run `npm run verify` to check that ordinary unit tests and the production build still pass.

## What this changes
Only test configuration and test files. The suite uses http://127.0.0.1:3106 and refuses to reuse an existing server. It overrides the test process's public Supabase URL/key, service-role key and site URL with non-production placeholders. Directory responses and analytics requests are intercepted inside the browser. No credentials are needed. No forms are submitted. No emails, payments or database records are created. Existing environment files remain unchanged.

## Validation status
The existing source and Playwright documentation were reviewed. A full browser execution could not be completed in the authoring environment because dependency/browser installation did not complete. The 16-case count is the expected suite size, not a claimed pass count. Local browser execution and npm run verify are required before committing this update.

## After validation
Stage only these four files, inspect the staged changes, then commit and push. Your connected Vercel may deploy on push, although this update adds development tests rather than product features. No SQL files belong in migrations for this step.
