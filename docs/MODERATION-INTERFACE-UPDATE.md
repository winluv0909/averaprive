# Avera Privé moderation interface update

This update adds the authenticated profile-moderation interface. Migration `202609230003_profile_workflow.sql` must already be installed.

## Replace these existing files

- `app/dashboard/page.tsx`
- `app/dashboard/agencies/[agencyId]/page.tsx`
- `app/globals.css`
- `lib/auth/authorization.ts`

## Add these new files

- `app/dashboard/moderation/actions.ts`
- `app/dashboard/moderation/page.tsx`
- `app/dashboard/moderation/[agencyId]/page.tsx`

## Do not replace

- `.env.local`
- Existing Supabase migration files
- The separate static Avera Privé website

## Test route

After merging the files and restarting the development server, open:

`http://localhost:3000/dashboard`

The signed-in `super_admin` should see **Open moderation queue**.

## Trust safeguards

- Only `super_admin` and `moderator` roles can open the moderation routes.
- Moderation decisions call the secured database RPC and create audit records.
- Approval does not publish the profile.
- Publication requires a separate staff action.
- Approval and publication do not grant verification.
- Submitted profiles display a locked, read-only owner view.
