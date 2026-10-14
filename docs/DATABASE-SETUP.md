# Database setup

## Existing Avera Privé project

Keep the existing Supabase project and its data.

1. Compare the repository migration files with the database's applied history.
2. Account for migrations previously run manually in SQL Editor.
3. Review and apply only missing migrations, in filename order.
4. Stop on an error and inspect it before continuing.
5. Record the filename, target project, result, and application date.

A SQL file committed to Git is not proof it was applied to Supabase.
Vercel deployment does not prove database migrations were applied.

## Fresh environments

For a deliberately new, empty environment, apply the complete ordered chain
listed in DATABASE-MIGRATION-ORDER.md. Do not use these fresh-environment
instructions to reset the existing production project.

## Owner access

Preserve existing owner accounts and staff-role assignments.
Bootstrap an initial owner only in an environment that needs one, using
the reviewed identity-role migration instructions and the intended
confirmed authentication account.

Never grant platform staff roles to ordinary agency users.
Keep service-role credentials server-side.

## Authentication configuration

Configure the intended HTTPS Site URL and the callback URLs actually used
by the application. Confirm each authentication flow before domain cutover.
Review SMTP, email templates, CAPTCHA, and delivery separately.

## Production data

The two historical demo migrations retain schema and protection logic,
but their fictional agency and rating inserts have been removed.

Do not reintroduce fabricated agencies, ratings, or Trustpilot identities.
Existing database records require separate inspection; editing migration
files does not remove records already stored.

## Security confirmation

Verify access rules with separate authorized and unauthorized accounts.
Review database advisor findings and confirm private records remain private.
Migration presence alone is not evidence that these checks passed.