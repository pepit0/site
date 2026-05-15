-- Sell your ride: storage bucket + policies (marketing Supabase).
-- Run after 06_sell_ride_submissions.sql. Create bucket in Dashboard if INSERT is not allowed.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sell-ride-photos',
  'sell-ride-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sell_ride_photos_public_read" on storage.objects;
drop policy if exists "sell_ride_photos_anon_insert" on storage.objects;
drop policy if exists "sell_ride_photos_anon_delete" on storage.objects;
drop policy if exists "sell_ride_photos_admin_insert" on storage.objects;
drop policy if exists "sell_ride_photos_admin_update" on storage.objects;
drop policy if exists "sell_ride_photos_admin_delete" on storage.objects;

create policy "sell_ride_photos_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'sell-ride-photos');

-- Anon may upload only into a draft submission folder (first path segment = submission id).
create policy "sell_ride_photos_anon_insert"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'sell-ride-photos'
  and name like '%/%'
  and exists (
    select 1
    from public.sell_ride_submissions s
    where
      s.id::text = split_part(name, '/', 1)
      and s.status = 'draft'
      and s.created_at > now() - interval '24 hours'
  )
);

-- Allow removing mistaken uploads while still in draft.
create policy "sell_ride_photos_anon_delete"
on storage.objects
for delete
to anon
using (
  bucket_id = 'sell-ride-photos'
  and exists (
    select 1
    from public.sell_ride_submissions s
    where
      s.id::text = split_part(name, '/', 1)
      and s.status = 'draft'
      and s.created_at > now() - interval '24 hours'
  )
);

create policy "sell_ride_photos_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'sell-ride-photos'
  and public.user_can_manage_inventory ()
);

create policy "sell_ride_photos_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'sell-ride-photos'
  and public.user_can_manage_inventory ()
)
with check (
  bucket_id = 'sell-ride-photos'
  and public.user_can_manage_inventory ()
);

create policy "sell_ride_photos_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'sell-ride-photos'
  and public.user_can_manage_inventory ()
);
