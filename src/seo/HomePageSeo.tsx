import { Helmet } from "react-helmet-async";
import {
  absoluteUrl,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
  hasPublicSiteOrigin
} from "../lib/siteUrl";
import { HOME_PAGE_DESCRIPTION, HOME_PAGE_OG_TYPE, HOME_PAGE_TITLE } from "./homeSeo";

export function HomePageSeo() {
  const useAbsolute = hasPublicSiteOrigin();
  const canonical = useAbsolute ? absoluteUrl("/") : undefined;
  const ogImage = useAbsolute ? absoluteUrl(DEFAULT_OG_IMAGE_PATH) : undefined;

  return (
    <Helmet prioritizeSeoTags>
      <title>{HOME_PAGE_TITLE}</title>
      <meta name="description" content={HOME_PAGE_DESCRIPTION} />
      <meta name="robots" content="index, follow" />
      {canonical ? <link rel="canonical" href={canonical} /> : null}

      <meta property="og:type" content={HOME_PAGE_OG_TYPE} />
      <meta property="og:title" content={HOME_PAGE_TITLE} />
      <meta property="og:description" content={HOME_PAGE_DESCRIPTION} />
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      {ogImage ? <meta property="og:image" content={ogImage} /> : null}
      {ogImage ? <meta property="og:image:width" content={String(DEFAULT_OG_IMAGE_WIDTH)} /> : null}
      {ogImage ? <meta property="og:image:height" content={String(DEFAULT_OG_IMAGE_HEIGHT)} /> : null}
      {ogImage ? <meta property="og:image:alt" content={DEFAULT_OG_IMAGE_ALT} /> : null}
      {useAbsolute ? <meta property="og:site_name" content="Temptation Motorsports" /> : null}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={HOME_PAGE_TITLE} />
      <meta name="twitter:description" content={HOME_PAGE_DESCRIPTION} />
      {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}
      {ogImage ? <meta name="twitter:image:alt" content={DEFAULT_OG_IMAGE_ALT} /> : null}
    </Helmet>
  );
}
