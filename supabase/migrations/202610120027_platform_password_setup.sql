begin;

-- Only administrator-controlled app metadata determines password setup status.
create or replace function ap_private.require_platform_password_setup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.ap_staff_roles where user_id = new.user_id and id <> new.id) then
    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('platform_password_change_required', true)
    where id = new.user_id;
  end if;
  return new;
end;
$$;
revoke all on function ap_private.require_platform_password_setup() from public, anon, authenticated;
drop trigger if exists ap_platform_password_setup on public.ap_staff_roles;
create trigger ap_platform_password_setup after insert on public.ap_staff_roles
for each row execute function ap_private.require_platform_password_setup();

create or replace function ap_private.complete_platform_password_setup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password
     and coalesce(new.encrypted_password, '') <> ''
     and old.raw_app_meta_data ->> 'platform_password_change_required' = 'true' then
    new.raw_app_meta_data = coalesce(new.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('platform_password_change_required', false);
  end if;
  return new;
end;
$$;
revoke all on function ap_private.complete_platform_password_setup() from public, anon, authenticated;
drop trigger if exists ap_platform_password_changed on auth.users;
create trigger ap_platform_password_changed before update of encrypted_password on auth.users
for each row execute function ap_private.complete_platform_password_setup();

-- Existing platform accounts also complete setup once. User metadata cannot bypass it.
update auth.users u set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('platform_password_change_required', true)
where exists (select 1 from public.ap_staff_roles r where r.user_id = u.id);

create or replace function ap_private.is_staff(required_roles text[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ap_staff_roles r join auth.users u on u.id = r.user_id
    where r.user_id = auth.uid()
      and coalesce(u.raw_app_meta_data ->> 'platform_password_change_required', 'false') <> 'true'
      and (required_roles is null or r.role = any(required_roles))
  );
$$;
revoke all on function ap_private.is_staff(text[]) from public;
grant execute on function ap_private.is_staff(text[]) to authenticated;
commit;
