# Production backup and restore acceptance

A fresh migration replay or PGlite archive restore is a development check. It is not a backup of Avera Privé production. The current Free organization was verified; the available connection does not expose a downloadable backup inventory or database export credentials. Do not restore over production to test recovery.

## Create an owner controlled backup

1. In the production project open Database backup settings and record exactly what is available, its timestamp, retention and restoration options. For Free projects follow the current Supabase CLI export guidance rather than assuming downloadable daily backups exist.
2. Use the project Connect panel and the official backup/restore procedure to export roles, schema and data through a trusted local client. Keep credentials in local secret storage; do not paste database URLs/passwords into chat, screenshots, Git or the website. Inspect the installed CLI help before selecting flags. Capture checksums, export time, row totals and tool versions.
3. Back up uploaded Storage objects separately, including editorial images and private evidence. A database dump includes object metadata, not file bytes. Keep private objects encrypted and private; record path, size and checksum.
4. Record Auth/provider configuration, redirect allowlists, email settings, extensions, cron definitions and secret names in an access-controlled runbook. Store secret values separately. A Git source ZIP does not capture these settings.
5. Retain an encrypted off-device copy controlled by the owners, under the final approved retention policy. Do not commit dumps, private evidence, credentials or raw Auth exports.

## Restore into a separate environment

Use an existing empty project or a local Supabase stack with compatible Postgres/extensions. Create a paid branch/project only after its actual cost is accepted. Use separate secrets and disable cron jobs, outbound email, webhooks and live payment activation BEFORE importing data. A copied scheduler must never contact the production monitor.

1. Follow the official export-specific restore order. Do not blindly run the repository migration chain against imported production objects: the live migration ledger does not record every manually applied update.
2. Restore database schema/data/roles and separately restore Storage objects with their private/public settings. Reconnect Auth and required extensions using the official procedure, never by inventing auth.users rows.
3. Compare table counts and sampled relationships, invoice/order references, role assignments, private evidence paths and checksums. Recheck RLS, grants, functions, sequences and indexes.
4. Use controlled accounts to test login, one agency membership, private evidence denial, owner/finance invoice access and support internal-note isolation. Keep payment and mail services in non-live mode during this drill.
5. Record the achieved recovery point and elapsed recovery time; both owners sign off on the result. Securely dispose of the temporary environment after the retention decision.

## Evidence from this review

A complete isolated application schema using minimal Auth/Storage stand-ins was archived and loaded into a second PGlite database. Audit counts matched, support-message RLS remained enabled and an unrelated user could not read the restored ticket. This proves the fixture archive path only; hosted Auth, Storage bytes, provider configuration and production exports remain untested.

References: https://supabase.com/docs/guides/platform/backups and https://supabase.com/docs/guides/storage/management/download-objects
