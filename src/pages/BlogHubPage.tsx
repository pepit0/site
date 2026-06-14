import { useCallback, useEffect, useState } from "react";
import { BlogPostCard } from "../components/BlogPostCard";
import { BLOG_HUB, BLOG_HUB_SEO } from "../data/blogPosts";
import { fetchPublicBlogPosts } from "../lib/blogPostsApi";
import { supabase } from "../lib/supabase";
import { BreadcrumbJsonLd } from "../seo/BreadcrumbJsonLd";
import { Seo } from "../seo/Seo";
import type { BlogPost } from "../data/blogPosts";

export function BlogHubPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const nextPosts = await fetchPublicBlogPosts(supabase);
    setPosts(nextPosts);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  return (
    <div className="blog-page">
      <Seo title={BLOG_HUB_SEO.title} description={BLOG_HUB_SEO.description} path="/blog" />
      <BreadcrumbJsonLd items={[{ name: "Blog", path: "/blog" }]} />

      <header className="page-header">
        <h1 className="page-title">{BLOG_HUB.h1}</h1>
        <p className="page-subtitle">{BLOG_HUB.tagline}</p>
      </header>

      <div className="blog-pageStack">
        {isLoading ? (
          <p className="blog-empty" role="status">
            Loading posts…
          </p>
        ) : posts.length > 0 ? (
          <div className="blog-cardList">
            {posts.map((post) => (
              <BlogPostCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <p className="blog-empty" role="status">
            New posts are on the way. Check back soon.
          </p>
        )}
      </div>
    </div>
  );
}
