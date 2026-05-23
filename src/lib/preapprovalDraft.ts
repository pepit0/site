/** In-progress pre-approval wizard (browser localStorage only — not sent until submit). */

export const PREAPPROVAL_DRAFT_CHANGED_EVENT = "tm-preapproval-draft-changed";

const STORAGE_KEY = "tm_preapproval_draft_v2";
const DRAFT_VERSION = 2;
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
  addressTenure: string;
  consentContact: boolean;
  consentCredit: boolean;
};

export type PreapprovalDraft = {
  version: number;
  savedAt: number;
  step: number;
  skipVehicleStep: boolean;
  wizard: PreapprovalWizardState;
};

function dispatchDraftChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PREAPPROVAL_DRAFT_CHANGED_EVENT));
}

function isTradeIntent(v: unknown): v is PreapprovalTradeIntent {
  return v === "unset" || v === "no" || v === "yes";
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
    "addressTenure"
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
    addressTenure: strings.addressTenure,
    consentContact,
    consentCredit
  };
}

function readRaw(): PreapprovalDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PreapprovalDraft;
    if (!parsed || parsed.version !== DRAFT_VERSION || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (typeof parsed.step !== "number" || parsed.step < 0) return null;
    const step = parsed.step > 6 ? 5 : parsed.step > 5 ? 5 : parsed.step;
    if (typeof parsed.skipVehicleStep !== "boolean") return null;
    const wizard = parseWizard(parsed.wizard);
    if (!wizard) return null;
    const mergedWizard = {
      ...wizard,
      consentCredit: wizard.consentCredit || wizard.consentContact
    };
    return {
      version: DRAFT_VERSION,
      savedAt: parsed.savedAt,
      step,
      skipVehicleStep: parsed.skipVehicleStep,
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
  if (w.tradeIntent !== "unset") return true;
  if (w.employmentStatus) return true;
  if (w.creditScoreBand) return true;
  if (w.firstName.trim() || w.lastName.trim() || w.phone.trim() || w.email.trim()) return true;
  if (w.dob.trim() || w.street.trim() || w.city.trim() || w.province.trim()) return true;
  if (w.addressTenure) return true;
  if (w.mainIncome.trim() || w.otherIncome.trim()) return true;
  if (w.monthlyBudgetCad !== DEFAULT_BUDGET) return true;
  if (w.consentContact || w.consentCredit) return true;
  return false;
}

export function readPreapprovalDraft(): PreapprovalDraft | null {
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
    wizard: draft.wizard
  };
  if (!isMeaningfulDraft(payload)) {
    clearPreapprovalDraft();
    return;
  }
  try {
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
    dispatchDraftChanged();
  } catch {
    /* private mode */
  }
}
