# Avera Privé — shared Binance checkout setup

This update allows separate invoices to reuse your Binance receiving addresses, including simultaneous purchases. It removes the one-address-per-invoice limit without deleting existing invoices, address lease records, transaction claims, subscriptions, or unrelated pages. Plan prices and exact token quotes are unchanged. The branded PDF invoice renderer is included.

## What is automatic and what still needs owner review

Funds are sent directly to the configured addresses on your Binance account. There is no payment-provider receiving wallet and the application never requests withdrawal permission.

Each invoice has its own ID, agency, plan, billing cycle, amount, network and expiry. The receiving address is shared; a normal token transfer does not contain our website invoice ID. A submitted TXID is a lookup hint, not proof that a customer owns the payment.

The backend can match automatically only when independent transaction details identify a single possible invoice. If several invoices use the same token, network and address, the deposit requires owner matching review. We consider other invoice amounts too, because an underpayment or overpayment could belong to them. Paid, expired and cancelled historical invoices remain potential explanations for an extra or late payment. They are not discarded to force a newer match.

**This supports simultaneous checkout, but it does not provide fully automatic assignment of every shared-address deposit.** Repeated purchases of the same plan will commonly need owner matching review. Complete automatic attribution at scale requires an independently verifiable invoice reference or payer proof (for example a separate authenticated wallet payment flow). This installer does not introduce such a reference or infer payment ownership from amount, arrival order or a public TXID. It does not alter prices to manufacture unique payment amounts.

After owner assignment, the worker still re-fetches the transaction and checks correct network, token contract, address, exact amount, transaction time, successful execution, blockchain confirmation/finality and successful Binance deposit credit. Wrong amounts, late transfers and other exceptions do not activate subscriptions. One network/TXID cannot activate two invoices. Saving a review note is not payment approval.

## 1. Install on Windows

Save Avera-Prive-Shared-Binance-Checkout.ps1 in your project folder:

`C:\Users\winlu\Avera Privé`

