import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { createBlogPost, fetchAdminBlogPosts } from "../lib/blogAdmin";
import { formatBlogDate } from "../data/blogPosts";
import {
  blogPhotoPublicUrl,
  isBlogPostPublished,
  todayIsoDate,
  type BlogPostRow
} from "../lib/blogPostsApi";
import { supabase } from "../lib/supabase";
import { Seo } from "../seo/Seo";

type BlogForm = {
  title: string;
  publishedAt: string;
  body: string;
  thumbnailAlt: string;
};

const DEFAULT_FORM: BlogForm = {
  title: "",
  publishedAt: todayIsoDate(),
  body: "",
  thumbnailAlt: ""
};

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AdminBlogPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<BlogForm>(DEFAULT_FORM);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    setLoadError(null);
    const result = await fetchAdminBlogPosts(supabase);
    if ("error" in result) {
      setLoadError(result.error);
      setPosts([]);
    } else {
      setPosts(result.rows);
    }
    setLoadingPosts(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadPosts());
  }, [loadPosts]);

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbnailPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(thumbnailFile);
    setThumbnailPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [thumbnailFile]);

  function updateField<K extends keyof BlogForm>(key: K, value: BlogForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!thumbnailFile) {
      setFormError("Choose a thumbnail photo.");
      return;
    }

    setSubmitting(true);
    const result = await createBlogPost(supabase, {
      title: form.title,
      publishedAt: form.publishedAt,
      bodyRaw: form.body,
      thumbnailFile,
      thumbnailAlt: form.thumbnailAlt,
      createdBy: user?.id
    });
    setSubmitting(false);

    if ("error" in result) {
      setFormError(result.error);
      return;
    }

    const scheduled = !isBlogPostPublished(result.row.published_at);
    setSuccessMessage(
      scheduled
        ? `Post saved and scheduled for ${formatBlogDate(result.row.published_at.slice(0, 10))}.`
        : `Post published at /blog/${result.row.slug}.`
    );
    setForm(DEFAULT_FORM);
    setThumbnailFile(null);
    void loadPosts();
  }

  return (
    <div className="admin-blog">
      <Seo title="Create blog post" description="Create and schedule blog posts for Temptation Motorsports." path="/admin/blog" noindex />

      <header className="page-header">
        <h1 className="page-title">Create blog post</h1>
        <p className="page-subtitle">
          Write a new blog post for the public site. Future dates stay hidden until that day.
        </p>
      </header>

      <div className="admin-blogLayout">
        <section className="card card-pad admin-blogFormCard">
          <h2 className="admin-blogSectionTitle">New post</h2>
          <form className="admin-blogForm" onSubmit={(event) => void onSubmit(event)}>
            <div className="form-row">
              <label className="form-label" htmlFor="blog-title">
                Title
              </label>
              <input
                id="blog-title"
                className="input"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                required
                maxLength={200}
              />
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor="blog-date">
                Publish date
              </label>
              <input
                id="blog-date"
                className="input"
                type="date"
                value={form.publishedAt}
                onChange={(e) => updateField("publishedAt", e.target.value)}
                required
              />
              <p className="form-hint">Defaults to today. Pick a future date to schedule.</p>
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor="blog-thumbnail">
                Thumbnail photo
              </label>
              <input
                id="blog-thumbnail"
                className="input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
                required={!thumbnailFile}
              />
              {thumbnailPreviewUrl ? (
                <img src={thumbnailPreviewUrl} alt="" className="admin-blogThumbPreview" decoding="async" />
              ) : null}
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor="blog-thumb-alt">
                Thumbnail alt text
              </label>
              <input
                id="blog-thumb-alt"
                className="input"
                value={form.thumbnailAlt}
                onChange={(e) => updateField("thumbnailAlt", e.target.value)}
                placeholder="Optional — defaults to the title"
                maxLength={160}
              />
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor="blog-body">
                Body
              </label>
              <textarea
                id="blog-body"
                className="input admin-blogBodyInput"
                rows={12}
                value={form.body}
                onChange={(e) => updateField("body", e.target.value)}
                placeholder="Write your post here. Separate paragraphs with a blank line."
                required
              />
              <p className="form-hint">Separate paragraphs with a blank line.</p>
            </div>

            {formError ? (
              <p className="form-error" role="alert">
                {formError}
              </p>
            ) : null}
            {successMessage ? (
              <p className="admin-blogSuccess" role="status">
                {successMessage}
              </p>
            ) : null}

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Saving…" : "Create post"}
            </button>
          </form>
        </section>

        <section className="card card-pad admin-blogListCard" aria-labelledby="admin-blog-list-heading">
          <h2 id="admin-blog-list-heading" className="admin-blogSectionTitle">
            Posts in database
          </h2>
          {loadError ? (
            <p className="form-error" role="alert">
              {loadError}. Run <code>sql/marketing/28_blog_posts.sql</code> on Supabase if this is a new setup.
            </p>
          ) : null}
          {loadingPosts ? <p className="admin-blogMuted">Loading posts…</p> : null}
          {!loadingPosts && posts.length === 0 && !loadError ? (
            <p className="admin-blogMuted">No database posts yet. Static sample posts may still show on /blog.</p>
          ) : null}
          {!loadingPosts && posts.length > 0 ? (
            <ul className="admin-blogList">
              {posts.map((post) => {
                const published = isBlogPostPublished(post.published_at);
                const thumbUrl = post.thumbnail_path ? blogPhotoPublicUrl(supabase, post.thumbnail_path) : null;
                return (
                  <li key={post.id} className="admin-blogListItem">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt="" className="admin-blogListThumb" loading="lazy" decoding="async" />
                    ) : (
                      <span className="admin-blogListThumb admin-blogListThumb--empty" aria-hidden />
                    )}
                    <div className="admin-blogListBody">
                      <p className="admin-blogListTitle">{post.title}</p>
                      <p className="admin-blogListMeta">
                        {formatBlogDate(post.published_at.slice(0, 10))}
                        {published ? (
                          <>
                            {" · "}
                            <Link to={`/blog/${post.slug}`}>View live</Link>
                          </>
                        ) : (
                          <span className="admin-blogScheduledBadge">Scheduled</span>
                        )}
                      </p>
                      <p className="admin-blogListSubMeta">Saved {formatWhen(post.created_at)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
