# Profile workflow update

## Install safely

1. Keep `.env.local`; never overwrite or share it.
2. Merge the update archive into the existing `agency-prive-platform` folder.
3. Run `supabase/migrations/202609230003_profile_workflow.sql` in the test Supabase project.
4. Restart the local server with `npm run dev`.
5. Log in and confirm the dashboard shows `Platform role: super_admin`.

## Security behavior

- New agency records begin as private drafts.
- Draft creation atomically makes the authenticated creator the owner.
- Editors can edit but cannot submit.
- Owners and administrators can submit.
- Only moderators and super administrators can make moderation decisions or publish.
- Approval does not publish automatically.
- Publishing does not create verification, ranking, or sponsorship.
- Public directory views continue to show only approved and published records.
