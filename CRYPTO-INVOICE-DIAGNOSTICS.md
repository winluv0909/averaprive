# Crypto invoice diagnostic patch

The current generic error does not identify whether the failure occurred in local settings, the database lookup, the plan lookup, price quoting, blockchain access, or saving the invoice. Connection-check PASS results do not exercise the Supabase invoice function.

Place Avera-Prive-Crypto-Invoice-Diagnostics.ps1 beside package.json. Stop npm run dev, run the installer, then restart npm run dev. Retry checkout using the coin and network that originally failed.

```powershell
powershell -ExecutionPolicy Bypass -File .\Avera-Prive-Crypto-Invoice-Diagnostics.ps1
npm run dev
```

Report the full new banner including its WC_ reference and the selected coin/network. The terminal also prints only the sanitized reference and a fixed explanation. No .env.local file, API keys, private keys, raw provider response, SQL input or customer details are needed.

WC_CONFIGURATION: checkout enable flag, channel or server configuration.
WC_LOOKUP_<code>: database lookup for a previously created invoice.
WC_PLAN_<code>: selected active plan lookup.
WC_QUOTE: stablecoin amount or fresh Bitcoin price quote.
WC_BLOCKCHAIN: selected network/contract snapshot check.
WC_SAVE_<code>: Supabase invoice creation or one of its validation rules.

This is a diagnostic improvement, not a claim that the underlying issue is resolved. It does not change wallet addresses, prices, verification, PayPal, SQL, .env.local or paid states. It backs up only the affected files and refuses unexpected local versions. No additional SQL needs to be run for this patch. Tests verify that safe references exclude secret URLs/API keys and preserve successful creation.
