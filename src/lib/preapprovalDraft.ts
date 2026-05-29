/** In-progress pre-approval wizard (localStorage + optional partial queue sync). */

import type { PreapprovalErasedFields } from "./preapprovalErasedFields";
import { createEmptyErasedFields } from "./preapprovalErasedFields";

export const PREAPPROVAL_DRAFT_CHANGED_EVENT = "tm-preapproval-draft-changed";

const STORAGE_KEY = "tm_preapproval_draft_v4";
const SUBMITTED_SESSION_KEY = "tm_preapproval_submitted_v1";
const DRAFT_VERSION = 4;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type PreapprovalTradeIntent = "unset" | "no" | "yes";

export type PreapprovalWizardState = {
  vehicleInterest: string;
  hasChosenVehicle: boolean;
  monthlyBudgetCad: number;
  tradeIntent: PreapprovalTradeIntent;
  tradeYear: string;
  tradeMake: string;
  tradeModel: string;
  tradeKms: string;
  employmentStatus: string;
  employmentOtherDescription: string;
  employmentType: string;
  mainIncome: string;
  incomeTenureBand: string;
  incomeTenureYears: string;
  incomeTenureMonths: string;
  otherIncome: string;
  otherIncomeDescription: string;
  employer: string;
  jobTitle: string;
  creditScoreBand: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dob: string;
  street: string;
  unit: string;
  city: string;
  province: string;
  addressTenureBand: string;
  addressTenureYears: string;
  addressTenureMonths: string;
  sin: string;
  downPaymentBand: string;
  coApplicantIntent: string;
  consentContact: boolean;
  consentCredit: boolean;
};

export type PreapprovalDraft = {
  version: number;
  savedAt: number;
  step: number;
  skipVehicleStep: boolean;
  marketingLeadId: string | null;
  erasedFields: PreapprovalErasedFields;
  wizard: PreapprovalWizardState;
};

function dispatchDraftChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PREAPPROVAL_DRAFT_CHANGED_EVENT));
}

function isTradeIntent(v: unknown): v is PreapprovalTradeIntent {
  return v === "unset" || v === "no" || v === "yes";
}

function parseErasedFields(raw: unknown): PreapprovalErasedFields {
  if (!raw || typeof raw !== "object") return createEmptyErasedFields();
  const out: PreapprovalErasedFields = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim().length > 0) out[k] = v;
  }
  return out;
}

function parseWizard(raw: unknown): PreapprovalWizardState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isTradeIntent(o.tradeIntent)) return null;
  if (typeof o.vehicleInterest !== "string") return null;
  if (typeof o.hasChosenVehicle !== "boolean") return null;
  if (typeof o.monthlyBudgetCad !== "number" || !Number.isFinite(o.monthlyBudgetCad)) return null;
  const str = (key: string) => (typeof o[key] === "string" ? (o[key] as string) : null);
  const bool = (key: string) => (typeof o[key] === "boolean" ? (o[key] as boolean) : null);
  const stringFields = [
    "tradeYear",
    "tradeMake",
    "tradeModel",
    "tradeKms",
    "employmentStatus",
    "employmentOtherDescription",
    "employmentType",
    "mainIncome",
    "otherIncome",
    "otherIncomeDescription",
    "employer",
    "jobTitle",
    "creditScoreBand",
    "firstName",
    "lastName",
    "phone",
    "email",
    "dob",
    "street",
    "unit",
    "city",
    "province",
    "addressTenureYears",
    "addressTenureMonths"
  ] as const;
  const strings: Record<string, string> = {};
  for (const key of stringFields) {
    const v = str(key);
    if (v === null) return null;
    strings[key] = v;
  }
  const consentContact = bool("consentContact");
  const consentCredit = bool("consentCredit");
  if (consentContact === null || consentCredit === null) return null;

  return {
    vehicleInterest: o.vehicleInterest as string,
    hasChosenVehicle: o.hasChosenVehicle as boolean,
    monthlyBudgetCad: o.monthlyBudgetCad as number,
    tradeIntent: o.tradeIntent,
    tradeYear: strings.tradeYear,
    tradeMake: strings.tradeMake,
    tradeModel: strings.tradeModel,
    tradeKms: strings.tradeKms,
    employmentStatus: strings.employmentStatus,
    employmentOtherDescription: strings.employmentOtherDescription,
    employmentType: strings.employmentType,
    mainIncome: strings.mainIncome,
    incomeTenureBand: str("incomeTenureBand") ?? "",
    incomeTenureYears: str("incomeTenureYears") || "0",
    incomeTenureMonths: str("incomeTenureMonths") || "0",
    otherIncome: strings.otherIncome,
    otherIncomeDescription: strings.otherIncomeDescription,
    employer: strings.employer,
    jobTitle: strings.jobTitle,
    creditScoreBand: strings.creditScoreBand,
    firstName: strings.firstName,
    lastName: strings.lastName,
    phone: strings.phone,
    email: strings.email,
    dob: strings.dob,
    street: strings.street,
    unit: strings.unit,
    city: strings.city,
    province: strings.province,
    addressTenureBand: str("addressTenureBand") ?? "",
    addressTenureYears: strings.addressTenureYears || "0",
    addressTenureMonths: strings.addressTenureMonths || "0",
    sin: str("sin") ?? "",
    downPaymentBand: str("downPaymentBand") ?? "",
    coApplicantIntent: str("coApplicantIntent") ?? "",
    consentContact,
    consentCredit
  };
}

