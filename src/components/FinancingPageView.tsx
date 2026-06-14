import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ALL_FINANCING_PAGES,
  financingFaqJsonLd,
  financingWebPageJsonLd,
  type FinancingPageDef
} from "../data/financingPages";
import { SITE_CONTACT } from "../data/preapprovalCopy";
import { BreadcrumbJsonLd } from "../seo/BreadcrumbJsonLd";
import { FinancialServiceJsonLd } from "../seo/FinancialServiceJsonLd";
import { Seo } from "../seo/Seo";

type FinancingPageViewProps = {
  page: FinancingPageDef;
};

export function FinancingPageView({ page }: FinancingPageViewProps) {
  const faqLd = financingFaqJsonLd(page.faq);
  const webPageLd = financingWebPageJsonLd(page);
  const [directAnswer, ...restIntro] = page.intro;
  const breadcrumbItems =
    page.path === "/financing"
      ? [{ name: "Financing", path: "/financing" }]
      : [
          { name: "Financing", path: "/financing" },
          { name: page.navLabel, path: page.path }
        ];

  return (
    <div className="financing-page">
      <Seo title={page.seoTitle} description={page.seoDescription} path={page.path} />
      <FinancialServiceJsonLd serviceName={page.serviceName} description={page.seoDescription} path={page.path} />
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
        {webPageLd ? <script type="application/ld+json">{JSON.stringify(webPageLd)}</script> : null}
      </Helmet>

      <header className="page-header financing-pageHeader">
        <nav className="financing-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden> / </span>
          {page.path === "/financing" ? (
            <span aria-current="page">Financing</span>
          ) : (
            <>
              <Link to="/financing">Financing</Link>
              <span aria-hidden> / </span>
              <span aria-current="page">{page.navLabel}</span>
            </>
          )}
        </nav>
        <h1 className="page-title">{page.h1}</h1>
        <p className="page-subtitle financing-tagline">{page.tagline}</p>
      </header>

      <div className="financing-layout">
        <article className="card card-pad financing-main">
          <div className="financing-intro">
            {directAnswer ? (
              <p className="financing-directAnswer">{directAnswer}</p>
            ) : null}
            {restIntro.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
          </div>

          {page.expertiseSections.length > 0 ? (
            <div className="financing-expertise">
              {page.expertiseSections.map((section) => (
                <section key={section.heading} aria-labelledby={`financing-expertise-${section.heading.slice(0, 12)}`}>
                  <h2
                    id={`financing-expertise-${section.heading.slice(0, 12)}`}
                    className="financing-expertiseHeading"
                  >
                    {section.heading}
                  </h2>
                  <p className="financing-expertiseBody">{section.body}</p>
                </section>
              ))}
            </div>
          ) : null}

          <ul className="financing-highlights" aria-label="Why apply with us">
            {page.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="financing-ctaRow">
            <Link to="/apply" className="btn btn-primary">
              Apply for financing
            </Link>
            <Link to="/inventory" className="btn btn-secondary">
              See rides for sale
            </Link>
          </div>

          <p className="financing-contactHint">
            Questions? Call{" "}
            <a href={`tel:${SITE_CONTACT.phoneTel}`}>{SITE_CONTACT.phoneDisplay}</a> or{" "}
            <Link to="/apply">apply online free</Link>.
          </p>
        </article>

        <aside className="card card-pad financing-aside" aria-labelledby="financing-topics-heading">
          <h2 id="financing-topics-heading" className="financing-asideTitle">
            Financing topics
          </h2>
          <ul className="financing-topicList">
            {ALL_FINANCING_PAGES.map((topic) => {
              const isActive = topic.path === page.path;
              return (
                <li key={topic.path}>
                  {isActive ? (
                    <span className="financing-topicLink financing-topicLink--active" aria-current="page">
                      {topic.navLabel}
                    </span>
                  ) : (
                    <Link to={topic.path} className="financing-topicLink">
                      {topic.navLabel}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>
      </div>

      <section className="card card-pad financing-faq" aria-labelledby="financing-faq-heading">
        <h2 id="financing-faq-heading" className="financing-faqTitle">
          {page.path === "/financing" ? "Financing questions" : `${page.navLabel} questions`}
        </h2>
        <dl className="financing-faqList">
          {page.faq.map((item) => (
            <div key={item.question} className="financing-faqItem">
              <dt className="financing-faqQuestion">{item.question}</dt>
              <dd className="financing-faqAnswer">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
