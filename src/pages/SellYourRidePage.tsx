import { Link } from "react-router-dom";
import logoUrl from "../assets/logo.png";
import { SiteRelatedLinks } from "../components/SiteRelatedLinks";
import { SELL_RIDE_HERO, SELL_RIDE_SEO } from "../data/sellRideCopy";
import { Seo } from "../seo/Seo";

export function SellYourRidePage() {
  return (
    <div className="sell-ride">
      <Seo title={SELL_RIDE_SEO.title} description={SELL_RIDE_SEO.description} path="/sell-your-ride" />
      <div className="sell-ride-layout">
        <div className="sell-ride-brandColumn">
          <header className="sell-ride-brandHeader">
            <h1 className="page-title sell-ride-title">{SELL_RIDE_HERO.title}</h1>
            <p className="sell-ride-tagline">{SELL_RIDE_HERO.tagline}</p>
          </header>
          <div className="sell-ride-logoWrap">
            <img
              src={logoUrl}
              alt="Temptation Motorsports"
              className="sell-ride-logo"
              width={640}
              height={320}
              decoding="async"
            />
          </div>
        </div>

        <div className="sell-ride-panel">
          <div className="sell-ride-body">
            <section className="sell-ride-seoBlurb" aria-labelledby="sell-ride-seo-heading">
              <h2 id="sell-ride-seo-heading" className="sell-ride-seoBlurbTitle">
                {SELL_RIDE_HERO.seoBlurbTitle}
              </h2>
              <p className="sell-ride-seoBlurbText">{SELL_RIDE_HERO.lede}</p>
            </section>
            <ul className="sell-ride-highlights" aria-label="How selling with us works">
              {SELL_RIDE_HERO.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="sell-ride-applyCta">
              <Link to="/sell-your-ride/apply" className="btn btn-primary">
                {SELL_RIDE_HERO.ctaLabel}
              </Link>
            </p>
            <SiteRelatedLinks
              links={[
                { label: "Inventory", to: "/inventory" },
                { label: "FAQ", to: "/faq" },
                { label: "Contact us", to: "/contact" }
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
