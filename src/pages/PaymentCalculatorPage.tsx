import { Link } from "react-router-dom";
import { PaymentCalculatorForm } from "../components/PaymentCalculatorForm";
import { PAYMENT_CALCULATOR_HERO, PAYMENT_CALCULATOR_SEO } from "../data/paymentCalculatorCopy";
import { PaymentCalculatorPageJsonLd } from "../seo/PaymentCalculatorPageJsonLd";
import { Seo } from "../seo/Seo";

export function PaymentCalculatorPage() {
  return (
    <div className="paycalc-page">
      <Seo
        title={PAYMENT_CALCULATOR_SEO.title}
        description={PAYMENT_CALCULATOR_SEO.description}
        path="/payment-calculator"
      />
      <PaymentCalculatorPageJsonLd />

      <header className="page-header">
        <h1 className="page-title">{PAYMENT_CALCULATOR_HERO.h1}</h1>
        <p className="page-subtitle">{PAYMENT_CALCULATOR_HERO.tagline}</p>
      </header>

      <div className="paycalc-pageStack">
        <article className="card card-pad paycalc-pageCard">
          <PaymentCalculatorForm idPrefix="paycalc-page" />
        </article>

        <div className="paycalc-pageActions">
          <Link to="/financing" className="btn btn-secondary">
            Financing guides
          </Link>
          <Link to="/inventory" className="btn btn-secondary">
            See inventory
          </Link>
        </div>
      </div>
    </div>
  );
}
