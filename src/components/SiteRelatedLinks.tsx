import { Link } from "react-router-dom";

export type SiteRelatedLinkItem = {
  label: string;
  to: string;
};

type SiteRelatedLinksProps = {
  title?: string;
  links: SiteRelatedLinkItem[];
};

export function SiteRelatedLinks({ title = "Related resources", links }: SiteRelatedLinksProps) {
  if (links.length === 0) return null;

  return (
    <section className="site-relatedLinks" aria-label={title}>
      <h2 className="site-relatedLinksTitle">{title}</h2>
      <ul className="site-relatedLinksList">
        {links.map((item) => (
          <li key={`${item.to}-${item.label}`}>
            <Link to={item.to}>{item.label}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
