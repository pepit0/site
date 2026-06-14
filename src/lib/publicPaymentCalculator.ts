import {
  getProvinceTaxProfile,
  provincialSalesTaxAmount,
  resolveProvinceCode,
  roundTaxMoney,
  type ProvinceCode
} from "../data/canadianProvincialTax";
import { paymentPerPeriodFromPrincipal } from "./adminPaymentCalculator";

export const PUBLIC_DEALER_PACK = 2000;
export const PUBLIC_FINANCE_CHARGE = 1000;
export const PUBLIC_DEFAULT_APR = 6.99;
export const PUBLIC_MONTHLY_PAYMENTS_PER_YEAR = 12;
export const PUBLIC_BIWEEKLY_PAYMENTS_PER_YEAR = 26;
export const PUBLIC_TERM_OPTIONS = [12, 24, 36, 48, 60, 72, 84] as const;

export type PublicTermMonths = (typeof PUBLIC_TERM_OPTIONS)[number];

export type PublicPaymentCalculatorInput = {
  unitPrice: number;
  termMonths: PublicTermMonths;
  province: string;
};

export type PublicPaymentSchedule = {
  payment: number;
  numPayments: number;
  totalPaid: number;
  totalInterest: number;
};

export type PublicPaymentCalculatorSuccess = {
  ok: true;
  provinceCode: ProvinceCode;
  taxLabel: string;
  unitPrice: number;
  pack: number;
  financeCharge: number;
  preTaxSubtotal: number;
  salesTax: number;
  amountFinanced: number;
  termMonths: PublicTermMonths;
  annualRatePercent: number;
  monthly: PublicPaymentSchedule;
  biWeekly: PublicPaymentSchedule;
};

export type PublicPaymentCalculatorResult = PublicPaymentCalculatorSuccess | { ok: false; error: string };

function paymentSchedule(
  amountFinanced: number,
  termMonths: number,
  paymentsPerYear: number
): PublicPaymentSchedule | { error: string } {
  const numPayments = termMonths * (paymentsPerYear / 12);
  if (!Number.isFinite(numPayments) || numPayments <= 0) {
    return { error: "Could not determine a valid number of payments." };
  }

  const periodicRate = PUBLIC_DEFAULT_APR / 100 / paymentsPerYear;
  const payment = roundTaxMoney(paymentPerPeriodFromPrincipal(amountFinanced, periodicRate, numPayments));

  if (!Number.isFinite(payment)) {
    return { error: "Could not calculate payment with these values." };
  }

  const totalPaid = roundTaxMoney(payment * numPayments);
  const totalInterest = roundTaxMoney(Math.max(0, totalPaid - amountFinanced));

  return { payment, numPayments, totalPaid, totalInterest };
}

export function calculatePublicPayment(input: PublicPaymentCalculatorInput): PublicPaymentCalculatorResult {
  if (!Number.isFinite(input.unitPrice) || input.unitPrice <= 0) {
    return { ok: false, error: "Enter a unit price above zero." };
  }

  if (!PUBLIC_TERM_OPTIONS.includes(input.termMonths)) {
    return { ok: false, error: "Pick a term length." };
  }

  const unitPrice = roundTaxMoney(input.unitPrice);
  const pack = PUBLIC_DEALER_PACK;
  const financeCharge = PUBLIC_FINANCE_CHARGE;
  const preTaxSubtotal = roundTaxMoney(unitPrice + pack + financeCharge);
  const salesTax = provincialSalesTaxAmount(unitPrice, input.province);
  const profile = getProvinceTaxProfile(input.province);
  const provinceCode = resolveProvinceCode(input.province);
  const amountFinanced = roundTaxMoney(preTaxSubtotal + salesTax);

  const monthly = paymentSchedule(amountFinanced, input.termMonths, PUBLIC_MONTHLY_PAYMENTS_PER_YEAR);
  if ("error" in monthly) return { ok: false, error: monthly.error };

  const biWeekly = paymentSchedule(amountFinanced, input.termMonths, PUBLIC_BIWEEKLY_PAYMENTS_PER_YEAR);
  if ("error" in biWeekly) return { ok: false, error: biWeekly.error };

  return {
    ok: true,
    provinceCode,
    taxLabel: profile.taxLabel,
    unitPrice,
    pack,
    financeCharge,
    preTaxSubtotal,
    salesTax,
    amountFinanced,
    termMonths: input.termMonths,
    annualRatePercent: PUBLIC_DEFAULT_APR,
    monthly,
    biWeekly
  };
}

export function parsePublicPriceField(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "").replace(/^\$/, "");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}
