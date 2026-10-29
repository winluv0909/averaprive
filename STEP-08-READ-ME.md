# Step 08 — Crypto refunds and retry

This patch implements the selected policy: refund exception deposits, then have the customer create a fresh invoice. It does not accept incorrect or late deposits as subscription payments.

## Installation, one step at a time

1. Copy the ZIP contents into your existing **Avera Privé root folder**, alongside package.json. Merge folders and replace the two existing page files. Do not delete any existing files. No environment variables or dependencies change.
2. In the **Avera Privé Supabase project**, open SQL Editor, create a query titled **Step 08 — Install crypto refund workflow**, paste the entire contents of `database/step-08-install.sql`, and run it. This adds the refund table and functions; it does not open any cases, move funds, change existing payments or send email.
3. Create a query titled **Step 08 — Verify crypto refund workflow**, paste `database/step-08-verify.sql`, and run it. Expected first row: rls_enabled=true; anon_read, client_read, client_insert, client_update, anon_open=false; authenticated_open=true. Only owners pass the function's internal role check. The function list has two private definer functions and two public invoker wrappers. The case count can return no rows initially.
4. In VS Code terminal, run `npm run verify`. If successful, run `npm run test:e2e` (your previously installed Chromium is required).
5. Commit the files below and push. Wait for Vercel to finish. Do not exercise refund actions on real invoices just to test the interface.

The identical file `supabase/migrations/20261029063618_crypto_refund_retry.sql` is included for clean database rebuilds and CLI-managed deployments. For your SQL Editor workflow, run the **database/step-08-install.sql** copy once; do not separately run the migration copy. If using CLI migrations later, reconcile migration history with your manually installed SQL.

```powershell
git add app/owners/dashboard/payments/page.tsx 'app/dashboard/agencies/[agencyId]/billing/payments/[orderId]/page.tsx' database/step-08-install.sql database/step-08-verify.sql supabase/migrations/20261029063618_crypto_refund_retry.sql tests/crypto-refunds-database.test.ts tests/crypto-refunds-page.test.tsx STEP-08-READ-ME.md
git diff --cached --stat
```

After reviewing the staged files:

```powershell
git commit -m "Add owner crypto refund and retry workflow"
git push
```

## How an actual case works

1. Customer supplies their TXID through the existing payment hint form and contacts billing support. The server independently checks the deposit. A submitted TXID alone proves no ownership.
2. In `/owners/dashboard/payments`, an owner examines an underpaid, overpaid or late-payment exception, independently checks payer ownership through support, and records that evidence. Only finalized, successful deposits of the configured asset/network to the configured wallet qualify. A deposit claimed by, or exactly matching, another invoice is rejected.
3. **Cancel invoice and open refund case** cancels the unpaid order and voids its unpaid invoice atomically. The monitor cannot later activate that order. The old exact amount remains reserved. Existing subscriptions and paid invoices are unchanged. This is a permanent case record, not a reversible draft.
4. Owner verifies the refund destination with the payer through an established support channel, then sends the **full amount actually received** from the external wallet, in the same asset/network. The operator pays network fees separately. Never assume an exchange's sending address is the customer's refund destination.
5. Owner checks the outgoing transaction and uses **Record outgoing refund** to record the outgoing TXID, full amount, verified destination and support note. This is an owner attestation, not independent on-chain refund confirmation. Recording does not send a transfer. Duplicate outgoing hashes are blocked. Saved refund history cannot be overwritten through this workflow.
6. Customer's old payment page hides the QR and send instructions. It first says refund in progress, then displays the owner-recorded outgoing TXID. Confirm receipt with the customer through support before asking them to create a new invoice. A new invoice supplies a new exact amount; do not reuse old instructions.

Finance can inspect cases but only `super_admin` owners can open cases or record refunds. Normal review notes remain available and do not settle payments. No refund emails are added; communication is through your existing support process.

## Scope and limits

- This is full-deposit refund bookkeeping for **unpaid current Trust Wallet invoices** with underpayment, overpayment or late-payment evidence. Paid invoices, old Binance/archived invoices, partial refunds, wrong-token/wrong-network transfers and unrecoverable transfers require separate support handling.
- Receipt of a crypto deposit does not establish who owns it. The owner must check the payer's independent records before opening a case or sending money.
- The website does not hold wallet signing keys, send refunds, verify outgoing refund finality, or automatically approve exception payments. Do not record an outgoing refund until you have actually sent and checked it.
- Review the first real case carefully with the other owner. Existing active subscriptions are not cancelled by refunding an unrelated unpaid invoice.
- The owner page retains the existing 100-record limits; older cases may require database/support review.

## Validation in the authoring environment

- `npm run verify`: passed (TypeScript, lint with four pre-existing warnings, **313 tests**, production build).
- New tests execute the actual SQL in isolated PGlite/Postgres: unauthorized access, cancelled/void state, no subscription activation, underpayment/overpayment/late cases, finality, claimed/mismatched deposits, full-amount refund records, idempotency, immutable audit history, duplicate outgoing references and table permissions.
- Customer render tests confirm cancelled refund invoices do not generate payment QR codes and distinguish owner-recorded refunds from verified receipt.
- Browser regression attempt could not launch Chromium; its download returned truncated archives in this environment. Run the existing 16 desktop/mobile checks on your machine. No browser pass is claimed for this patch here.
- No live Supabase migration, real deposit, outgoing refund or production refund workflow has been executed by the author.
