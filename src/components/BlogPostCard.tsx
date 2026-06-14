import { Link } from "react-router-dom";
import { formatBlogDate, type BlogPost } from "../data/blogPosts";

type BlogPostCardProps = {
  post: BlogPost;
};

export function BlogPostCard({ post }: BlogPostCardProps) {
  return (
    <article className="blog-card">
      <Link to={`/blog/${post.slug}`} className="blog-cardLink">
        <div className="blog-cardMedia">
          <img src={post.thumbnail} alt={post.thumbnailAlt} className="blog-cardThumb" loading="lazy" decoding="async" />
        </div>
        <div className="blog-cardBody">
          <time className="blog-cardDate" dateTime={post.publishedAt}>
            {formatBlogDate(post.publishedAt)}
          </time>
          <h2 className="blog-cardTitle">{post.title}</h2>
          <p className="blog-cardExcerpt">{post.excerpt}</p>
          <span className="blog-cardCta">
            Click to learn more
            <span className="blog-cardCtaArrow" aria-hidden>
              →
            </span>
          </span>
        </div>
      </Link>
    </article>
  );
}
