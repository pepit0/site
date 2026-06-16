import type { SupabaseClient } from "@supabase/supabase-js";
import { BLOG_POSTS, type BlogPost } from "../data/blogPosts";

export const BLOG_IMAGES_BUCKET = "blog-images";

export type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  seo_description: string;
  excerpt: string;
  body_paragraphs: string[];
  body_html: string | null;
  thumbnail_path: string | null;
  thumbnail_alt: string;
  published_at: string;
  created_at: string;
  updated_at: string;
};

export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isBlogPostPublished(publishedAt: string): boolean {
  return publishedAt.slice(0, 10) <= todayIsoDate();
}

export function slugifyBlogTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "post";
}

export function parseBodyParagraphs(raw: string): string[] {
  return raw
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function buildBlogExcerpt(firstParagraph: string, max = 160): string {
  const text = firstParagraph.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function blogPhotoPublicUrl(client: SupabaseClient, path: string): string {
  const { data } = client.storage.from(BLOG_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function mapBlogPostRow(client: SupabaseClient, row: BlogPostRow): BlogPost {
  return {
    slug: row.slug,
    title: row.title,
    seoDescription: row.seo_description,
    publishedAt: row.published_at.slice(0, 10),
    thumbnail: row.thumbnail_path ? blogPhotoPublicUrl(client, row.thumbnail_path) : "",
    thumbnailAlt: row.thumbnail_alt || row.title,
    excerpt: row.excerpt,
    body: row.body_paragraphs,
    bodyHtml: row.body_html ?? undefined
  };
}

function mergeBlogPosts(dbPosts: BlogPost[], staticPosts: BlogPost[]): BlogPost[] {
  const bySlug = new Map<string, BlogPost>();
  for (const post of staticPosts) {
    if (isBlogPostPublished(post.publishedAt)) {
      bySlug.set(post.slug, post);
    }
  }
  for (const post of dbPosts) {
    bySlug.set(post.slug, post);
  }
  return [...bySlug.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function fetchPublicBlogPosts(client: SupabaseClient): Promise<BlogPost[]> {
  const { data, error } = await client
    .from("blog_posts_public")
    .select("*")
    .order("published_at", { ascending: false });

  if (error) {
    return mergeBlogPosts([], BLOG_POSTS);
  }

  const dbPosts = (data ?? [])
    .map((row) => mapBlogPostRow(client, row as BlogPostRow))
    .filter((post) => post.thumbnail.length > 0);

  return mergeBlogPosts(dbPosts, BLOG_POSTS);
}

export async function fetchPublicBlogPostBySlug(
  client: SupabaseClient,
  slug: string | undefined
): Promise<BlogPost | undefined> {
  if (!slug) return undefined;

  const { data, error } = await client.from("blog_posts_public").select("*").eq("slug", slug).maybeSingle();

  if (!error && data) {
    const post = mapBlogPostRow(client, data as BlogPostRow);
    if (post.thumbnail) return post;
  }

  const staticPost = BLOG_POSTS.find((post) => post.slug === slug);
  if (staticPost && isBlogPostPublished(staticPost.publishedAt)) {
    return staticPost;
  }

  return undefined;
}

export function blogPostsNewestFirstStatic(): BlogPost[] {
  return [...BLOG_POSTS]
    .filter((post) => isBlogPostPublished(post.publishedAt))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getBlogPostBySlugStatic(slug: string | undefined): BlogPost | undefined {
  if (!slug) return undefined;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post || !isBlogPostPublished(post.publishedAt)) return undefined;
  return post;
}
