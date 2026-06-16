import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BLOG_IMAGES_BUCKET,
  slugifyBlogTitle,
  type BlogPostRow
} from "./blogPostsApi";
import { buildExcerptFromHtml, htmlToParagraphs, isBlogBodyHtmlEmpty, sanitizeBlogHtml } from "./blogBodyHtml";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

export async function uploadBlogThumbnail(
  client: SupabaseClient,
  file: File
): Promise<{ path: string } | { error: string }> {
  const path = `${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const { error } = await client.storage.from(BLOG_IMAGES_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (error) return { error: error.message };
  return { path };
}

async function slugIsAvailable(client: SupabaseClient, slug: string): Promise<boolean> {
  const { data, error } = await client.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
  if (error) return false;
  return data == null;
}

export async function buildUniqueBlogSlug(client: SupabaseClient, title: string): Promise<string> {
  const base = slugifyBlogTitle(title);
  if (await slugIsAvailable(client, base)) return base;

  for (let i = 2; i < 100; i += 1) {
    const candidate = `${base}-${i}`;
    if (await slugIsAvailable(client, candidate)) return candidate;
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export type CreateBlogPostInput = {
  title: string;
  publishedAt: string;
  bodyHtml: string;
  thumbnailFile: File;
  thumbnailAlt: string;
  createdBy: string | undefined;
};

export async function createBlogPost(
  client: SupabaseClient,
  input: CreateBlogPostInput
): Promise<{ row: BlogPostRow } | { error: string }> {
  const title = input.title.trim();
  if (!title) return { error: "Enter a title." };

  const bodyHtml = sanitizeBlogHtml(input.bodyHtml);
  if (isBlogBodyHtmlEmpty(bodyHtml)) return { error: "Enter at least one paragraph in the body." };

  const paragraphs = htmlToParagraphs(bodyHtml);
  if (paragraphs.length === 0) return { error: "Enter at least one paragraph in the body." };

  const publishedAt = input.publishedAt.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
    return { error: "Choose a valid publish date." };
  }

  const upload = await uploadBlogThumbnail(client, input.thumbnailFile);
  if ("error" in upload) return { error: upload.error };

  const slug = await buildUniqueBlogSlug(client, title);
  const excerpt = buildExcerptFromHtml(bodyHtml);
  const seoDescription = buildExcerptFromHtml(bodyHtml, 320);

  const { data, error } = await client
    .from("blog_posts")
    .insert({
      slug,
      title,
      seo_description: seoDescription,
      excerpt,
      body_paragraphs: paragraphs,
      body_html: bodyHtml,
      thumbnail_path: upload.path,
      thumbnail_alt: input.thumbnailAlt.trim() || title,
      published_at: publishedAt,
      created_by: input.createdBy ?? null
    })
    .select("*")
    .single();

  if (error) {
    await client.storage.from(BLOG_IMAGES_BUCKET).remove([upload.path]);
    return { error: error.message };
  }

  return { row: data as BlogPostRow };
}

export async function fetchAdminBlogPosts(client: SupabaseClient): Promise<{ rows: BlogPostRow[] } | { error: string }> {
  const { data, error } = await client
    .from("blog_posts")
    .select("*")
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };
  return { rows: (data ?? []) as BlogPostRow[] };
}
