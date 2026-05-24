import { useMemo, useState } from "react";
import { CANADIAN_PROVINCES_FOR_SELECT, getProvinceTaxProfile } from "../data/canadianProvincialTax";
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

function formatDeduction(n: number): string {
  return n === 0 ? formatMoney(0) : `−${formatMoney(n)}`;
}

type CalcForm = {
  cost: string;
  markup: string;
  pack: string;
  gap: string;
  gapTaxable: boolean;
  warranty: string;
  warrantyTaxable: boolean;
  downPayment: string;
  customerProvince: string;
  annualInterestPercent: string;
  paymentsPerYear: string;
  termMonths: string;
};

const DEFAULT_FORM: CalcForm = {
  cost: "",
  markup: "0",
  pack: "2000",
  gap: "",
  gapTaxable: false,
  warranty: "",
  warrantyTaxable: false,
  downPayment: "",
  customerProvince: "",
  annualInterestPercent: "",
  paymentsPerYear: "12",
  termMonths: "60"
};

function buildInput(
  form: CalcForm,
  grossCosts: { gapCost: string; warrantyCost: string }
): AdminPaymentCalculatorInput | { error: string } {
  const cost = parseMoneyField(form.cost);
  if (cost === null) return { error: "Enter a unit cost." };

  const markup = parseMoneyField(form.markup) ?? 0;
  const pack = parseMoneyField(form.pack) ?? 0;
  const gap = parseMoneyField(form.gap) ?? 0;
  const warranty = parseMoneyField(form.warranty) ?? 0;
  const downPayment = parseMoneyField(form.downPayment) ?? 0;
  const gapCost = parseMoneyField(grossCosts.gapCost) ?? 0;
  const warrantyCost = parseMoneyField(grossCosts.warrantyCost) ?? 0;

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
    gapTaxable: form.gapTaxable,
    warranty,
    warrantyTaxable: form.warrantyTaxable,
    downPayment,
    customerProvince: form.customerProvince,
    gapCost,
    warrantyCost,
    annualInterestPercent,
    paymentsPerYear,
    termMonths
  };
}

function TaxableProductRow({
  id,
  label,
  value,
  taxable,
  taxHint,
  onValueChange,
  onTaxableChange
}: {
  id: string;
  label: string;
  value: string;
  taxable: boolean;
  taxHint: string;
  onValueChange: (v: string) => void;
  onTaxableChange: (v: boolean) => void;
}) {
  return (
    <div className="admin-calcProductField">
      <div className="admin-calcLabelRow">
        <label className="form-label" htmlFor={id}>
          {label}
        </label>
        <label className="form-check admin-calcTaxableCheck" htmlFor={`${id}-taxable`}>
          <input
            id={`${id}-taxable`}
            type="checkbox"
            checked={taxable}
            onChange={(e) => onTaxableChange(e.target.checked)}
          />
          <span>Taxable?</span>
        </label>
      </div>
      <input
        id={id}
        className="input"
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        placeholder="0"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      />
      {taxable ? (
        <p className="form-hint">Adds {taxHint} to the financed amount.</p>
      ) : null}
    </div>
  );
}

