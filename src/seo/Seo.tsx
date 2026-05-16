import { Helmet } from "react-helmet-async";
import {
  absoluteUrl,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
  hasPublicSiteOrigin
} from "../lib/siteUrl";

export type SeoProps = {
  title: string;
  description: string;
  /** Pathname including leading slash, e.g. `/inventory` */
  path: string;
  noindex?: boolean;
  /** Path under `public/` for og:image, default apple-touch-icon */
  ogImagePath?: string;
};

export function Seo({ title, description, path, noindex, ogImagePath = DEFAULT_OG_IMAGE_PATH }: SeoProps) {
  const fullTitle = title.includes("Temptation Motorsports") ? title : `${title} | Temptation Motorsports`;
  const useAbsolute = hasPublicSiteOrigin() && !noindex;
  const canonical = useAbsolute ? absoluteUrl(path === "" ? "/" : path) : undefined;
  const ogImage = useAbsolute ? absoluteUrl(ogImagePath) : undefined;

  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex ? <meta name="robots" content="noindex, nofollow" /> : <meta name="robots" content="index, follow" />}
      {canonical ? <link rel="canonical" href={canonical} /> : null}

      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      {ogImage ? <meta property="og:image" content={ogImage} /> : null}
      {ogImage ? <meta property="og:image:width" content={String(DEFAULT_OG_IMAGE_WIDTH)} /> : null}
      {ogImage ? <meta property="og:image:height" content={String(DEFAULT_OG_IMAGE_HEIGHT)} /> : null}
      {ogImage ? <meta property="og:image:alt" content={DEFAULT_OG_IMAGE_ALT} /> : null}
      {useAbsolute ? <meta property="og:site_name" content="Temptation Motorsports" /> : null}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}
      {ogImage ? <meta name="twitter:image:alt" content={DEFAULT_OG_IMAGE_ALT} /> : null}
    </Helmet>
  );
}
