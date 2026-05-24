import {
  getProvinceTaxProfile,
  provincialSalesTaxAmount,
  resolveProvinceCode,
  roundTaxMoney,
  type ProvinceCode
} from "../data/canadianProvincialTax";

/** @deprecated Use provincial tax via customerProvince; kept for any legacy imports. */
export const AB_GST_RATE = 0.05;

export type AdminPaymentCalculatorInput = {
  cost: number;
  markup: number;
  pack: number;
  gap: number;
  gapTaxable: boolean;
  warranty: number;
  warrantyTaxable: boolean;
  /** Empty string defaults to Alberta. */
  customerProvince: string;
  downPayment: number;
  gapCost: number;
  warrantyCost: number;
  annualInterestPercent: number;
  paymentsPerYear: number;
  termMonths: number;
};

export type TaxedAmount = {
  base: number;
  salesTax: number;
  total: number;
  taxLabel: string;
};

export type AdminPaymentCalculatorSuccess = {
  ok: true;
  customerProvince: ProvinceCode;
  provinceTaxLabel: string;
  principal: number;
  paymentPerPeriod: number;
  numPayments: number;
  periodicRate: number;
  totalPaid: number;
  totalInterest: number;
  subtotalBeforeDown: number;
  downPayment: number;
  cost: number;
  markup: number;
  pack: number;
  gap: TaxedAmount;
  warranty: TaxedAmount;
  gapCost: number;
  warrantyCost: number;
  gapGross: number;
  warrantyGross: number;
  totalGross: number;
};

export type AdminPaymentCalculatorResult = AdminPaymentCalculatorSuccess | { ok: false; error: string };

function parseNonNegative(value: number, label: string): string | null {
  if (!Number.isFinite(value)) return `${label} must be a valid number.`;
  if (value < 0) return `${label} must be zero or greater.`;
  return null;
}

export function roundMoney(n: number): number {
  return roundTaxMoney(n);
}

export function applyProvincialSalesTax(
  base: number,
  taxable: boolean,
  customerProvince: string
): TaxedAmount {
  const profile = getProvinceTaxProfile(customerProvince);
  const b = roundMoney(base);
  const salesTax = taxable ? provincialSalesTaxAmount(b, customerProvince) : 0;
  return {
    base: b,
    salesTax,
    total: roundMoney(b + salesTax),
    taxLabel: profile.taxLabel
  };
}

/**
 * Periodic payment for an ordinary annuity (payment at end of each period).
 * PMT = P × [r(1+r)^n] / [(1+r)^n − 1]
 */
export function paymentPerPeriodFromPrincipal(
  principal: number,
  periodicRate: number,
  numPayments: number
): number {
  if (principal <= 0) return 0;
  if (periodicRate === 0) return principal / numPayments;
  const factor = Math.pow(1 + periodicRate, numPayments);
  return (principal * periodicRate * factor) / (factor - 1);
}

export function calculateAdminPayment(input: AdminPaymentCalculatorInput): AdminPaymentCalculatorResult {
  const costErr = parseNonNegative(input.cost, "Cost");
  if (costErr) return { ok: false, error: costErr };

  for (const [value, label] of [
    [input.markup, "Markup"],
    [input.pack, "Pack"],
    [input.gap, "Gap"],
    [input.warranty, "Warranty"],
    [input.downPayment, "Down payment"],
    [input.gapCost, "GAP cost"],
    [input.warrantyCost, "Warranty cost"],
    [input.annualInterestPercent, "Interest rate"]
  ] as const) {
    const err = parseNonNegative(value, label);
    if (err) return { ok: false, error: err };
  }

  if (!Number.isFinite(input.paymentsPerYear) || input.paymentsPerYear <= 0) {
    return { ok: false, error: "Payments per year must be greater than zero." };
  }

  if (!Number.isFinite(input.termMonths) || input.termMonths <= 0) {
    return { ok: false, error: "Term must be greater than zero months." };
  }

  const customerProvince = resolveProvinceCode(input.customerProvince);
  const provinceProfile = getProvinceTaxProfile(input.customerProvince);

  const gap = applyProvincialSalesTax(input.gap, input.gapTaxable, input.customerProvince);
  const warranty = applyProvincialSalesTax(input.warranty, input.warrantyTaxable, input.customerProvince);

  const subtotalBeforeDown = roundMoney(
    input.cost + input.markup + input.pack + gap.total + warranty.total
  );

  if (input.downPayment > subtotalBeforeDown) {
    return { ok: false, error: "Down payment cannot exceed the amount before down payment." };
  }

  const principal = roundMoney(subtotalBeforeDown - input.downPayment);

  const numPayments = input.termMonths * (input.paymentsPerYear / 12);

  if (!Number.isFinite(numPayments) || numPayments <= 0) {
    return { ok: false, error: "Could not determine a valid number of payments." };
  }

  const periodicRate = input.annualInterestPercent / 100 / input.paymentsPerYear;

  const paymentPerPeriod = roundMoney(
    paymentPerPeriodFromPrincipal(principal, periodicRate, numPayments)
  );

  if (!Number.isFinite(paymentPerPeriod)) {
    return { ok: false, error: "Could not calculate payment with these values." };
  }

  const totalPaid = roundMoney(paymentPerPeriod * numPayments);
  const totalInterest = roundMoney(Math.max(0, totalPaid - principal));

  const gapCost = roundMoney(input.gapCost);
  const warrantyCost = roundMoney(input.warrantyCost);
  const gapGross = roundMoney(gap.base - gapCost);
  const warrantyGross = roundMoney(warranty.base - warrantyCost);
  const totalGross = roundMoney(input.markup + input.pack + gapGross + warrantyGross);

  return {
    ok: true,
    customerProvince,
    provinceTaxLabel: provinceProfile.taxLabel,
    principal,
    paymentPerPeriod,
    numPayments,
    periodicRate,
    totalPaid,
    totalInterest,
    subtotalBeforeDown,
    downPayment: roundMoney(input.downPayment),
    cost: roundMoney(input.cost),
    markup: roundMoney(input.markup),
    pack: roundMoney(input.pack),
    gap,
    warranty,
    gapCost,
    warrantyCost,
    gapGross,
    warrantyGross,
    totalGross
  };
}

export function parseMoneyField(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}