function GrossProductBlock({
  productLabel,
  saleAmount,
  costId,
  costValue,
  grossAmount,
  onCostChange
}: {
  productLabel: string;
  saleAmount: number;
  costId: string;
  costValue: string;
  grossAmount: number;
  onCostChange: (v: string) => void;
}) {
  return (
    <div className="admin-calcGrossProduct">
      <BreakdownRow label={`${productLabel} (sale)`} value={formatMoney(saleAmount)} />
      <div className="admin-calcBreakdownRow admin-calcBreakdownRow--cost">
        <label className="admin-calcBreakdownLabel" htmlFor={costId}>
          {productLabel} cost
        </label>
        <input
          id={costId}
          className="input admin-calcGrossCostInput"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          placeholder="0"
          value={costValue}
          onChange={(e) => onCostChange(e.target.value)}
        />
      </div>
      <BreakdownRow label={`${productLabel} gross`} value={formatMoney(grossAmount)} />
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  deduct,
  total
}: {
  label: string;
  value: string;
  deduct?: boolean;
  total?: boolean;
}) {
  return (
    <div
      className={[
        "admin-calcBreakdownRow",
        deduct ? "admin-calcBreakdownRow--deduct" : "",
        total ? "admin-calcBreakdownRow--total" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function AdminCalculatorPage() {
  const [form, setForm] = useState<CalcForm>(DEFAULT_FORM);
  const [gapCost, setGapCost] = useState("");
  const [warrantyCost, setWarrantyCost] = useState("");

  const result = useMemo(() => {
    const built = buildInput(form, { gapCost, warrantyCost });
    if ("error" in built) return { ok: false as const, error: built.error };
    return calculateAdminPayment(built);
  }, [form, gapCost, warrantyCost]);

  const update = (key: keyof CalcForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const provinceTaxProfile = getProvinceTaxProfile(form.customerProvince);
  const productTaxHint = provinceTaxProfile.taxHint;

  return (
    <div className="admin-calc">
      <Seo title="Payment calculator" description="Admin payment estimator for Temptation Motorsports." path="/admin/calculator" noindex />
      <header className="page-header">
        <h1 className="page-title">Payment calculator</h1>
        <p className="page-subtitle">
          Estimate a customer payment from unit cost, markup, pack, optional GAP/warranty (provincial sales tax when
          taxable), down payment, rate, and term. For quotes only — not a lender approval.
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
          <div className="form-row">
            <label className="form-label" htmlFor="calc-province">
              Customer province
            </label>
            <select
              id="calc-province"
              className="input"
              value={form.customerProvince}
              onChange={(e) => update("customerProvince", e.target.value)}
            >
              <option value="">Select province (defaults to Alberta)</option>
              {CANADIAN_PROVINCES_FOR_SELECT.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="form-hint">
              Used for GAP / warranty tax when marked taxable. Leave blank for Alberta (5% GST).
            </p>
          </div>
          <div className="form-row form-rowSplit">
            <TaxableProductRow
              id="calc-gap"
              label="Gap ($)"
              value={form.gap}
              taxable={form.gapTaxable}
              taxHint={productTaxHint}
              onValueChange={(v) => update("gap", v)}
              onTaxableChange={(v) => update("gapTaxable", v)}
            />
            <TaxableProductRow
              id="calc-warranty"
              label="Warranty ($)"
              value={form.warranty}
              taxable={form.warrantyTaxable}
              taxHint={productTaxHint}
              onValueChange={(v) => update("warranty", v)}
              onTaxableChange={(v) => update("warrantyTaxable", v)}
            />
          </div>
          <div className="form-row">
            <label className="form-label" htmlFor="calc-down">
              Down payment ($)
            </label>
            <input
              id="calc-down"
              className="input"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder="0"
              value={form.downPayment}
              onChange={(e) => update("downPayment", e.target.value)}
            />
            <p className="form-hint">Reduces the amount financed; does not affect gross.</p>
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

              <h3 className="admin-calcBreakdownHeading">Financed amount</h3>
              <div className="admin-calcBreakdown">
                <BreakdownRow label="Unit cost" value={formatMoney(result.cost)} />
                <BreakdownRow label="Markup" value={formatMoney(result.markup)} />
                <BreakdownRow label="Pack" value={formatMoney(result.pack)} />
                {result.gap.base > 0 || result.gap.salesTax > 0 ? (
                  <>
                    <BreakdownRow label="GAP" value={formatMoney(result.gap.base)} />
                    {result.gap.salesTax > 0 ? (
                      <BreakdownRow
                        label={`GAP ${result.gap.taxLabel}`}
                        value={formatMoney(result.gap.salesTax)}
                      />
                    ) : null}
                  </>
                ) : null}
                {result.warranty.base > 0 || result.warranty.salesTax > 0 ? (
                  <>
                    <BreakdownRow label="Warranty" value={formatMoney(result.warranty.base)} />
                    {result.warranty.salesTax > 0 ? (
                      <BreakdownRow
                        label={`Warranty ${result.warranty.taxLabel}`}
                        value={formatMoney(result.warranty.salesTax)}
                      />
                    ) : null}
                  </>
                ) : null}
                <BreakdownRow label="Subtotal" value={formatMoney(result.subtotalBeforeDown)} />
                {result.downPayment > 0 ? (
                  <BreakdownRow label="Down payment" value={formatDeduction(result.downPayment)} deduct />
                ) : null}
                <BreakdownRow label="Amount financed" value={formatMoney(result.principal)} total />
              </div>

              <h3 className="admin-calcBreakdownHeading">Loan</h3>
              <div className="admin-calcBreakdown">
                <BreakdownRow label="Number of payments" value={formatNum(result.numPayments, 0)} />
                <BreakdownRow
                  label="Term"
                  value={`${form.termMonths} mo @ ${form.paymentsPerYear}/yr`}
                />
                <BreakdownRow label="Rate" value={`${formatNum(Number(form.annualInterestPercent), 2)}% annual`} />
                <BreakdownRow label="Total paid" value={formatMoney(result.totalPaid)} />
                <BreakdownRow label="Total interest" value={formatMoney(result.totalInterest)} />
              </div>

              <h3 className="admin-calcBreakdownHeading">Gross</h3>
              <p className="admin-calcGrossHint">
                Enter product cost beside GAP or warranty — gross uses sale amount minus cost.
              </p>
              <div className="admin-calcBreakdown">
                <BreakdownRow label="Markup" value={formatMoney(result.markup)} />
                <BreakdownRow label="Pack" value={formatMoney(result.pack)} />
                {result.gap.base > 0 || result.gapCost > 0 ? (
                  <GrossProductBlock
                    productLabel="GAP"
                    saleAmount={result.gap.base}
                    costId="calc-gap-cost"
                    costValue={gapCost}
                    grossAmount={result.gapGross}
                    onCostChange={setGapCost}
                  />
                ) : null}
                {result.warranty.base > 0 || result.warrantyCost > 0 ? (
                  <GrossProductBlock
                    productLabel="Warranty"
                    saleAmount={result.warranty.base}
                    costId="calc-warranty-cost"
                    costValue={warrantyCost}
                    grossAmount={result.warrantyGross}
                    onCostChange={setWarrantyCost}
                  />
                ) : null}
                <BreakdownRow label="Total gross" value={formatMoney(result.totalGross)} total />
              </div>
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
