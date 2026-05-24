/** Canadian provincial sales tax profiles for taxable GAP / warranty (estimates). */

export const DEFAULT_PROVINCE_CODE = "AB" as const;

export type ProvinceCode =
  | "AB"
  | "BC"
  | "MB"
  | "NB"
  | "NL"
  | "NS"
  | "NT"
  | "NU"
  | "ON"
  | "PE"
  | "QC"
  | "SK"
  | "YT";

type TaxMode = "gst_only" | "gst_pst" | "hst" | "gst_qst";

export type ProvinceTaxProfile = {
  code: ProvinceCode;
  name: string;
  taxMode: TaxMode;
  gstRate: number;
  pstOrHstRate: number;
  taxLabel: string;
  taxHint: string;
};

const PROVINCES: ProvinceTaxProfile[] = [
  {
    code: "AB",
    name: "Alberta",
    taxMode: "gst_only",
    gstRate: 0.05,
    pstOrHstRate: 0,
    taxLabel: "GST (5%)",
    taxHint: "5% GST"
  },
  {
    code: "BC",
    name: "British Columbia",
    taxMode: "gst_pst",
    gstRate: 0.05,
    pstOrHstRate: 0.07,
    taxLabel: "GST + PST (12%)",
    taxHint: "5% GST + 7% PST"
  },
  {
    code: "MB",
    name: "Manitoba",
    taxMode: "gst_pst",
    gstRate: 0.05,
    pstOrHstRate: 0.07,
    taxLabel: "GST + RST (12%)",
    taxHint: "5% GST + 7% RST"
  },
  {
    code: "NB",
    name: "New Brunswick",
    taxMode: "hst",
    gstRate: 0,
    pstOrHstRate: 0.15,
    taxLabel: "HST (15%)",
    taxHint: "15% HST"
  },
  {
    code: "NL",
    name: "Newfoundland and Labrador",
    taxMode: "hst",
    gstRate: 0,
    pstOrHstRate: 0.15,
    taxLabel: "HST (15%)",
    taxHint: "15% HST"
  },
  {
    code: "NS",
    name: "Nova Scotia",
    taxMode: "hst",
    gstRate: 0,
    pstOrHstRate: 0.14,
    taxLabel: "HST (14%)",
    taxHint: "14% HST"
  },
  {
    code: "NT",
    name: "Northwest Territories",
    taxMode: "gst_only",
    gstRate: 0.05,
    pstOrHstRate: 0,
    taxLabel: "GST (5%)",
    taxHint: "5% GST"
  },
  {
    code: "NU",
    name: "Nunavut",
    taxMode: "gst_only",
    gstRate: 0.05,
    pstOrHstRate: 0,
    taxLabel: "GST (5%)",
    taxHint: "5% GST"
  },
  {
    code: "ON",
    name: "Ontario",
    taxMode: "hst",
    gstRate: 0,
    pstOrHstRate: 0.13,
    taxLabel: "HST (13%)",
    taxHint: "13% HST"
  },
  {
    code: "PE",
    name: "Prince Edward Island",
    taxMode: "hst",
    gstRate: 0,
    pstOrHstRate: 0.15,
    taxLabel: "HST (15%)",
    taxHint: "15% HST"
  },
  {
    code: "QC",
    name: "Quebec",
    taxMode: "gst_qst",
    gstRate: 0.05,
    pstOrHstRate: 0.09975,
    taxLabel: "GST + QST",
    taxHint: "5% GST + 9.975% QST (QST on amount incl. GST)"
  },
  {
    code: "SK",
    name: "Saskatchewan",
    taxMode: "gst_pst",
    gstRate: 0.05,
    pstOrHstRate: 0.06,
    taxLabel: "GST + PST (11%)",
    taxHint: "5% GST + 6% PST"
  },
  {
    code: "YT",
    name: "Yukon",
    taxMode: "gst_only",
    gstRate: 0.05,
    pstOrHstRate: 0,
    taxLabel: "GST (5%)",
    taxHint: "5% GST"
  }
];

const BY_CODE = new Map<ProvinceCode, ProvinceTaxProfile>(PROVINCES.map((p) => [p.code, p]));

export const CANADIAN_PROVINCES_FOR_SELECT = [...PROVINCES].sort((a, b) => a.name.localeCompare(b.name));

export function resolveProvinceCode(raw: string): ProvinceCode {
  const t = raw.trim().toUpperCase();
  if (!t) return DEFAULT_PROVINCE_CODE;
  return BY_CODE.has(t as ProvinceCode) ? (t as ProvinceCode) : DEFAULT_PROVINCE_CODE;
}

export function getProvinceTaxProfile(raw: string): ProvinceTaxProfile {
  return BY_CODE.get(resolveProvinceCode(raw)) ?? BY_CODE.get(DEFAULT_PROVINCE_CODE)!;
}

export function roundTaxMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Sales tax on a taxable product amount for the given province. */
export function provincialSalesTaxAmount(base: number, provinceRaw: string): number {
  const b = roundTaxMoney(base);
  if (b <= 0) return 0;

  const profile = getProvinceTaxProfile(provinceRaw);

  switch (profile.taxMode) {
    case "gst_only":
      return roundTaxMoney(b * profile.gstRate);
    case "gst_pst":
      return roundTaxMoney(b * profile.gstRate + b * profile.pstOrHstRate);
    case "hst":
      return roundTaxMoney(b * profile.pstOrHstRate);
    case "gst_qst": {
      const gst = roundTaxMoney(b * profile.gstRate);
      const qst = roundTaxMoney((b + gst) * profile.pstOrHstRate);
      return roundTaxMoney(gst + qst);
    }
    default:
      return 0;
  }
}
