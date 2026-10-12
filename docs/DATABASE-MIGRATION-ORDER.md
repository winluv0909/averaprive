# Database migration order

This package assumes the previously supplied trust foundation has already been run in the **test Supabase project**, as confirmed by the zero-row table checks. Do not rerun unrelated ZIP files blindly.

## Now

1. Open the test project in Supabase.
2. Go to **SQL Editor → New query**.
3. Paste and run `202609220001_identity_roles.sql`.
4. Confirm success before running the next file.
5. Paste and run `202609220002_workflow_states.sql`.
6. Create a test user in **Authentication → Users** or through `/login`.
7. Confirm that user’s email.
8. Run only the commented bootstrap `insert` at the bottom of migration 001 after replacing the email.
9. Never place the service-role key in frontend JavaScript.

## Applied workflow sequence

After the foundation migrations, run workflow migrations in filename order:

1. `202609230003_profile_workflow.sql`
2. `202609230004_trust_workflows.sql`
3. `202609240005_review_dispute_operations.sql`

## Verify after migration 001

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('ap_user_profiles','ap_agency_memberships','ap_staff_roles','ap_security_audit');

select policyname, tablename, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('ap_user_profiles','ap_agency_memberships','ap_staff_roles','ap_security_audit')
order by tablename, policyname;
```

## Stop conditions

Stop and copy the exact error before continuing if Supabase reports a missing `ap_agencies` table, a duplicate constraint with a different definition, or a policy/function error. Do not keep running later migrations after an earlier failure.
