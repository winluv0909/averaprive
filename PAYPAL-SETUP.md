# Avera Prive - PayPal Sandbox setup

This update is based on your latest uploaded project. It preserves the public site,
owner and agency page styles, existing invoices, and historical payment records.
New crypto checkout and the crypto monitor are disabled. No Binance API is called
by the new PayPal checkout. Old crypto records/code are retained for history; they
are not deleted, relabeled as Trust Wallet, or used to receive new payments.

## 1. Install

Put Avera-Prive-PayPal-Setup.ps1 in your project folder (beside package.json).
Stop npm run dev with Ctrl+C, then run this in that folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\Avera-Prive-PayPal-Setup.ps1
```

The installer validates the original files, stages changes, and creates a backup
beside your project folder. If a target file changed since the ZIP was uploaded,
it stops before installing. It never reads or overwrites .env.local. It does not
run SQL, install dependencies, or deploy your website.

## 2. Run the migration

In Supabase -> SQL Editor -> New query, paste all of:

supabase/migrations/202610110024_paypal_checkout.sql

Click Run. The previous payment migrations 017 and 021-023 must already have
been applied (you previously reported success for 021-023). Do NOT rerun demo
agency seed migrations. This migration does not delete agency/payment data.

## 3. Confirm local settings

Keep your sandbox credentials in .env.local. For local testing use:

```env
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_secret
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Use the actual port if your dev server is not on 3000. The site URL controls the
return destination; do not leave a production URL here while testing locally.
The existing SUPABASE_SERVICE_ROLE_KEY is also required on the server. Never
add NEXT_PUBLIC_ to a secret or commit these values to source control.

No PayPal plan IDs are needed: this implementation uses one-time PayPal Orders,
not automatically renewing PayPal subscriptions. Prices come from ap_plans in
Supabase, not the customer's browser. Existing active same-plan access is
extended by the purchased period for LIVE payments only.

## 4. Start and test

```powershell
npm run dev
```

1. Sign into the agency portal using an agency owner/admin/billing membership.
   The platform owner/staff login remains separate from agency billing.
2. Open Agency profile -> Billing -> choose Prive, Select, or Elite.
3. Fill out company/billing information; choose monthly or annual access.
4. Click Continue to PayPal Sandbox.
5. Pay using your SANDBOX PERSONAL buyer account, not your real PayPal login.
   Find it under PayPal Developer Dashboard -> Testing Tools -> Sandbox Accounts
   (or Sandbox -> Accounts). Open the personal test account's details to see its
   test email and password. The business sandbox account is the receiving account.
6. Approve payment and return to Avera Prive. The return triggers a protected
   server action that captures/checks the order and independently reads the
   capture from PayPal before recording success.
7. Expect 'Sandbox payment verified'. Open the invoice and download the PDF.
8. Expect your REAL subscription to remain unchanged. Sandbox payments do not
   send real paid-receipt emails or activate live access. Invoice lists and PDFs
   label test records as sandbox.
9. Repeat verification: the same capture must not create duplicate access or
   duplicate invoices. Test canceling PayPal checkout too; no access is activated.

If you already approved/paid but verification is unavailable, use Verify payment
status or contact support. Do not pay again. An approval/return URL alone never
counts as proof of a completed payment.

## 5. Automatic recovery after deployment

On a publicly reachable HTTPS deployment, add these settings privately:

```env
NEXT_PUBLIC_SITE_URL=https://your-actual-domain.example
PAYPAL_WEBHOOK_ID=the_webhook_id_from_your_sandbox_app
PAYPAL_MONITOR_SECRET=a_private_random_value_at_least_32_characters_long
```

In your PayPal Sandbox app, add a webhook URL:

https://YOUR-ACTUAL-DOMAIN/api/paypal/webhook

Subscribe to:
- CHECKOUT.ORDER.APPROVED
- PAYMENT.CAPTURE.COMPLETED
- PAYMENT.CAPTURE.PENDING
- PAYMENT.CAPTURE.DENIED
- PAYMENT.CAPTURE.REFUNDED
- PAYMENT.CAPTURE.REVERSED

Copy the returned webhook ID into PAYPAL_WEBHOOK_ID. Restart/redeploy after
changing environment settings. PayPal cannot deliver webhooks directly to
localhost. Use actual sandbox purchases to test: simulated webhook events are
not supported by the PayPal postback signature-verification method used here.

Configure your scheduler to POST every minute to:
https://YOUR-ACTUAL-DOMAIN/api/internal/paypal-monitor
with header: Authorization: Bearer YOUR_PAYPAL_MONITOR_SECRET

GET is also supported for schedulers requiring it. This worker reconciles up to
two pending orders per run and retries queued invoice emails. Signed webhooks
are the primary automatic path; the worker is recovery when callbacks fail or
arrive before records are linked. A real scheduler must be configured by you;
the installer does not create one or silently add a Vercel cron job.

## 6. Invoice email and owner review

LIVE paid invoices use the existing durable Resend email queue. Configure your
own verified sender and recipients:

```env
RESEND_API_KEY=your_private_resend_key
PAYMENT_EMAIL_FROM=your_verified_sender_address
PAYMENT_ADMIN_EMAILS=your_admin_email_address
```

Paid PDF invoices are saved under Agency Dashboard -> Billing -> Invoices and
attached to the customer's receipt. Sending email can fail independently of a
successful payment; the scheduled worker retries the durable queue. The owner
Payments page shows PayPal records, exceptions and pending email notices. Full
refunds/reversals revoke the entitlement if it is still associated with that
capture. Partial refunds require finance review; this update does not issue
refunds or generate accounting credit notes automatically.

## 7. Before accepting real payments

This installer does NOT enable live payments. First confirm PayPal eligibility
for Avera Prive's actual OFM-agency directory/workspace business. A sandbox test
or account creation is not PayPal's approval of the business model.

After eligibility is confirmed, use the LIVE app's credentials and webhook ID,
the LIVE receiving business account's merchant ID, HTTPS, the scheduler and
transactional email settings. Live checkout requires:

```env
PAYPAL_ENV=live
PAYPAL_CLIENT_ID=your_live_client_id
PAYPAL_CLIENT_SECRET=your_live_secret
PAYPAL_MERCHANT_ID=your_live_business_merchant_id
PAYPAL_WEBHOOK_ID=your_live_webhook_id
PAYPAL_MONITOR_SECRET=your_private_random_secret_at_least_32_characters
PAYPAL_LIVE_ENABLED=true
```

Do not mix Sandbox and Live credentials/merchant IDs. PAYPAL_MERCHANT_ID is
optional for sandbox; if supplied, it must be the SANDBOX business account ID.
Orders are permanently bound to their environment and receiving account.
One-time monthly/annual purchases do not authorize automatic recurring charges.

## Validation performed

Focused local tests cover independent amount/currency/merchant checks, capture
status, duplicate capture prevention, environment isolation, idempotent access,
refund/reversal handling, staff/member authorization, invoice output and durable
email delivery. TypeScript, changed-file ESLint and the production build were
checked. Your private credentials were excluded from extraction and were not
used. Actual sandbox payments, deployed callbacks and email delivery must still
be tested with your own accounts.
