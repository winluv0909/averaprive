-- AP Security 08 — Restrict Editorial Media Listing
begin;

drop policy if exists editorial_media_public_read
on storage.objects;

drop policy if exists editorial_media_staff_read
on storage.objects;

create policy editorial_media_staff_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'editorial-media'
  and (select ap_private.is_staff(array['super_admin','moderator']))
);

commit;