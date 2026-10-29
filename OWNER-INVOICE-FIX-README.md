# Owner invoices and first-visit privacy choices

Apply after the consolidated Step 09 update. Copy this ZIP's contents into the existing Avera Privé project ROOT (where package.json is), merging folders and replacing these files. Do not put the extracted folder inside the root. No SQL, environment changes, new packages or payment actions are required.

## Behavior
- Payment review now lists View invoice and Download PDF inside each expanded payment record when an invoice exists. Records without an invoice say so.
- Both new routes independently require a signed-in super_admin or finance role, including the existing forced-password-setup checks. Agency roles and other staff roles do not gain access. PDF responses are private/no-store.
- Owner and agency invoices share their document renderer, state labels and existing PDF generator. The owner screen has a Payment review back link and no agency checkout links.
- Public privacy choices appear at the bottom of the viewport on first load, without scrolling. Analytics remain off until allowed. Saved choices keep the panel closed; Cookie Settings reopens it. Invalid saved values are treated as no choice. The panel scrolls on small screens and does not block the rest of the page.

## Verify and deploy
Run in PowerShell from the project root:
```powershell
npm run verify
npm run test:e2e
$fixFiles = Get-Content .\OWNER-INVOICE-FIX-FILES.txt
git --literal-pathspecs add -- $fixFiles
git --no-pager diff --cached --stat
git commit -m "Add owner invoice access and visible first-visit privacy choices"
git push
```

## Live checks
1. After Vercel Ready, hard-refresh /owners/dashboard/payments. Expand the sandbox/test_completed record. Open View invoice and download its PDF. Sandbox labels must remain visible; no live subscription is activated.
2. In a fresh incognito window open the public homepage: both privacy buttons must be visible without scrolling. Choose Essential only, reload, and confirm the panel stays closed. Reopen through Cookie Settings in the footer. Your ordinary browser already has a saved choice, so it correctly does not show the panel automatically again.
3. Check invoice access with owner and finance accounts; other roles must be denied. Do not create a payment for this check.

## Author validation
Typecheck passed. ESLint: zero errors, four existing warnings. All 337 unit/integration checks passed, including eight new owner-invoice authorization/response checks. Four desktop/mobile browser checks passed for initial visibility, saved choices, reopening and consent withdrawal. The browser run also compiled a production build. No live payment, email or production invoice data was used.
