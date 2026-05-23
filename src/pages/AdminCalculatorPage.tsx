import { useMemo, useState } from "react";
import {
  calculateAdminPayment,
  parseMoneyField,
  type AdminPaymentCalculatorInput
} from "../lib/adminPaymentCalculator";
import { Seo } from "../seo/Seo";

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 }).format(
    n
  );
}

function formatNum(n: number, decimals = 2): string {
  return new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  }).format(n);
}

type CalcForm = {
  cost: string;
  markup: string;
  pack: string;
  gap: string;
  warranty: string;
  annualInterestPercent: string;
  paymentsPerYear: string;
  termMonths: string;
};

const DEFAULT_FORM: CalcForm = {
  cost: "",
  markup: "0",
  pack: "2000",
  gap: "",
  warranty: "",
  annualInterestPercent: "",
  paymentsPerYear: "12",
  termMonths: "60"
};

function buildInput(form: CalcForm): AdminPaymentCalculatorInput | { error: string } {
  const cost = parseMoneyField(form.cost);
  if (cost === null) return { error: "Enter a unit cost." };

  const markup = parseMoneyField(form.markup) ?? 0;
  const pack = parseMoneyField(form.pack) ?? 0;
  const gap = parseMoneyField(form.gap) ?? 0;
  const warranty = parseMoneyField(form.warranty) ?? 0;

  const annualInterestPercent = parseMoneyField(form.annualInterestPercent);
  if (annualInterestPercent === null) return { error: "Enter an interest rate." };

  const paymentsPerYear = parseMoneyField(form.paymentsPerYear);
  if (paymentsPerYear === null) return { error: "Enter payments per year." };

  const termMonths = parseMoneyField(form.termMonths);
  if (termMonths === null) return { error: "Enter a term in months." };

  return {
    cost,
    markup,
    pack,
    gap,
    warranty,
    annualInterestPercent,
    paymentsPerYear,
    termMonths
  };
}

export function AdminCalculatorPage() {
  const [form, setForm] = useState<CalcForm>(DEFAULT_FORM);

  const result = useMemo(() => {
    const built = buildInput(form);
    if ("error" in built) return { ok: false as const, error: built.error };
    return calculateAdminPayment(built);
  }, [form]);

  const update = (key: keyof CalcForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="admin-calc">
      <Seo title="Payment calculator" description="Admin payment estimator for Temptation Motorsports." path="/admin/calculator" noindex />
      <header className="page-header">
        <h1 className="page-title">Payment calculator</h1>
        <p className="page-subtitle">
          Estimate a customer payment from unit cost, markup, pack, gap, warranty, rate, and term. For quotes only —
          not a lender approval.
        </p>
      </header>

      <div className="admin-calcGrid">
        <section className="card card-pad admin-calcForm">
          <h2 className="admin-calcSectionTitle">Inputs</h2>
          <div className="form-row">
            <label className="form-label" htmlFor="calc-cost">
              Unit cost ($) <span className="form-required">*</span>
            </label>
            <input
              id="calc-cost"
              className="input"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={form.cost}
              onChange={(e) => update("cost", e.target.value)}
            />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="calc-markup">
              Markup ($)
            </label>
            <input
              id="calc-markup"
              className="input"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={form.markup}
              onChange={(e) => update("markup", e.target.value)}
            />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="calc-pack">
              Pack ($)
            </label>
            <input
              id="calc-pack"
              className="input"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={form.pack}
              onChange={(e) => update("pack", e.target.value)}
            />
          </div>
          <div className="form-row form-rowSplit">
            <div>
              <label className="form-label" htmlFor="calc-gap">
                Gap ($)
              </label>
              <input
                id="calc-gap"
                className="input"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="0"
                value={form.gap}
                onChange={(e) => update("gap", e.target.value)}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="calc-warranty">
                Warranty ($)
              </label>
              <input
                id="calc-warranty"
                className="input"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="0"
                value={form.warranty}
                onChange={(e) => update("warranty", e.target.value)}
              />
            </div>
          </div>
          <div className="form-row form-rowSplit">
            <div>
              <label className="form-label" htmlFor="calc-rate">
                Interest rate (% annual) <span className="form-required">*</span>
              </label>
              <input
                id="calc-rate"
                className="input"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={form.annualInterestPercent}
                onChange={(e) => update("annualInterestPercent", e.target.value)}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="calc-ppy">
                Payments per year <span className="form-required">*</span>
              </label>
              <input
                id="calc-ppy"
                className="input"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.paymentsPerYear}
                onChange={(e) => update("paymentsPerYear", e.target.value)}
              />
              <p className="form-hint">e.g. 12 monthly, 26 bi-weekly</p>
            </div>
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="calc-term">
              Term (months) <span className="form-required">*</span>
            </label>
            <input
              id="calc-term"
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={form.termMonths}
              onChange={(e) => update("termMonths", e.target.value)}
            />
          </div>
        </section>

        <section className="card card-pad admin-calcResultCard" aria-live="polite">
          <h2 className="admin-calcSectionTitle">Estimated payment</h2>
          {result.ok ? (
            <>
              <p className="admin-calcPayment">{formatMoney(result.paymentPerPeriod)}</p>
              <p className="admin-calcPaymentLabel">per payment</p>
              <dl className="admin-calcSummary">
                <div>
                  <dt>Financed amount</dt>
                  <dd>{formatMoney(result.principal)}</dd>
                </div>
                <div>
                  <dt>Number of payments</dt>
                  <dd>{formatNum(result.numPayments, 0)}</dd>
                </div>
                <div>
                  <dt>Term</dt>
                  <dd>
                    {form.termMonths} months @ {form.paymentsPerYear}/year
                  </dd>
                </div>
                <div>
                  <dt>Rate</dt>
                  <dd>{formatNum(Number(form.annualInterestPercent), 2)}% annual</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="admin-calcError" role="alert">
              {result.error}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