Stop your development server with Ctrl+C. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\Avera-Prive-Shared-Binance-Checkout.ps1
```

The installer backs up affected files outside the project and rolls back code changes on installation failure. It preserves existing public, authentication, sidebar and unrelated page code. It does not edit .env.local or run SQL automatically. It contains the full billing implementation and premium invoice assets; no ZIP extraction is needed.

## 2. Apply the SQL update

In Supabase SQL Editor, against the same project used by your website:

1. If not previously applied, run `supabase/migrations/202610110021_reliable_crypto_payments.sql`.
2. If not previously applied, run `supabase/migrations/202610110022_binance_credit_verification.sql`.
3. Then run `supabase/migrations/202610110023_shared_binance_checkout.sql`.

Existing subscription/crypto billing tables from the previous setup are required. Do not run older 017 or rerun 021/022 after 023: earlier migrations replace the current functions with older implementations. "Success. No rows returned" means the SQL ran; it does not mean live payments are connected.

Migration 023 preserves records and switches unfinished configured invoices to shared matching. Existing paid periods are not changed. Previous address leases remain as history and no longer restrict new checkout. Re-running 023 is safe; it does not reset transaction claims or assignments.

## 3. Configure private service values

Use `reliable-payments.env.example` as a reference. Keep existing Supabase values in .env.local. Never send API keys, secrets, private keys or recovery phrases in chat.

```dotenv
CRYPTO_CUSTODIAN=binance
BINANCE_READ_API_KEY=
BINANCE_READ_API_SECRET=
```

Use read-only API credentials for the Binance account that owns the receiving addresses. Do not enable withdrawals or trading. The code only issues signed GET requests to Binance deposit-information endpoints. Account, regional and network availability restrictions must be respected. Missing credentials disable Binance checkout options.

Your supplied public addresses are defaults in `lib/billing/reliable/receivers.ts`:

| Network | Receiving address |
|---|---|
| BEP20 / ERC20 | 0x6f485b8ea54a631a6c64bc59874e8d97d09fc617 |
| TRC20 | TVC37hU5M9SoQ4EuJheTDoVvWYb1wNSBsz |
| SOL | 3MukfZCXgwcDQtmNNeUdpkUnywfdBcEuiL6Xp4jwxc4d |

Checkout verifies each specific asset/network/contract/address with the connected Binance account before creating an invoice. A configured pair is not guaranteed available simply because an address exists. BTC on BEP20/ERC20 is tokenized/wrapped BTC, not native Bitcoin.

For every enabled pair configure:

| Variable | Meaning |
|---|---|
| CRYPTO_RPC_NETWORK | Trusted HTTPS mainnet RPC endpoint |
| CRYPTO_TOKEN_ASSET_NETWORK | Exact accepted token contract or mint |
| CRYPTO_DECIMALS_ASSET_NETWORK | Token decimals, checked independently on chain |
| CRYPTO_WALLETS_ASSET_NETWORK | Optional JSON array overriding the supplied public receiving addresses |

Supported pairs: USDT_BEP20, USDT_TRC20, USDT_ERC20, USDT_SOL; USDC_BEP20, USDC_ERC20, USDC_SOL; BTC_BEP20, BTC_ERC20.

For Solana/TRON also configure CRYPTO_GENESIS_SOL / CRYPTO_GENESIS_TRC20 using independently checked mainnet genesis hashes. EVM is checked against chain ID 1 (Ethereum) or 56 (BNB Smart Chain). RPC must support log discovery, canonical receipts, token decimals and finalized blocks. TRON must support account token history and wallet/walletsolidity APIs. Solana requires transaction history.

Wrapped BTC quotes require TATUM_API_KEY. USDT/USDC use the disclosed reference of 1 token per USD. Quotes are locked at invoice creation and compared with exact decimal arithmetic. Annual prices come from ap_plans.annual_price_usd; annual options without a positive price remain disabled.

## 4. Configure invoice details and email

Configure BILLING_SELLER_NAME, BILLING_SELLER_ADDRESS, BILLING_SUPPORT_EMAIL and BILLING_SELLER_TAX_ID with your actual business information. Seller/customer snapshots are retained per invoice.

```dotenv
RESEND_API_KEY=
PAYMENT_EMAIL_FROM=Avera Prive Billing <billing@YOUR_VERIFIED_DOMAIN>
PAYMENT_ADMIN_EMAILS=YOUR_ADMIN_EMAIL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Verify your transactional sender/domain with Resend. Replace the public site URL with your actual HTTPS domain in production. Paid customer PDFs are queued only after confirmed payment; admin notices include verification details and shared matching candidates. Email failures retry without undoing a payment. Check delivery logs and Gmail spam during acceptance testing.

The premium renderer is used for invoice downloads and paid email attachments. Package public/assets/invoice (monogram.jpg, fonts, font-metrics.json and FONT-LICENSE.txt) with the application. Supported Latin text uses embedded fonts; unsupported scripts retain original accessible text and display Unicode code labels. The invoice web page displays original text directly.

## 5. Run the monitor

Generate a random server-only secret:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set CRYPTO_MONITOR_SECRET to that value in .env.local. Restart the website:

```powershell
npm run dev
```

In a SECOND PowerShell terminal, from the project folder, keep this running:

```powershell
node --env-file=.env.local scripts/crypto-monitor.mjs
```

Closing that terminal stops local automatic monitoring. Modern Node supporting --env-file is required.

Production needs a persistent worker/scheduler invoking GET or POST `/api/internal/crypto-monitor` with `Authorization: Bearer YOUR_CRYPTO_MONITOR_SECRET`. Run every 30–60 seconds with adequate runtime (route maxDuration is 300 seconds; hosting must support it).

