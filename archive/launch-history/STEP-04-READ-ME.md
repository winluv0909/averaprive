# Step 04 — Accurate crypto payment status

## What changed
The owner payment page now uses the same walletOptions configuration checks as customer checkout. Each channel is marked Configured or Unavailable. Configuration is not proof that the scheduled monitor is running.

Current Trust Wallet invoices are labelled Wallet crypto; older invoices retain the Archived crypto label.

The obsolete manual assignment form was removed. The current wallet resolver matches exact reserved amounts independently and does not use the older manual assignment records. Enabling that form would imply functionality the wallet resolver does not provide. Deposit evidence and candidate IDs remain visible; payment exception review notes remain available. Notes cannot approve payments.

This update does not add settlement for incorrect amounts or confirm live monitoring. Those payments still require support review. No payment records, receiving addresses, payment settings or database functions are changed.

## Install
Copy the contents of this package into your existing project root (the folder containing package.json). Merge folders and replace matching files. Keep this guide in the project root.

Run npm run verify. No npm ci or SQL is needed.

Then run npm run dev and sign in at /owners/login. Open /owners/dashboard/payments. Confirm the Crypto checkout status section and channel list appear. Confirm historical deposit evidence remains readable and the nonworking assignment form is gone. Stop the server with Ctrl+C.

## Save and deploy after checking
Run:

```bash
git add app/owners/dashboard/payments/page.tsx tests/owner-payment-status.test.tsx STEP-04-READ-ME.md
git diff --cached --stat
git commit -m "Align owner crypto status with checkout configuration"
git push
```

After deployment, reload the owner payments page. A Configured label does not establish live monitor health. Before accepting real funds, separately verify the scheduled /api/internal/crypto-monitor job is enabled, authenticates successfully, and completes without errors. Never paste monitor secrets in screenshots or messages.

## Validation
286 tests passed, including three new owner-page rendering tests for disabled checkout, configured channels and missing verification settings. TypeScript and lint passed with four existing warnings. Live payment processing was not exercised.