function normalizeStep(step: number): number {
  let s = step;
  if (s > 4) s = 4;
  if (s >= 3) s -= 1;
  if (s >= 1) s -= 1;
  if (s >= 1) s += 1;
  return Math.min(s, 4);
}

function readRaw(): PreapprovalDraft | null {
  if (typeof window === "undefined") return null;
  try {
    let raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = window.localStorage.getItem("tm_preapproval_draft_v3");
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PreapprovalDraft & { version?: number };
    const version = parsed?.version ?? 0;
    if (!parsed || (version !== DRAFT_VERSION && version !== 3) || typeof parsed.savedAt !== "number") {
      return null;
    }
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem("tm_preapproval_draft_v3");
      return null;
    }
    if (typeof parsed.step !== "number" || parsed.step < 0) return null;
    const step = normalizeStep(parsed.step);
    if (typeof parsed.skipVehicleStep !== "boolean") return null;
    const wizard = parseWizard(parsed.wizard);
    if (!wizard) return null;
    const mergedWizard = {
      ...wizard,
      consentCredit: wizard.consentCredit || wizard.consentContact
    };
    const marketingLeadId =
      typeof parsed.marketingLeadId === "string" && parsed.marketingLeadId.length > 0
        ? parsed.marketingLeadId
        : null;
    return {
      version: DRAFT_VERSION,
      savedAt: parsed.savedAt,
      step,
      skipVehicleStep: parsed.skipVehicleStep,
      marketingLeadId,
      erasedFields: parseErasedFields(parsed.erasedFields),
      wizard: mergedWizard
    };
  } catch {
    return null;
  }
}

const DEFAULT_BUDGET = 600;

function isMeaningfulDraft(draft: PreapprovalDraft): boolean {
  const w = draft.wizard;
  if (draft.step > 0) return true;
  if (w.hasChosenVehicle) return true;
  if (w.employmentStatus) return true;
  if (w.creditScoreBand) return true;
  if (w.firstName.trim() || w.lastName.trim() || w.phone.trim() || w.email.trim()) return true;
  if (w.dob.trim() || w.street.trim() || w.city.trim() || w.province.trim()) return true;
  if (w.addressTenureBand) return true;
  if (w.addressTenureYears !== "0" || w.addressTenureMonths !== "0") return true;
  if (w.downPaymentBand || w.coApplicantIntent) return true;
  if (w.incomeTenureYears !== "0" || w.incomeTenureMonths !== "0") return true;
  if (w.sin.trim()) return true;
  if (w.mainIncome.trim() || w.otherIncome.trim()) return true;
  if (w.monthlyBudgetCad !== DEFAULT_BUDGET) return true;
  if (w.consentContact || w.consentCredit) return true;
  return false;
}

function isSubmittedThisSession(): boolean {
  try {
    return sessionStorage.getItem(SUBMITTED_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** After a successful submit — clears storage and blocks draft restore this session. */
export function finishPreapprovalApplication(): void {
  clearPreapprovalDraft();
  try {
    sessionStorage.setItem(SUBMITTED_SESSION_KEY, "1");
  } catch {
    /* private mode / blocked storage */
  }
}

export function readPreapprovalDraft(): PreapprovalDraft | null {
  if (isSubmittedThisSession()) return null;
  return readRaw();
}

export function hasResumablePreapprovalDraft(): boolean {
  const draft = readRaw();
  return draft != null && isMeaningfulDraft(draft);
}

export function savePreapprovalDraft(draft: Omit<PreapprovalDraft, "version" | "savedAt">): void {
  if (typeof window === "undefined") return;
  const payload: PreapprovalDraft = {
    version: DRAFT_VERSION,
    savedAt: Date.now(),
    step: draft.step,
    skipVehicleStep: draft.skipVehicleStep,
    marketingLeadId: draft.marketingLeadId,
    erasedFields: draft.erasedFields,
    wizard: draft.wizard
  };
  if (!isMeaningfulDraft(payload)) {
    clearPreapprovalDraft();
    return;
  }
  try {
    sessionStorage.removeItem(SUBMITTED_SESSION_KEY);
    window.localStorage.removeItem("tm_preapproval_draft_v3");
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    dispatchDraftChanged();
  } catch {
    /* quota / private mode */
  }
}

export function clearPreapprovalDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem("tm_preapproval_draft_v3");
    dispatchDraftChanged();
  } catch {
    /* private mode */
  }
}
