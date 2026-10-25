# Step 05 — Password recovery

## Installation
Copy this package into the existing project root, merging folders and replacing matching files. Keep this guide in the root. Run npm run verify. No npm ci or SQL is needed.

The Forgot your password link is available on agency login and owner/staff login. Both use /forgot-password, /auth/recovery and /reset-password. Recovery does not run agency onboarding or change roles.

## Supabase dashboard configuration — required before live testing
Authentication → URL Configuration: keep Site URL set to https://averaprive.vercel.app. Add https://averaprive.vercel.app/auth/recovery to Redirect URLs and save. NEXT_PUBLIC_SITE_URL in Vercel must be https://averaprive.vercel.app. Do not change the production Site URL to localhost.

Authentication → Email Templates → Reset Password: preserve the current template branding. Its reset link must target the dedicated recovery endpoint. Use the following link in this template only:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery">Reset your password</a>
```

Do not change the signup confirmation template. Never share an actual recovery link or token. The token-hash template supports opening the email on another browser. The default ConfirmationURL template instead uses PKCE and normally requires opening the link in the browser that requested it.

Check Authentication email/SMTP configuration. Invoice emails sent through Resend do not establish that Supabase Auth emails are configured. Delivery, rate limits and provider credentials require a live email test.

## Deploy
Stage only this update's files, inspect the diff, commit and push. The /auth/recovery endpoint must be deployed before sending the new template links. Configure the dashboard after deployment and before testing. No database migration is needed.

## Live check
Use an account whose inbox you control. Request a reset from the deployed login, confirm the email arrives, open its link, enter matching passwords of 12–128 characters, and sign in through the correct portal with the new password. Record the result without sharing credentials or links. This intentionally changes that account's password and signs it out across sessions. Existing access JWTs can remain valid until expiry; global sign-out revokes refresh sessions.

A neutral email-request message prevents account enumeration; it is not proof an email was delivered. Invalid or expired links return to the request page. Password policy/re-authentication failures keep the password form available with an error.

Owner temporary-password setup flags and portal roles remain unchanged. If an owner is required to change an initial password, the existing account setup screen can still appear after recovery.

## Checks
Automated checks cover email validation, the fixed recovery destination, neutral request responses, authentication enforcement, password confirmation, failed updates and sign-out after reset. Full email delivery and browser/mobile appearance need verification after installation.
