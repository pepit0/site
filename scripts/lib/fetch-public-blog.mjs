import { BLOG_PRERENDER_POSTS } from "./blog-seo.mjs";

/**
 * @param {unknown} row
 * @param {string} supabaseUrl
 */
export function parsePublicBlogRow(row, supabaseUrl) {
  if (!row || typeof row !== "object") return null;
  const r = row;
  if (typeof r.slug !== "string" || typeof r.title !== "string") return null;
  if (typeof r.seo_description !== "string" || typeof r.excerpt !== "string") return null;
  if (!Array.isArray(r.body_paragraphs) || r.body_paragraphs.length === 0) return null;
  if (typeof r.published_at !== "string") return null;
  if (typeof r.thumbnail_path !== "string" || !r.thumbnail_path) return null;

  const body = r.body_paragraphs.filter((p) => typeof p === "string");
  if (body.length === 0) return null;

  const origin = supabaseUrl.replace(/\/+$/, "");
  const thumbnailUrl = `${origin}/storage/v1/object/public/blog-images/${r.thumbnail_path}`;

  return {
    path: `/blog/${r.slug}`,
    slug: r.slug,
    title: r.title,
    description: r.seo_description,
    publishedAt: r.published_at.slice(0, 10),
    excerpt: r.excerpt,
    body,
    bodyHtml: typeof r.body_html === "string" && r.body_html.trim() ? r.body_html : null,
    thumbnailUrl
  };
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function mergeBlogPrerenderPosts(dbPosts) {
  const bySlug = new Map();
  for (const post of BLOG_PRERENDER_POSTS) {
    if (post.publishedAt <= todayIsoDate()) {
      bySlug.set(post.slug, post);
    }
  }
  for (const post of dbPosts) {
    bySlug.set(post.slug, post);
  }
  return [...bySlug.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/**
 * @param {{ supabaseUrl: string; supabaseAnonKey: string }} config
 */
export async function fetchPublicBlogPosts(config) {
  const { supabaseUrl, supabaseAnonKey } = config;
  if (!supabaseUrl || !supabaseAnonKey) {
    return { rows: mergeBlogPrerenderPosts([]), error: "missing_supabase_env" };
  }

  const baseUrl = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/blog_posts_public`;
  const url = new URL(baseUrl);
  url.searchParams.set(
    "select",
    "slug,title,seo_description,excerpt,body_paragraphs,body_html,thumbnail_path,published_at"
  );
  url.searchParams.set("order", "published_at.desc");

  const res = await fetch(url, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Accept: "application/json"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    return { rows: mergeBlogPrerenderPosts([]), error: `supabase_${res.status}: ${text.slice(0, 200)}` };
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    return { rows: mergeBlogPrerenderPosts([]), error: "invalid_response" };
  }

  const dbPosts = data.map((row) => parsePublicBlogRow(row, supabaseUrl)).filter(Boolean);
  return { rows: mergeBlogPrerenderPosts(dbPosts), error: null };
}
