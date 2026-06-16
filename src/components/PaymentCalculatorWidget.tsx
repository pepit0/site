import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PaymentCalculatorForm } from "./PaymentCalculatorForm";

const MOBILE_HEADER_MQ = "(max-width: 899px)";

function CalculatorIcon() {  return (
    <svg
      className="site-payCalcFabIcon"
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <rect x="8" y="6" width="8" height="3.5" rx="0.75" fill="currentColor" stroke="none" />
      <circle cx="9" cy="13.25" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13.25" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13.25" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="9" cy="16.75" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16.75" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="16.75" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PaymentCalculatorWidget() {
  const [open, setOpen] = useState(false);
  const [mobileHeader, setMobileHeader] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_HEADER_MQ).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_HEADER_MQ);
    const apply = () => {
      setMobileHeader(mq.matches);
      if (mq.matches) setOpen(false);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!open || mobileHeader) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, mobileHeader]);

  const fabInner = (
    <span className="site-payCalcFabInner">
      <CalculatorIcon />
    </span>
  );

  return (
    <div className="site-payCalc">
      {!mobileHeader && open ? (
        <div
          className="site-payCalcPanel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="site-payCalc-title"
        >
          <header className="site-payCalcPanelHero">
            <div className="site-payCalcPanelHeroText">
              <p className="site-payCalcPanelEyebrow">Temptation Motorsports</p>
              <h2 id="site-payCalc-title" className="site-payCalcPanelTitle">
                Payment calculator
              </h2>
              <p className="site-payCalcPanelSubtitle">
                Honest calculations, no tricks, fees included.
              </p>
            </div>
            <button type="button" className="site-payCalcClose" onClick={() => setOpen(false)}>
              Close
            </button>
          </header>

          <div className="site-payCalcPanelBody">
            <PaymentCalculatorForm idPrefix="paycalc-widget" onApplyClick={() => setOpen(false)} />
          </div>
        </div>
      ) : null}

      {mobileHeader ? (
        <Link to="/payment-calculator" className="site-payCalcFab" aria-label="Payment calculator">
          {fabInner}
        </Link>
      ) : (
        <button
          type="button"
          className={`site-payCalcFab${open ? " site-payCalcFabOpen" : ""}`}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="site-payCalc-title"
          aria-label={open ? "Close payment calculator" : "Open payment calculator"}
        >
          {fabInner}
        </button>
      )}
    </div>
  );
}