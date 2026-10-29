# Email and final domain setup

The patch does not purchase a domain, change DNS, enable live payments or access your mailboxes. These steps are grouped here so they can be completed in one final session.

## Domain

1. Choose and register the domain you control. Add it to the existing Vercel project. Copy the exact DNS values shown by Vercel into Cloudflare; do not guess IP addresses. Confirm HTTPS and the preferred canonical host before enabling redirects from alternatives.
2. Set production `NEXT_PUBLIC_SITE_URL` to the bare HTTPS origin. Update `BILLING_SELLER_NAME`, `BILLING_SELLER_ADDRESS`, `BILLING_SUPPORT_EMAIL` using truthful operator details. An email address is not a postal address; do not put one into the address field.
3. Preview public metadata changes with `node scripts/set-public-origin.mjs --origin https://YOUR-DOMAIN`. When the origin is correct, repeat with `--write`, review the diff and commit. This updates the 12 static public canonicals and og:url tags. Generated robots/sitemap use the configured origin. This command does not update provider dashboards.
4. In Supabase Authentication URL Configuration, set Site URL to the new origin. Add the exact `/auth/callback`, `/auth/recovery` and any enabled review/OAuth callbacks used by your app. Retain the current Vercel origin during a tested transition; remove stale allowlist entries after migration. Do not use broad wildcard production redirects.
5. Update enabled Google/Apple provider settings where required. Update the live PayPal webhook and return/cancel configuration for this application. Verify each flow on the new domain, not only the homepage.
6. Verify live `/robots.txt`, `/sitemap.xml`, a private page's `X-Robots-Tag`, canonical tags, asset loading and HTTPS. Submit the correct sitemap to the search engine property you control; indexing is not guaranteed by a sitemap.

## Supabase Auth SMTP and application email are separate

Adding RESEND_API_KEY to Vercel powers the application's registration/payment email code. It does **not** configure Supabase Auth recovery email. Configure custom SMTP in Supabase separately.

For Resend, verify a sending domain you control and add the exact SPF/DKIM records supplied by Resend in Cloudflare. Preserve existing mail records. Do not create two independent SPF records on the same hostname; resolve the provider's instructions for a shared domain. Publish DMARC according to the mailbox/domain setup you actually use. Keep the existing Gmail address as your support inbox if desired; do not claim to own gmail.com's sending DNS.

Verified Resend SMTP settings (official documentation checked 29 October 2026):

| Setting | Value |
|---|---|
| Host | smtp.resend.com |
| Port | 465 for implicit TLS, or 587 with STARTTLS |
| Username | resend |
| Password | Your restricted Resend sending API key, entered privately |
| Sender | A sender address on your verified domain; sender name Avera Privé |

Configure these under Supabase Auth custom SMTP. Set a suitable supported rate limit, then send one controlled recovery request and inspect Supabase Auth logs plus Resend delivery status. Sending API success is not inbox delivery. Check spam and the recipient's actual mailbox.

Application environment variables: RESEND_API_KEY; REGISTRATION_EMAIL_FROM (falls back to PAYMENT_EMAIL_FROM); REGISTRATION_EMAIL_SECRET; PAYMENT_EMAIL_FROM; PAYMENT_ADMIN_EMAILS; BILLING_SUPPORT_EMAIL. Never prefix secret keys with NEXT_PUBLIC_. No new sender address is invented in this patch.

## Optional cross-browser recovery template

The current dedicated callback already supports PKCE `code` and recovery `token_hash`. After custom SMTP and the correct Supabase Site URL are set, the **Reset password** template may use this link:

```html
<a href="{{ .SiteURL }}/auth/recovery?token_hash={{ .TokenHash }}&amp;type=recovery">Reset your password</a>
```

Use it only in the reset-password template, not signup/invitation templates. The Site URL must be the correct application origin without a trailing path. This verifies a recovery token on the receiving browser, avoiding the initiating browser's PKCE verifier requirement. Validate with one controlled cross-browser recovery, an expired/reused link and both agency/staff accounts. Never share the URL or token. Email security scanners can consume single-use links; investigate provider logs if a fresh link appears used. Do not enable email-provider click tracking on auth links without checking its effect.

## Safe local configuration check

If your local variables are in `.env.local`, run:

```powershell
node --env-file=.env.local scripts/check-launch-config.mjs
```

Use your actual local environment filename if different. The script prints PASS/NEEDS REVIEW labels, not values. It checks presence and basic shape only. Production Vercel variables and Supabase SMTP still need separate checks; a local PASS does not verify them.

Sources: https://supabase.com/docs/guides/auth/auth-smtp ; https://supabase.com/docs/guides/auth/auth-email-templates ; https://resend.com/docs/send-with-smtp
