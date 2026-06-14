import { useEffect, useState } from "react";
import { PaymentCalculatorForm } from "./PaymentCalculatorForm";

function CalculatorIcon() {
  return (
    <svg className="site-payCalcFabIcon" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h10V4H7zm2 2h2v2H9V6zm4 0h2v2h-2V6zM9 10h2v2H9v-2zm4 0h2v2h-2v-2zM9 14h2v2H9v-2zm4 0h2v2h-2v-2zM9 18h6v2H9v-2z"
      />
    </svg>
  );
}

export function PaymentCalculatorWidget() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="site-payCalc">
      {open ? (
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
                Estimate your monthly payment. Includes dealer fees and finance charge plus provincial tax on the unit.
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

      <button
        type="button"
        className={`site-payCalcFab${open ? " site-payCalcFabOpen" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="site-payCalc-title"
        aria-label={open ? "Close payment calculator" : "Open payment calculator"}
      >
        <span className="site-payCalcFabInner">
          <CalculatorIcon />
          <span className="site-payCalcFabLabel">Calculator</span>
        </span>
      </button>
    </div>
  );
}
