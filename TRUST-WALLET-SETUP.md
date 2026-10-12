# Avera Privé — Trust Wallet crypto checkout

This update adds seven crypto channels alongside PayPal. It retains the premium invoice and PDF design. No wallet private key or recovery phrase is needed. No Binance account/API is used by the new checkout or worker. Historical payment records and source files remain archived.

## 1. Install the code

Download Avera-Prive-Trust-Wallet-Checkout.ps1 into `C:\Users\winlu\Avera Privé`, beside package.json. Stop the development server with Ctrl+C. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\Avera-Prive-Trust-Wallet-Checkout.ps1
```

The installer checks files before changing them, backs up affected files beside your project, and refuses unexpected versions. It does not read or edit .env.local, delete pages, install packages, or connect to Supabase. If it reports a different local version, send that error rather than forcing an overwrite.

## 2. Apply one migration

In Supabase → SQL Editor → New query, paste the complete contents of:

`supabase/migrations/202610120025_trust_wallet_checkout.sql`

Run it once. “Success. No rows returned” is expected. Migrations 017, 021, 022, 023 and 024 must already exist; you previously applied those. Old migrations are retained for schema history, not restarted as Binance integrations.

## 3. Add server configuration

Open the installed `trust-wallet.env.example`. Copy the new entries into your existing .env.local. Keep PayPal and Supabase credentials unchanged. Do not paste keys in chat.

For Ethereum, BNB Smart Chain, Arbitrum One and Base, obtain mainnet HTTPS JSON-RPC endpoints from your infrastructure provider. Its plan must support `eth_getLogs`, token `eth_call`, historical transaction receipts/block lookups, and the `finalized` block tag. Paste the URL into the matching WALLET_RPC variable. Each channel remains disabled until its configuration is present; checkout also verifies the actual chain and token decimals before issuing an invoice.

For Tron, create a TronGrid API key at https://www.trongrid.io/ and put it in TRONGRID_API_KEY. The endpoint must support the HTTP `/wallet`, `/walletsolidity` and `/v1/accounts/.../transactions/trc20` APIs. Its genesis is pinned to mainnet in code.

For Bitcoin, the example includes two separate public Esplora endpoints. Both must agree on transaction outputs and canonical block inclusion. Obtain appropriately provisioned independent services or self-hosted indexers before substantial traffic. If either is unavailable or disagrees, Bitcoin payments remain unconfirmed.

For BTC prices, add TATUM_API_KEY from your Tatum dashboard, with access to the rates API. Tatum supplies prices only. No wallet custody, signing or withdrawals are requested.

Generate the monitor secret locally in PowerShell:

```powershell
$walletRandomBytes = New-Object byte[] 32
$walletRandomGenerator = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
$walletRandomGenerator.GetBytes($walletRandomBytes)
[Convert]::ToBase64String($walletRandomBytes)
$walletRandomGenerator.Dispose()
```

Copy the resulting value into CRYPTO_MONITOR_SECRET. Keep it private.

Invoice emails use the existing Resend queue. Configure RESEND_API_KEY, a verified PAYMENT_EMAIL_FROM, and PAYMENT_ADMIN_EMAILS. Missing email settings do not falsely undo a confirmed payment; notices stay queued for retry. Receiving wallet addresses are already embedded in the code and migration exactly as supplied.

## 4. Start the website and worker

After configuring everything, set `WALLET_CRYPTO_ENABLED=true`. This enables REAL MAINNET crypto, even if PayPal is still in Sandbox mode.

Restart your website:

```powershell
npm run dev
```

In a second VS Code terminal in the same project, run:

```powershell
node --env-file=.env.local scripts/crypto-monitor.mjs
```

Keep both terminals running during local testing. Loading an invoice page or entering a TXID alone does not run blockchain verification. The worker makes authenticated calls to `/api/internal/crypto-monitor`.

Production requires an always-running server-side worker or scheduler calling that endpoint with `Authorization: Bearer YOUR_MONITOR_SECRET`. Hosting must permit a Node route up to 300 seconds. Do not expose the secret in frontend code. The worker batches four invoices and fails closed when API/history limits are reached. This bounded implementation is not load-tested for large transaction volumes; scale workers/indexing infrastructure before high-volume use.

## 5. Review the checkout

Agency Dashboard → Billing → choose plan → fill company information → select monthly/annual → Cryptocurrency → coin/network → Generate crypto payment invoice.

The invoice shows exact amount, network, token contract (BTC for native Bitcoin), receiving address, QR, expiry, invoice ID, payment ID and matching adjustment. The QR contains the receiving ADDRESS, so the sender must also select the correct network/token and enter the full exact amount. Never use it as an Ethereum payment QR for Tron/Bitcoin.

The displayed USD plan price comes from the database. USDT/USDC use a stated 1 USD stablecoin reference, not a live market conversion. BTC uses a fresh rate and an eight-decimal upward-rounded base amount.

To distinguish simultaneous invoices at shared addresses, checkout reserves a distinct exact amount permanently. It adds at most 0.009999 USDT/USDC, or 0.00000999 BTC, to the base quote. That adjustment is displayed before payment and stored in the invoice/PDF; sender/network fees are additional. For example, two $49 USDT invoices can request 49.000000 and 49.000001 USDT. The first available amount may be higher if earlier invoices already reserved those values. If a sender cannot enter that precision, use PayPal rather than rounding. Finite allocation windows intentionally fail closed when exhausted (10,000 stablecoin amounts or 1,000 BTC amounts per overlapping base range); rotate the receiving address via a new reviewed configuration/migration when necessary. Old amounts are never reused so late deposits cannot activate new invoices.

Native USDC contracts are accepted on Ethereum, Arbitrum One and Base. USDC.e or other bridged representations are not accepted. BNB Smart Chain USDT uses the specified BEP20 pegged-token contract; it does not require a Binance exchange account.

## 6. Test payment behavior

Automated tests cover SQL creation and matching, retry safety, blockchain evidence, Bitcoin disagreement/reorgs, finality, exceptions, worker authorization and PayPal regressions. Run:

```powershell
npx vitest run tests/wallet-chain.test.ts tests/wallet-database.test.ts tests/wallet-monitor.test.ts tests/payment-monitor-auth.test.ts tests/paypal-domain.test.ts tests/paypal-service.test.ts tests/paypal-database.test.ts tests/paypal-invoice.test.ts tests/payment-notifications.test.ts
npm run build
```

These tests use mocks/local database fixtures and never move real funds. No live crypto transfer or real email was performed when preparing this update. A full operational check must confirm your own endpoint credentials, scheduler and email sender.

For a real payment, use only an invoice you intentionally want to pay. Send the complete exact amount in ONE transaction on the selected network, with sender fees paid separately. Do not send to expired invoices, and do not send another payment while an earlier transaction is being confirmed/reviewed.

Expected progression: Awaiting Payment → Payment Detected → Confirming → Payment Confirmed. Some networks may move directly to Confirming on first observation of an included transaction. Ethereum and BNB require at least 12 confirmations plus the provider's finalized block status; Tron requires at least 20 confirmations plus solidity-confirmed inclusion. Arbitrum/Base require the finalized block tag (parent-chain data finality), beyond a sequencer broadcast. Bitcoin requires agreement between two sources and six canonical-chain confirmations; Bitcoin finality is probabilistic, not absolute.

After confirmation: subscription access activates atomically, one month/year is purchased (no recurring debit), the invoice becomes paid, and customer/admin notices enter the retryable email queue. The PDF stays under Billing → Invoices.

## Exceptions

TXIDs are lookup hints only. Exact token/network/destination/amount and confirmation evidence select the payment; a customer hash cannot choose the winner. Duplicate hashes cannot activate another invoice. Incorrect, underpaid, overpaid, late or ambiguous deposits remain exceptions for finance support. Wrong-network EVM hashes can be looked up on the other configured supported EVM networks, but that evidence never approves the selected-network invoice. Payments on unsupported networks cannot be automatically found.

Incorrect-amount deposits with no unambiguous invoice are placed in the shared deposit review queue; an optional customer hash can help categorize that customer's support case without assigning ownership or activating access. Staff can inspect Owner Dashboard → Payments, record review notes and resolve refunds/support outside automatic activation. This update does not implement automatic refunds or let staff bypass exact-payment/finality checks. Expired invoices remain monitored for late payments while pending, and their distinct amounts remain reserved. Unrelated old invoices are not scanned by this worker.

## Sources used for contracts and adapters

- https://developers.circle.com/stablecoins/usdc-contract-addresses
- https://tether.to/en/supported-protocols/
- https://developers.tron.network/docs/get-trc20-transaction-history
- https://explorer.bnbchain.org/asset/USDT-6D8
- https://github.com/tronprotocol/tips/blob/master/tip-474.md
- https://github.com/Blockstream/esplora/blob/master/API.md
- https://docs.arbitrum.io/how-arbitrum-works/deep-dives/finality
