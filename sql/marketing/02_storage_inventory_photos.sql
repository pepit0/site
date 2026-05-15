-- Public bucket for catalog images; writes restricted to inventory admins.
-- Run after 01_inventory_units.sql. Create bucket in Dashboard if INSERT here is not allowed — then only run policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inventory-photos',
  'inventory-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "inventory_photos_public_read" on storage.objects;
drop policy if exists "inventory_photos_admin_insert" on storage.objects;
drop policy if exists "inventory_photos_admin_update" on storage.objects;
drop policy if exists "inventory_photos_admin_delete" on storage.objects;

-- Anyone can read objects in this bucket (public catalog).
create policy "inventory_photos_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'inventory-photos');

-- Authenticated inventory admins can upload/update/delete
create policy "inventory_photos_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'inventory-photos'
  and public.user_can_manage_inventory ()
);

create policy "inventory_photos_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'inventory-photos'
  and public.user_can_manage_inventory ()
)
with check (
  bucket_id = 'inventory-photos'
  and public.user_can_manage_inventory ()
);

create policy "inventory_photos_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'inventory-photos'
  and public.user_can_manage_inventory ()
);
