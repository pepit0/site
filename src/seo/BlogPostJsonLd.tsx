import { Helmet } from "react-helmet-async";
import { type BlogPost } from "../data/blogPosts";
import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";

type BlogPostJsonLdProps = {
  post: BlogPost;
};

export function BlogPostJsonLd({ post }: BlogPostJsonLdProps) {
  if (!hasPublicSiteOrigin()) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription,
    datePublished: post.publishedAt,
    url: absoluteUrl(`/blog/${post.slug}`),
    ...(post.thumbnail.startsWith("http")
      ? { image: post.thumbnail }
      : post.thumbnail.startsWith("/")
        ? { image: absoluteUrl(post.thumbnail) }
        : {}),
    author: {
      "@type": "Organization",
      name: "Temptation Motorsports"
    },
    publisher: {
      "@type": "Organization",
      name: "Temptation Motorsports",
      url: absoluteUrl("/")
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
