-- Prevent client TRUNCATE grants on future postgres-created tables.
begin;

alter default privileges for role postgres in schema public
revoke truncate on tables from public, anon, authenticated;

commit;