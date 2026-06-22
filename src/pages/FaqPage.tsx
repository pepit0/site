import { Link } from "react-router-dom";
import { SiteRelatedLinks } from "../components/SiteRelatedLinks";
import { SITE_CONTACT } from "../data/preapprovalCopy";
import { SITE_FAQ, SITE_FAQ_HERO, SITE_FAQ_SEO, siteFaqJsonLd } from "../data/faqCopy";
import { BreadcrumbJsonLd } from "../seo/BreadcrumbJsonLd";
import { Seo } from "../seo/Seo";
import { Helmet } from "react-helmet-async";

export function FaqPage() {
  return (
    <div className="faq-page">
      <Seo title={SITE_FAQ_SEO.title} description={SITE_FAQ_SEO.description} path="/faq" />
      <BreadcrumbJsonLd items={[{ name: "FAQ", path: "/faq" }]} />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(siteFaqJsonLd())}</script>
      </Helmet>

      <header className="page-header">
        <nav className="faq-pageBreadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden> / </span>
          <span aria-current="page">FAQ</span>
        </nav>
        <h1 className="page-title">{SITE_FAQ_HERO.h1}</h1>
        <p className="page-subtitle">{SITE_FAQ_HERO.intro}</p>
      </header>

      <section className="card card-pad preapproval-faq" aria-labelledby="site-faq-heading">
        <h2 id="site-faq-heading" className="preapproval-faqTitle">
          Questions &amp; answers
        </h2>
        <dl className="preapproval-faqList">
          {SITE_FAQ.map((item) => (
            <div key={item.question} className="preapproval-faqItem">
              <dt className="preapproval-faqQuestion">{item.question}</dt>
              <dd className="preapproval-faqAnswer">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="faq-pageCta">
        Ready to apply?{" "}
        <Link to="/apply" className="faq-pageCtaLink">
          Start your free pre-approval
        </Link>
        . Questions? Call{" "}
        <a href={`tel:${SITE_CONTACT.phoneTel}`}>{SITE_CONTACT.phoneDisplay}</a> or{" "}
        <Link to="/contact">contact us</Link>.
      </p>
      <SiteRelatedLinks
        links={[
          { label: "Financing guides", to: "/financing" },
          { label: "Inventory", to: "/inventory" },
          { label: "Apply for financing", to: "/apply" },
          { label: "Payment calculator", to: "/payment-calculator" },
          { label: "Sell your ride", to: "/sell-your-ride" }
        ]}
      />
    </div>
  );
}
