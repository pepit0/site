export type AdminPaymentCalculatorInput = {
  cost: number;
  markup: number;
  pack: number;
  gap: number;
  warranty: number;
  annualInterestPercent: number;
  paymentsPerYear: number;
  termMonths: number;
};

export type AdminPaymentCalculatorResult =
  | {
      ok: true;
      principal: number;
      paymentPerPeriod: number;
      numPayments: number;
      periodicRate: number;
    }
  | {
      ok: false;
      error: string;
    };

function parseNonNegative(value: number, label: string): string | null {
  if (!Number.isFinite(value)) return `${label} must be a valid number.`;
  if (value < 0) return `${label} must be zero or greater.`;
  return null;
}

export function calculateAdminPayment(input: AdminPaymentCalculatorInput): AdminPaymentCalculatorResult {
  const costErr = parseNonNegative(input.cost, "Cost");
  if (costErr) return { ok: false, error: costErr };

  for (const [value, label] of [
    [input.markup, "Markup"],
    [input.pack, "Pack"],
    [input.gap, "Gap"],
    [input.warranty, "Warranty"],
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

  const principal = input.cost + input.markup + input.pack + input.gap + input.warranty;
  const numPayments = input.termMonths * (input.paymentsPerYear / 12);

  if (!Number.isFinite(numPayments) || numPayments <= 0) {
    return { ok: false, error: "Could not determine a valid number of payments." };
  }

  const periodicRate = input.annualInterestPercent / 100 / input.paymentsPerYear;

  let paymentPerPeriod: number;
  if (periodicRate === 0) {
    paymentPerPeriod = principal / numPayments;
  } else {
    const factor = Math.pow(1 + periodicRate, numPayments);
    paymentPerPeriod = (principal * periodicRate * factor) / (factor - 1);
  }

  if (!Number.isFinite(paymentPerPeriod)) {
    return { ok: false, error: "Could not calculate payment with these values." };
  }

  return {
    ok: true,
    principal,
    paymentPerPeriod,
    numPayments,
    periodicRate
  };
}

export function parseMoneyField(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}
