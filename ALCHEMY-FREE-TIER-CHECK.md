# Alchemy free-tier update and connection check

Keep WALLET_CRYPTO_ENABLED=false during these checks.

1. Put Avera-Prive-Alchemy-Free-Tier-Fix.ps1 beside package.json, stop the development server, and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\Avera-Prive-Alchemy-Free-Tier-Fix.ps1
```

2. With your saved server settings in .env.local, run:

```powershell
node --env-file=.env.local scripts/check-wallet-connections.mjs
```

The checker makes read-only blockchain and price requests. It does not write to Supabase, generate payment invoices, send crypto, sign transactions, print credentials, or change the crypto enable setting. Price requests consume the provider's normal API allowance. You can share its PASS/FAIL output without including your .env.local file or keys.

Expected checks: Ethereum, BNB Smart Chain, Arbitrum One, Base, Tron/USDT, two Bitcoin mainnet sources, a fresh Tatum BTC/USD quote, and the monitor secret. A PASS does not yet test a real transfer, invoice matching, email delivery or a running monitor. If any check fails, keep payments disabled and resolve it first.

The monitor now splits log queries into at most ten-block batches, rescans the confirmation overlap, makes forward progress even when that overlap exceeds a single batch, and retains the old cursor when any batch fails. Backlog scans are limited to 200 blocks per invoice per run. API quotas still apply; the free plan is not unlimited.

This patch changes the wallet chain adapter and adds a checker, a focused regression test and this guide. PayPal, SQL migrations, wallet addresses, invoice design and .env.local are not changed. A backup is made before writing files, and unexpected existing versions are refused.

Validated with 16 focused tests, changed-file lint, TypeScript, and Node syntax checks. The Windows PowerShell installer has not been executed here. No live credential connections or payments were tested here.