Each request claims at most 12 invoices and checks four concurrently. Database leases prevent duplicate processing. Identical read-only blockchain/Binance lookups are reused within a batch. Requests and histories are bounded; outages or incomplete histories fail closed. Monitor queue age, RPC limits, Binance rate limits, overdue invoices, failed emails and worker errors. This is not an unlimited-throughput or production load-test guarantee; higher traffic needs worker/infrastructure tuning and reliable automatic payer identification.

## 6. Owner review and customer pages

Agency → Billing → Checkout generates a separate invoice even if another customer selected the same asset/network/address. The payment page shows exact instructions, expiry, QR, IDs, automatic refresh and an optional TXID hint. "Payment matching — review required" means the transaction referenced by this invoice needs attribution review. An unpaid customer is not marked as detected merely because someone else paid the shared address. Deposits without an invoice hint remain in the owner matching queue; the customer invoice can stay awaiting verified payment matching. Customers who already sent a payment should contact support before sending again.

Owner → Subscriptions → Crypto payments and exceptions shows:

- Payment records and their current states.
- Deposits needing invoice matching, independent evidence and candidate payment IDs.
- Financial exceptions and review notes.
- Pending email notifications.

Before assigning an ambiguous deposit, verify agency identity and independent payer records, such as a withdrawal record tied to the authenticated customer. A screenshot or a copied public TXID alone is insufficient. Record what was checked; choose or paste the candidate invoice payment ID. Only owner/finance staff can save an assignment. It is audited and immutable; the same TXID cannot be assigned to another invoice. The worker then performs fresh verification. An assignment itself does not activate a plan or refund money. Wrong token/network deposits cannot be forced into success using this screen.

Historical possible invoices remain in matching decisions. The owner list shows the latest 100 payment records and 100 review deposits; candidate payment IDs can be pasted if an older invoice is outside the visible records. Large queues need operational review/pagination improvements before high-volume rollout.

Billing → Invoices retains open/paid/overdue records, invoice details and authenticated PDF downloads.

## 7. Verification before customer launch

```powershell
npm run typecheck
npx vitest run tests/reliable-payments.test.ts tests/shared-monitor.test.ts tests/reliable-chain.test.ts tests/payment-notifications.test.ts tests/payment-monitor-auth.test.ts tests/binance-credit.test.ts
npm run build
```

If test packages are missing, install `vitest` and `@electric-sql/pglite` as development dependencies. The installer preserves any existing custom Vitest configuration; it must resolve @ to the project root.

Focused checks use an isolated PostgreSQL-compatible test database and mocked blockchain/Binance/email services. They cover repeated address use, multiple agency invoices, matching ambiguity, customer hints, duplicate transaction claims, audited assignments, chain finality, exact amounts, late payment, annual billing, authorization, idempotent activation and email retry. PGlite fixture concurrency is not a real multi-connection production stress test.

No real Binance account, payment or email delivery has been verified in this workspace. Connect your local credentials, generate a test invoice, review the actual contract/network/address, send a controlled payment, verify matching and activation, and check the email and saved PDF before accepting customer funds. Existing unrelated repository-wide lint/slug-test issues remain outside these focused checks.

## Rollback

The installer prints its backup folder and saves a manifest. Restore backed-up files and remove only files marked new to revert code. Do not delete payment records or rerun older migrations to undo database changes; they would restore obsolete activation/matching functions. Review a database rollback against real payments with a database administrator.

Official documentation: https://developers.binance.com/en/docs/catalog/core-trading-wallet/api/rest-api/capital ; https://ethereum.org/developers/docs/apis/json-rpc/ ; https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/bsc-api-list/ ; https://solana.com/docs/rpc/http/gettransaction ; https://developers.tron.network/docs/confirmation-semantics ; https://resend.com/docs/api-reference/emails/send-email

Validation completed: 76 focused tests passed; TypeScript, lint checks on changed code and production build passed. Live payment acceptance and high-volume production testing remain unperformed.
