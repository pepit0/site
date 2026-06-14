import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CANADIAN_PROVINCES_FOR_SELECT, DEFAULT_PROVINCE_CODE } from "../data/canadianProvincialTax";
import {
  calculatePublicPayment,
  parsePublicPriceField,
  PUBLIC_TERM_OPTIONS,
  type PublicTermMonths
} from "../lib/publicPaymentCalculator";

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2
  }).format(n);
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="site-payCalcBreakdownRow">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

type PaymentCalculatorFormProps = {
  idPrefix?: string;
  onApplyClick?: () => void;
};

export function PaymentCalculatorForm({ idPrefix = "paycalc", onApplyClick }: PaymentCalculatorFormProps) {
  const [price, setPrice] = useState("");
  const [termMonths, setTermMonths] = useState<PublicTermMonths>(60);
  const [province, setProvince] = useState<string>(DEFAULT_PROVINCE_CODE);
  const [biWeeklyView, setBiWeeklyView] = useState(false);

  const priceId = `${idPrefix}-price`;
  const provinceId = `${idPrefix}-province`;

  const result = useMemo(() => {
    const unitPrice = parsePublicPriceField(price);
    if (unitPrice === null) return { ok: false as const, error: "Enter a unit price to see your estimate." };
    return calculatePublicPayment({ unitPrice, termMonths, province });
  }, [price, termMonths, province]);

  return (
    <div className="site-payCalcForm">
      <div className="site-payCalcField">
        <label className="site-payCalcLabel" htmlFor={priceId}>
          Unit price
        </label>
        <div className="site-payCalcPriceWrap">
          <span className="site-payCalcPricePrefix" aria-hidden>
            $
          </span>
          <input
            id={priceId}
            className="site-payCalcInput site-payCalcInput--price"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            placeholder="10000"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
      </div>

      <div className="site-payCalcField">
        <p className="site-payCalcLabel">Term length</p>
        <div className="site-payCalcTermGrid" role="group" aria-label="Term length in months">
          {PUBLIC_TERM_OPTIONS.map((months) => (
            <button
              key={months}
              type="button"
              className={`site-payCalcTermBtn${termMonths === months ? " site-payCalcTermBtn--active" : ""}`}
              aria-pressed={termMonths === months}
              onClick={() => setTermMonths(months)}
            >
              {months} mo
            </button>
          ))}
        </div>
      </div>

      <div className="site-payCalcField">
        <label className="site-payCalcLabel" htmlFor={provinceId}>
          Province
        </label>
        <select
          id={provinceId}
          className="site-payCalcSelect"
          value={province}
          onChange={(e) => setProvince(e.target.value)}
        >
          {CANADIAN_PROVINCES_FOR_SELECT.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <section className="site-payCalcResult" aria-live="polite">
        {result.ok ? (
          <>
            <div className="site-payCalcPaymentRow">
              <p className="site-payCalcPayment">
                {formatMoney(biWeeklyView ? result.biWeekly.payment : result.monthly.payment)}
              </p>
              <button
                type="button"
                className="site-payCalcScheduleToggle"
                onClick={() => setBiWeeklyView((value) => !value)}
              >
                {biWeeklyView ? "(view monthly)" : "(view bi-weekly)"}
              </button>
            </div>
            <p className="site-payCalcPaymentLabel">
              estimated {biWeeklyView ? "bi-weekly" : "per month"} at {result.annualRatePercent}%
            </p>
            <dl className="site-payCalcBreakdown">
              <BreakdownRow label="Unit price" value={formatMoney(result.unitPrice)} />
              <BreakdownRow label="Dealer fees" value={formatMoney(result.pack)} />
              <BreakdownRow label="Finance charge" value={formatMoney(result.financeCharge)} />
              <BreakdownRow label="Subtotal before tax" value={formatMoney(result.preTaxSubtotal)} />
              <BreakdownRow label={`Sales tax (${result.taxLabel})`} value={formatMoney(result.salesTax)} />
              <BreakdownRow label="Amount financed" value={formatMoney(result.amountFinanced)} />
              <BreakdownRow label="Term" value={`${result.termMonths} months`} />
              <BreakdownRow
                label="Total interest"
                value={formatMoney(biWeeklyView ? result.biWeekly.totalInterest : result.monthly.totalInterest)}
              />
            </dl>
          </>
        ) : (
          <p className="site-payCalcMuted">{result.error}</p>
        )}
      </section>

      <p className="site-payCalcFinePrint">
        Estimate only. Not a loan approval. Rates and taxes may change. Apply for a real quote.
      </p>
      <Link to="/apply" className="btn btn-primary site-payCalcApplyBtn" onClick={onApplyClick}>
        Apply for financing
      </Link>
    </div>
  );
}
