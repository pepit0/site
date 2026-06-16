import { Link } from "react-router-dom";
import { BusinessNapBlock } from "../components/BusinessNapBlock";
import { ContactLocationMap } from "../components/ContactLocationMap";
import { CONTACT_HERO, CONTACT_REASONS, CONTACT_SEO } from "../data/aboutContactCopy";
import { ContactPageJsonLd } from "../seo/ContactPageJsonLd";
import { Seo } from "../seo/Seo";

export function ContactPage() {
  return (
    <div className="company-page contact-page">
      <Seo title={CONTACT_SEO.title} description={CONTACT_SEO.description} path="/contact" />
      <ContactPageJsonLd />

      <header className="page-header">
        <h1 className="page-title">{CONTACT_HERO.h1}</h1>
        <p className="page-subtitle">{CONTACT_HERO.tagline}</p>
      </header>

      <div className="company-pageGrid contact-pageGrid">
        <article className="card card-pad company-pageMain contact-pageMain">
          {CONTACT_HERO.intro.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="company-pageParagraph">
              {paragraph}
            </p>
          ))}

          <div className="contact-pageReach">
            <div className="contact-pageReachInfo">
              <h2 className="company-pageSectionHeading">Reach us</h2>
              <BusinessNapBlock showChatButton showDirections={false} />
            </div>

            <div className="contact-pageReachMap">
              <ContactLocationMap embedded />
            </div>
          </div>

          <dl className="company-contactList">
            <div className="company-contactItem">
              <dt>Response time</dt>
              <dd>Most messages get a call or email back within one business day.</dd>
            </div>
          </dl>

          <div className="company-pageActions">
            <Link to="/apply" className="btn btn-primary">
              Apply for financing
            </Link>
            <Link to="/about" className="btn btn-secondary">
              About us
            </Link>
          </div>
        </article>

        <aside className="card card-pad company-pageAside contact-pageAside" aria-labelledby="contact-reasons-heading">
          <h2 id="contact-reasons-heading" className="company-pageAsideTitle">
            How can we help?
          </h2>
          <ul className="company-reasonList">
            {CONTACT_REASONS.map((reason) => (
              <li key={reason.title} className="company-reasonItem">
                <h3 className="company-reasonTitle">{reason.title}</h3>
                <p className="company-reasonBody">{reason.body}</p>
                <Link to={reason.linkTo} className="company-reasonLink">
                  {reason.linkLabel}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
