import { Helmet } from "react-helmet-async";
import { type BlogPost } from "../data/blogPosts";
import { absoluteUrl, hasPublicSiteOrigin } from "../lib/siteUrl";

type BlogPostJsonLdProps = {
  post: BlogPost;
};

export function BlogPostJsonLd({ post }: BlogPostJsonLdProps) {
  if (!hasPublicSiteOrigin()) return null;

  const postUrl = absoluteUrl(`/blog/${post.slug}`);
  const blogPosting = {
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription,
    datePublished: post.publishedAt,
    url: postUrl,
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      blogPosting,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Blog", item: absoluteUrl("/blog") },
          { "@type": "ListItem", position: 2, name: post.title, item: postUrl }
        ]
      }
    ]
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
