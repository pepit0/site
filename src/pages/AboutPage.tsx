import { Link } from "react-router-dom";
import { BusinessNapBlock } from "../components/BusinessNapBlock";
import { ABOUT_HERO, ABOUT_SECTIONS, ABOUT_SEO } from "../data/aboutContactCopy";
import { AboutPageJsonLd } from "../seo/AboutPageJsonLd";
import { Seo } from "../seo/Seo";

export function AboutPage() {
  return (
    <div className="company-page">
      <Seo title={ABOUT_SEO.title} description={ABOUT_SEO.description} path="/about" />
      <AboutPageJsonLd />

      <header className="page-header">
        <h1 className="page-title">{ABOUT_HERO.h1}</h1>
        <p className="page-subtitle">{ABOUT_HERO.tagline}</p>
      </header>

      <div className="company-pageStack">
        <article className="card card-pad company-pageMain">
          {ABOUT_HERO.intro.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="company-pageParagraph">
              {paragraph}
            </p>
          ))}

          <div className="company-pageSections">
            {ABOUT_SECTIONS.map((section) => (
              <section key={section.heading}>
                <h2 className="company-pageSectionHeading">{section.heading}</h2>
                <p className="company-pageParagraph">{section.body}</p>
              </section>
            ))}
          </div>

          <div className="company-pageNapWrap">
            <h2 className="company-pageSectionHeading">Visit and contact</h2>
            <BusinessNapBlock />
          </div>

          <div className="company-pageActions">
            <Link to="/contact" className="btn btn-primary">
              Contact us
            </Link>
            <Link to="/apply" className="btn btn-secondary">
              Apply for financing
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
