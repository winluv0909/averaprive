# Launch checklist

- Apply all database migrations in order and create the first `super_admin`.
- Configure Supabase Site URL, callback URLs, SMTP, CAPTCHA, and email templates.
- Set all Vercel environment variables from `.env.example`.
- Replace placeholder support email, social URLs, and Trustpilot URL.
- Commission legal review for Privacy, Terms, Cookies, Acceptable Use, review policy, and moderation policy.
- Connect Stripe checkout, customer portal, and signed webhooks before taking payments. The current plan workflow is operational readiness, not live card processing.
- Upload only agency records that have source provenance and passed moderation.
- Set `NEXT_PUBLIC_SHOW_DEMO_AGENCIES=false` unless the public launch should retain clearly disclosed sample profiles.
- Configure backups, log retention, rate limiting, error monitoring, and incident contacts.
- Run `npm run verify` and complete role-based acceptance tests for public, agency, moderator, verification reviewer, support, finance, and super-admin accounts.
