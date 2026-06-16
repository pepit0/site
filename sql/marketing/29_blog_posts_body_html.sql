-- Rich HTML blog bodies (from PDF import or manual formatting).
-- Run after 28_blog_posts.sql. Role: postgres.

alter table public.blog_posts
add column if not exists body_html text;

drop view if exists public.blog_posts_public;

create view public.blog_posts_public as
select
  id,
  slug,
  title,
  seo_description,
  excerpt,
  body_paragraphs,
  body_html,
  thumbnail_path,
  thumbnail_alt,
  published_at,
  created_at,
  updated_at
from public.blog_posts
where published_at <= current_date;

alter view public.blog_posts_public set (security_invoker = false);

grant select on public.blog_posts_public to anon, authenticated;
