-- Blog posts for public /blog pages + admin create flow.
-- Run after 01_inventory_units.sql. Role: postgres.

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid (),
  slug text not null,
  title text not null,
  seo_description text not null,
  excerpt text not null,
  body_paragraphs text[] not null default '{}'::text[],
  thumbnail_path text,
  thumbnail_alt text not null default '',
  published_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint blog_posts_slug_key unique (slug),
  constraint blog_posts_body_nonempty check (cardinality(body_paragraphs) >= 1)
);

create index if not exists blog_posts_published_idx
on public.blog_posts (published_at desc, created_at desc);

create or replace view public.blog_posts_public as
select
  id,
  slug,
  title,
  seo_description,
  excerpt,
  body_paragraphs,
  thumbnail_path,
  thumbnail_alt,
  published_at,
  created_at,
  updated_at
from public.blog_posts
where published_at <= current_date;

alter view public.blog_posts_public set (security_invoker = false);

grant select on public.blog_posts_public to anon, authenticated;

alter table public.blog_posts enable row level security;

drop policy if exists blog_posts_admin_all on public.blog_posts;

create policy blog_posts_admin_all on public.blog_posts
for all to authenticated
using (public.user_can_manage_inventory ())
with check (public.user_can_manage_inventory ());

grant select, insert, update, delete on public.blog_posts to authenticated;

-- Thumbnail images (public read, admin write).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-images',
  'blog-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "blog_images_public_read" on storage.objects;
drop policy if exists "blog_images_admin_insert" on storage.objects;
drop policy if exists "blog_images_admin_update" on storage.objects;
drop policy if exists "blog_images_admin_delete" on storage.objects;

create policy "blog_images_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'blog-images');

create policy "blog_images_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'blog-images'
  and public.user_can_manage_inventory ()
);

create policy "blog_images_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'blog-images'
  and public.user_can_manage_inventory ()
)
with check (
  bucket_id = 'blog-images'
  and public.user_can_manage_inventory ()
);

create policy "blog_images_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'blog-images'
  and public.user_can_manage_inventory ()
);
