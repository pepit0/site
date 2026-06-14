import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatBlogDate } from "../data/blogPosts";
import type { BlogPost } from "../data/blogPosts";
import { fetchPublicBlogPostBySlug } from "../lib/blogPostsApi";
import { supabase } from "../lib/supabase";
import { BlogPostJsonLd } from "../seo/BlogPostJsonLd";
import { BreadcrumbJsonLd } from "../seo/BreadcrumbJsonLd";
import { Seo } from "../seo/Seo";

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const nextPost = await fetchPublicBlogPostBySlug(supabase, slug);
    setPost(nextPost);
    setIsLoading(false);
  }, [slug]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  if (isLoading) {
    return (
      <div className="blog-page">
        <Seo title="Blog" description="News and tips from Temptation Motorsports." path="/blog" />
        <p className="blog-empty" role="status">
          Loading post…
        </p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="blog-page">
        <Seo title="Blog post not found" description="Browse news and tips from Temptation Motorsports." path="/blog" noindex />
        <p className="blog-empty" role="status">
          That post was not found. <Link to="/blog">Back to the blog</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="blog-page">
      <Seo title={post.title} description={post.seoDescription} path={`/blog/${post.slug}`} />
      <BlogPostJsonLd post={post} />
      <BreadcrumbJsonLd
        items={[
          { name: "Blog", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` }
        ]}
      />

      <header className="page-header">
        <nav className="blog-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden> / </span>
          <Link to="/blog">Blog</Link>
          <span aria-hidden> / </span>
          <span aria-current="page">{post.title}</span>
        </nav>
        <time className="blog-postDate" dateTime={post.publishedAt}>
          {formatBlogDate(post.publishedAt)}
        </time>
        <h1 className="page-title">{post.title}</h1>
      </header>

      <article className="card card-pad blog-post">
        <div className="blog-postHero">
          <img src={post.thumbnail} alt={post.thumbnailAlt} className="blog-postThumb" decoding="async" />
        </div>
        <div className="blog-postContent">
          {post.body.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="blog-postParagraph">
              {paragraph}
            </p>
          ))}
        </div>
        <div className="blog-postActions">
          <Link to="/apply" className="btn btn-primary">
            Apply for financing
          </Link>
          <Link to="/blog" className="btn btn-secondary">
            Back to blog
          </Link>
        </div>
      </article>
    </div>
  );
}
