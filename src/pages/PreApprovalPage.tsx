import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { VehicleCategoryPhoto } from "../components/VehicleCategoryPhoto";
import {
  PREAPPROVAL_CONSENT_FOOTNOTE,
  PREAPPROVAL_CONSENT_LABEL,
  PREAPPROVAL_CREDIT_BAND_SUBTEXT,
  PREAPPROVAL_CREDIT_STEP,
  PREAPPROVAL_CTA,
  PREAPPROVAL_FAQ_INTRO,
  PREAPPROVAL_SEO,
  PREAPPROVAL_SUBMIT_LABEL,
  PREAPPROVAL_SUBMITTING_LABEL,
  PREAPPROVAL_WIZARD_INTRO,
  PREAPPROVAL_WIZARD_STEPS
} from "../data/preapprovalCopy";
import { PREAPPROVAL_FAQ, preapprovalFaqJsonLd } from "../data/preapprovalFaq";
import { CANADIAN_PROVINCES_FOR_SELECT } from "../data/canadianProvincialTax";
import { parseInventoryPublicRow, VEHICLE_CATEGORIES, type VehicleCategory } from "../data/inventory";
import { formatInventoryUnitInterest } from "../lib/inventoryUnitInterest";
import { normalizeNanpTo10Digits } from "../lib/phoneFormat";
import { markPreApprovalConversion } from "../lib/preapprovalConversion";
import preapprovalBg1 from "../assets/pre-approvalbg1.webp";
import preapprovalBg2 from "../assets/pre-approvalbg2.png";
import {
  applyErasedFieldChange,
  type PreapprovalErasedFields,
  type TrackedErasedField
} from "../lib/preapprovalErasedFields";
import {
  clearPreapprovalDraft,
  finishPreapprovalApplication,
  readPreapprovalDraft,
  savePreapprovalDraft,
  type PreapprovalWizardState
} from "../lib/preapprovalDraft";
import {
  cancelPartialPreapprovalQueue,
  isPartialPreapprovalEligible,
  syncPartialPreapprovalQueue,
  syncPartialPreapprovalQueueKeepalive
} from "../lib/syncPartialPreapproval";
import { submitPublicPreapprovalLead } from "../lib/submitPublicPreapprovalLead";
import { supabase } from "../lib/supabase";
import { Seo } from "../seo/Seo";

const TOTAL_STEPS = 5;

function PreapprovalProgressCheckIcon() {
  return (
    <svg className="preapproval-wizardProgressCheck" viewBox="0 0 16 16" width={11} height={11} aria-hidden>
      <path
        d="M3.25 8.25 6.5 11.5 12.75 4.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Slider $100–$1000 by $50, plus final stop $1000+ (stores 1001). */
const BUDGET_SLIDER_MIN = 100;
const BUDGET_SLIDER_MAX = 1000;
const BUDGET_STEP = 50;
const BUDGET_SENTINEL_OVER = 1001;
const BUDGET_OVER_POSITION = (BUDGET_SLIDER_MAX - BUDGET_SLIDER_MIN) / BUDGET_STEP + 1;

type EmploymentStatus = "employed" | "self_employed" | "retired_pension" | "other";

const EMPLOYMENT_STATUS_OPTIONS: { value: EmploymentStatus; label: string }[] = [
  { value: "employed", label: "Employed" },
  { value: "self_employed", label: "Self-employed" },
  { value: "retired_pension", label: "Retired" },
  { value: "other", label: "Disability/other" }
];

type IncomeTenureBand = "under_1" | "1_2" | "3_5" | "5_plus";

const INCOME_TENURE_OPTIONS: { value: IncomeTenureBand; label: string }[] = [
  { value: "under_1", label: "Under 1 year" },
  { value: "1_2", label: "1–2 years" },
  { value: "3_5", label: "3–5 years" },
  { value: "5_plus", label: "5+ years" }
];

type DownPaymentBand = "none" | "under_2000" | "2000_5000" | "5000_plus";

const DOWN_PAYMENT_OPTIONS: { value: DownPaymentBand; label: string }[] = [
  { value: "none", label: "None" },
  { value: "under_2000", label: "Under $2000" },
  { value: "2000_5000", label: "$2000–5000" },
  { value: "5000_plus", label: "$5000+" }
];

type CoApplicantIntent = "no" | "yes_maybe";

const CO_APPLICANT_OPTIONS: { value: CoApplicantIntent; label: string }[] = [
  { value: "no", label: "No co-applicant" },
  { value: "yes_maybe", label: "Yes / maybe" }
];

const MIN_APPLICANT_AGE = 16;
const MAX_APPLICANT_AGE = 100;

const CREDIT_BAND_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "excellent_750_plus", label: "Excellent", hint: "750+" },
  { value: "great_670_750", label: "Great", hint: "670–750" },
  { value: "good_620_670", label: "Good", hint: "620–670" },
  { value: "decent_550_619", label: "Decent", hint: "550–619" },
  { value: "poor_300_549", label: "Rebuilding", hint: "300–549" },
  { value: "not_sure", label: "I'm really not sure", hint: "No problem" }
];

const TENURE_YEARS_OVER = "30_plus";

type TradeIntent = "unset" | "no" | "yes";

type WizardState = {
  vehicleInterest: string;
  hasChosenVehicle: boolean;
  monthlyBudgetCad: number;
  tradeIntent: TradeIntent;
  tradeYear: string;
  tradeMake: string;
  tradeModel: string;
  tradeKms: string;
  employmentStatus: EmploymentStatus | "";
  employmentOtherDescription: string;
  employmentType: "" | "full_time" | "part_time";
  mainIncome: string;
  incomeTenureBand: IncomeTenureBand | "";
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
  addressTenureBand: IncomeTenureBand | "";
  addressTenureYears: string;
  addressTenureMonths: string;
  sin: string;
  downPaymentBand: DownPaymentBand | "";
  coApplicantIntent: CoApplicantIntent | "";
  consentContact: boolean;
  consentCredit: boolean;
};

function snapBudget(raw: number): number {
  const clamped = Math.min(BUDGET_SLIDER_MAX, Math.max(BUDGET_SLIDER_MIN, raw));
  const steps = Math.round((clamped - BUDGET_SLIDER_MIN) / BUDGET_STEP);
  return BUDGET_SLIDER_MIN + steps * BUDGET_STEP;
}

function budgetFromPosition(pos: number): number {
  if (pos >= BUDGET_OVER_POSITION) return BUDGET_SENTINEL_OVER;
  return BUDGET_SLIDER_MIN + pos * BUDGET_STEP;
}

function positionFromBudget(budget: number): number {
  if (budget === BUDGET_SENTINEL_OVER) return BUDGET_OVER_POSITION;
  return (snapBudget(budget) - BUDGET_SLIDER_MIN) / BUDGET_STEP;
}

function formatBudgetChoice(budget: number): string {
  if (budget === BUDGET_SENTINEL_OVER) return "$1000+";
  return `$${budget}`;
}

function normalizeEmploymentStatus(raw: string): EmploymentStatus | "" {
  switch (raw) {
    case "employed":
    case "self_employed":
    case "retired_pension":
      return raw;
    case "disability_pension":
    case "aish":
    case "unemployed":
    case "student":
    case "spousal_income":
    case "other":
      return "other";
    default:
      return "";
  }
}

function incomeTenureBandFromLegacy(years: string, months: string): IncomeTenureBand | "" {
  if (years === TENURE_YEARS_OVER) return "5_plus";
  const y = Number.parseInt(years, 10);
  const m = Number.parseInt(months, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return "";
  const totalMonths = y * 12 + m;
  if (totalMonths < 12) return "under_1";
  if (totalMonths <= 24) return "1_2";
  if (totalMonths <= 60) return "3_5";
  return "5_plus";
}

function formatIncomeTenureBand(band: IncomeTenureBand | ""): string {
  const match = INCOME_TENURE_OPTIONS.find((o) => o.value === band);
  return match?.label ?? "";
}

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function birthDateInputBounds(): { min: string; max: string } {
  const max = new Date();
  max.setFullYear(max.getFullYear() - MIN_APPLICANT_AGE);
  const min = new Date();
  min.setFullYear(min.getFullYear() - MAX_APPLICANT_AGE);
  return { min: isoDateLocal(min), max: isoDateLocal(max) };
}

function birthDateValidationMessage(iso: string): string | null {
  if (!iso.trim()) return "Enter your date of birth.";
  const { min, max } = birthDateInputBounds();
  if (iso < min || iso > max) {
    return `Enter a valid date of birth (age ${MIN_APPLICANT_AGE}–${MAX_APPLICANT_AGE}).`;
  }
  return null;
}

function formatDownPaymentBand(band: DownPaymentBand | ""): string {
  const match = DOWN_PAYMENT_OPTIONS.find((o) => o.value === band);
  return match?.label ?? "";
}

function formatCoApplicantIntent(intent: CoApplicantIntent | ""): string {
  const match = CO_APPLICANT_OPTIONS.find((o) => o.value === intent);
  return match?.label ?? "";
}

function formatContactStepNotes(w: WizardState): string {
  const parts = [formatIncomeTenureBand(w.addressTenureBand)];
  if (w.downPaymentBand) parts.push(`Down payment: ${formatDownPaymentBand(w.downPaymentBand)}`);
  if (w.coApplicantIntent) parts.push(`Co-applicant: ${formatCoApplicantIntent(w.coApplicantIntent)}`);
  return parts.filter(Boolean).join(" · ");
}

function requiresEmploymentType(status: EmploymentStatus | ""): boolean {
  return status === "employed";
}

function requiresEmployerAndTitle(status: EmploymentStatus | ""): boolean {
  return status === "employed" || status === "self_employed";
}

function selectEmploymentStatus(
  prev: WizardState,
  status: EmploymentStatus
): WizardState {
  return {
    ...prev,
    employmentStatus: status,
    employmentOtherDescription: status === "other" ? prev.employmentOtherDescription : "",
    employmentType: requiresEmploymentType(status) ? prev.employmentType : "",
    employer: requiresEmployerAndTitle(status) ? prev.employer : "",
    jobTitle: requiresEmployerAndTitle(status) ? prev.jobTitle : ""
  };
}

function loadInitialFromDraft(): {
  step: number;
  skipVehicleStep: boolean;
  marketingLeadId: string | null;
  erasedFields: PreapprovalErasedFields;
  wizard: WizardState;
} | null {
  const draft = readPreapprovalDraft();
  if (!draft) return null;
  const w = draft.wizard;
  return {
    step: draft.step,
    skipVehicleStep: draft.skipVehicleStep,
    marketingLeadId: draft.marketingLeadId,
    erasedFields: draft.erasedFields,
    wizard: {
      ...w,
      employmentStatus: normalizeEmploymentStatus(w.employmentStatus),
      employmentType: w.employmentType as WizardState["employmentType"],
      incomeTenureBand:
        (w.incomeTenureBand as IncomeTenureBand | "") ||
        incomeTenureBandFromLegacy(w.incomeTenureYears, w.incomeTenureMonths),
      addressTenureBand:
        (w.addressTenureBand as IncomeTenureBand | "") ||
        incomeTenureBandFromLegacy(w.addressTenureYears, w.addressTenureMonths),
      downPaymentBand: (w.downPaymentBand as DownPaymentBand | "") ?? "",
      coApplicantIntent: (w.coApplicantIntent as CoApplicantIntent | "") ?? "",
      tradeIntent: w.tradeIntent
    }
  };
}

const emptyWizard = (): WizardState => ({
  vehicleInterest: "",
  hasChosenVehicle: false,
  monthlyBudgetCad: 600,
  tradeIntent: "no",
  tradeYear: "",
  tradeMake: "",
  tradeModel: "",
  tradeKms: "",
  employmentStatus: "",
  employmentOtherDescription: "",
  employmentType: "",
  mainIncome: "",
  incomeTenureBand: "",
  incomeTenureYears: "0",
  incomeTenureMonths: "0",
  otherIncome: "",
  otherIncomeDescription: "",
  employer: "",
  jobTitle: "",
  creditScoreBand: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  dob: "",
  street: "",
  unit: "",
  city: "",
  province: "",
  addressTenureBand: "",
  addressTenureYears: "0",
  addressTenureMonths: "0",
  sin: "",
  downPaymentBand: "",
  coApplicantIntent: "",
  consentContact: false,
  consentCredit: false
});

function validateSinOptional(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const digits = t.replace(/\D/g, "");
  if (digits.length !== 9) return "Enter a valid 9-digit SIN, or leave it blank.";
  return null;
}

function validateEmailRequired(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function validatePhoneOptional(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (!normalizeNanpTo10Digits(t)) {
    return "Enter a valid 10-digit phone number (US/Canada), or leave it blank.";
  }
  return null;
}

function parseMoney(raw: string): { ok: false; error: string } | { ok: true; value: number } {
  const t = raw.trim();
  if (!t) return { ok: true, value: 0 };
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Enter a valid dollar amount." };
  return { ok: true, value: n };
}

function validateStep(step: number, w: WizardState): string | null {
  switch (step) {
    case 0: {
      if (!w.hasChosenVehicle) return "Choose a unit type (or Not sure yet).";
      return null;
    }
    case 1: {
      if (!w.firstName.trim()) return "Enter your first name.";
      if (!w.lastName.trim()) return "Enter your last name.";
      if (!validateEmailRequired(w.email)) return "Enter a valid email address.";
      const phoneErr = validatePhoneOptional(w.phone);
      if (phoneErr) return phoneErr;
      return null;
    }
    case 2: {
      if (!w.employmentStatus) return "Select your employment status.";
      if (requiresEmploymentType(w.employmentStatus) && !w.employmentType) {
        return "Select full-time or part-time.";
      }
      if (!w.incomeTenureBand) return "Select how long you have had this income.";
      const main = parseMoney(w.mainIncome);
      if (!main.ok) return main.error;
      if (main.value <= 0) return "Enter your main monthly income (CAD).";
      const other = parseMoney(w.otherIncome);
      if (!other.ok) return other.error;
      if (other.value > 0 && !w.otherIncomeDescription.trim()) {
        return "Describe your other monthly income.";
      }
      if (requiresEmployerAndTitle(w.employmentStatus)) {
        if (!w.employer.trim()) {
          return w.employmentStatus === "self_employed"
            ? "Enter your business name."
            : "Enter your employer name.";
        }
        if (!w.jobTitle.trim()) {
          return w.employmentStatus === "self_employed" ? "Enter your role." : "Enter your job title.";
        }
      }
      return null;
    }
    case 3: {
      if (!w.creditScoreBand) return "Select the range that best matches your credit.";
      return null;
    }
    case 4: {
      const dobErr = birthDateValidationMessage(w.dob);
      if (dobErr) return dobErr;
      if (!w.street.trim()) return "Enter your street address.";
      if (!w.city.trim()) return "Enter your city.";
      if (!w.province.trim()) return "Select your province.";
      if (!w.addressTenureBand) return "Select how long you have lived at this address.";
      const sinErr = validateSinOptional(w.sin);
      if (sinErr) return sinErr;
      if (!w.consentCredit) {
        return "Please check the box to authorize contact about your application.";
      }
      return null;
    }
    default:
      return null;
  }
}

export function PreApprovalPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const unitParam = searchParams.get("unit")?.trim() || null;

  const initialDraft = loadInitialFromDraft();
  const [step, setStep] = useState(() => initialDraft?.step ?? 0);
  const [w, setW] = useState<WizardState>(() => initialDraft?.wizard ?? emptyWizard());
  const [skipVehicleStep, setSkipVehicleStep] = useState(() => initialDraft?.skipVehicleStep ?? false);
  const [marketingLeadId, setMarketingLeadId] = useState<string | null>(
    () => initialDraft?.marketingLeadId ?? null
  );
  const [erasedFields, setErasedFields] = useState<PreapprovalErasedFields>(
    () => initialDraft?.erasedFields ?? {}
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const wizardScrollRef = useRef<HTMLDivElement>(null);
  const skipWizardScrollRef = useRef(true);
  const applicationFinishedRef = useRef(false);
  const partialStateRef = useRef({
    w,
    step,
    skipVehicleStep,
    marketingLeadId,
    erasedFields,
    submitting
  });
  partialStateRef.current = { w, step, skipVehicleStep, marketingLeadId, erasedFields, submitting };
  const otherIncomeParsed = parseMoney(w.otherIncome);
  const showOtherIncomeDescription = otherIncomeParsed.ok && otherIncomeParsed.value > 0;

  useLayoutEffect(() => {
    if (skipWizardScrollRef.current) {
      skipWizardScrollRef.current = false;
      return;
    }
    wizardScrollRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  useEffect(() => {
    if (!unitParam) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("inventory_units_public")
        .select("*")
        .eq("id", unitParam)
        .maybeSingle();
      if (cancelled || error) return;
      const parsed = data ? parseInventoryPublicRow(data) : null;
      if (!parsed) return;
      setW((prev) => ({
        ...prev,
        vehicleInterest: formatInventoryUnitInterest(parsed),
        hasChosenVehicle: true
      }));
      setSkipVehicleStep(true);
      setStep(0);
    })();
    return () => {
      cancelled = true;
    };
  }, [unitParam]);

  useEffect(() => {
    if (submitting || applicationFinishedRef.current) return;
    const handle = window.setTimeout(() => {
      savePreapprovalDraft({
        step,
        skipVehicleStep,
        marketingLeadId,
        erasedFields,
        wizard: w as PreapprovalWizardState
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [w, step, skipVehicleStep, submitting, marketingLeadId, erasedFields]);

  /** Queue partial only when leaving the page — not while still on the form. */
  const queuePartialOnPageExit = useCallback((useKeepalive: boolean) => {
    const {
      w: wizardState,
      step: wizardStep,
      skipVehicleStep: skipStep,
      marketingLeadId: leadId,
      erasedFields: erased,
      submitting: isSubmitting
    } = partialStateRef.current;
    if (isSubmitting || applicationFinishedRef.current) return;

    const wizard = wizardState as PreapprovalWizardState;
    if (!isPartialPreapprovalEligible(wizard)) return;

    if (useKeepalive) {
      const result = syncPartialPreapprovalQueueKeepalive({
        marketingLeadId: leadId,
        wizardStep: wizardStep,
        wizard,
        erasedFields: erased
      });
      if (!result) return;
      savePreapprovalDraft({
        step: wizardStep,
        skipVehicleStep: skipStep,
        marketingLeadId: result.marketingLeadId,
        erasedFields: erased,
        wizard
      });
      return;
    }

    void syncPartialPreapprovalQueue({
      marketingLeadId: leadId,
      wizardStep: wizardStep,
      wizard,
      erasedFields: erased
    }).then((result) => {
      if (!result.ok) {
        if (import.meta.env.DEV) {
          console.warn("[partial pre-approval] queue failed:", result.error);
        }
        return;
      }
      savePreapprovalDraft({
        step: wizardStep,
        skipVehicleStep: skipStep,
        marketingLeadId: result.marketingLeadId,
        erasedFields: erased,
        wizard
      });
      if (import.meta.env.DEV) {
        console.debug("[partial pre-approval] queued on page exit", {
          marketingLeadId: result.marketingLeadId,
          step: wizardStep
        });
      }
    });
  }, []);

  useEffect(() => {
    if (submitting || applicationFinishedRef.current) return;
    const wizard = w as PreapprovalWizardState;
    if (!isPartialPreapprovalEligible(wizard)) {
      void cancelPartialPreapprovalQueue(marketingLeadId);
      if (marketingLeadId) {
        setMarketingLeadId(null);
        clearPreapprovalDraft();
      }
    }
  }, [w, submitting, marketingLeadId]);

  useEffect(() => {
    const onTabClose = () => {
      queuePartialOnPageExit(true);
    };

    window.addEventListener("pagehide", onTabClose);
    return () => {
      window.removeEventListener("pagehide", onTabClose);
      queuePartialOnPageExit(false);
    };
  }, [queuePartialOnPageExit]);

  const update = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setW((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateTracked = useCallback(
    (field: TrackedErasedField, value: string) => {
      setW((prev) => {
        const previous = prev[field];
        setErasedFields((erased) => applyErasedFieldChange(field, previous, value, erased));
        return { ...prev, [field]: value };
      });
    },
    []
  );

  const selectVehicle = (category: VehicleCategory) => {
    setW((prev) => ({ ...prev, vehicleInterest: category, hasChosenVehicle: true }));
  };

  const selectNotSureVehicle = () => {
    setW((prev) => ({ ...prev, vehicleInterest: "", hasChosenVehicle: true }));
  };

  const onBudgetPosition = (pos: number) => {
    update("monthlyBudgetCad", budgetFromPosition(pos));
  };

  const goToStep = (targetStep: number) => {
    if (submitting || targetStep === step) return;
    if (targetStep < 0 || targetStep >= TOTAL_STEPS) return;

    if (targetStep < step) {
      setErrorMessage(null);
      setStep(targetStep);
      return;
    }

    for (let s = step; s < targetStep; s++) {
      const err = validateStep(s, w);
      if (err) {
        setErrorMessage(err);
        setStep(s);
        return;
      }
    }
    setErrorMessage(null);
    setStep(targetStep);
  };

  const goNext = () => {
    goToStep(step + 1);
  };

  const goBack = () => {
    goToStep(step - 1);
  };

  const onSubmit = async () => {
    const err = validateStep(TOTAL_STEPS - 1, w);
    setErrorMessage(err);
    if (err) return;

    const phoneDigits = w.phone.trim() ? normalizeNanpTo10Digits(w.phone) : null;
    if (w.phone.trim() && !phoneDigits) {
      setErrorMessage("Enter a valid 10-digit phone number (US/Canada), or leave it blank.");
      return;
    }
    const main = parseMoney(w.mainIncome);
    if (!main.ok) {
      setErrorMessage(main.error);
      return;
    }
    const otherParsed = parseMoney(w.otherIncome);
    if (!otherParsed.ok) {
      setErrorMessage(otherParsed.error);
      return;
    }

    const displayName = `${w.firstName.trim()} ${w.lastName.trim()}`.trim();
    const emailTrim = w.email.trim();
    if (!validateEmailRequired(emailTrim)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }
    const otherAmt = otherParsed.value > 0 ? otherParsed.value : null;
    const otherDesc = otherAmt != null ? w.otherIncomeDescription.trim() || null : null;

    setSubmitting(true);
    await cancelPartialPreapprovalQueue(marketingLeadId);
    // Always insert a new marketing lead on full submit so a promoted partial stays
    // its own CRM lead and the completed application arrives as a separate full lead.
    const result = await submitPublicPreapprovalLead({
      marketingLeadId: null,
      displayName,
      email: emailTrim,
      phone: phoneDigits ?? "",
      dateOfBirth: w.dob.trim(),
      street: w.street.trim(),
      line2: "",
      city: w.city.trim(),
      province: w.province.trim(),
      employer: w.employer.trim(),
      jobTitle: w.jobTitle.trim() ? w.jobTitle.trim() : null,
      grossMonthlyIncomeCad: main.value,
      otherMonthlyIncomeCad: otherAmt,
      otherIncomeDescription: otherDesc,
      vehicleInterest: w.vehicleInterest.trim(),
      monthlyBudgetCad: w.monthlyBudgetCad,
      hasTrade: false,
      tradeYear: null,
      tradeMake: null,
      tradeModel: null,
      tradeKms: null,
      employmentStatus: w.employmentStatus,
      employmentOtherDescription:
        w.employmentStatus === "other"
          ? w.employmentOtherDescription.trim() || "Disability/other"
          : null,
      employmentType: requiresEmploymentType(w.employmentStatus) ? w.employmentType : null,
      incomeTenure: formatIncomeTenureBand(w.incomeTenureBand),
      creditScoreBand: w.creditScoreBand,
      addressTenure: formatContactStepNotes(w),
      sin: w.sin.trim().replace(/\D/g, "") || null,
      consentContact: true,
      consentCredit: w.consentCredit
    });
    if (!result.ok) {
      setSubmitting(false);
      setErrorMessage(result.error);
      return;
    }

    applicationFinishedRef.current = true;
    await cancelPartialPreapprovalQueue(marketingLeadId);
    finishPreapprovalApplication();
    markPreApprovalConversion();
    navigate("/apply/complete", { replace: true });
  };

  const progressLinePct =
    TOTAL_STEPS > 1 ? (step / (TOTAL_STEPS - 1)) * 100 : 0;
  const dobBounds = birthDateInputBounds();

  const empStatus = w.employmentStatus;
  const employerLabel = empStatus === "self_employed" ? "Business name" : "Employer name";
  const jobLabel = empStatus === "self_employed" ? "Your role" : "Job title";

  const primaryCtaLabel =
    step < TOTAL_STEPS - 1 ? PREAPPROVAL_CTA.nextByStep[step] : PREAPPROVAL_SUBMIT_LABEL;
  const step0Blocked = step === 0 && !skipVehicleStep && !w.hasChosenVehicle;

  const budgetBlock = (
    <>
      <h2 className={`preapproval-wizardStepTitle${skipVehicleStep ? "" : " preapproval-wizardStepTitleSpaced"}`}>
        Monthly payment budget
      </h2>
      <p className="preapproval-wizardHint">
        Drag the slider to choose a monthly payment from ${BUDGET_SLIDER_MIN} to $1000+.
      </p>
      <div className="preapproval-budgetBlock">
        <div className="preapproval-budgetValue" aria-live="polite">
          <strong>{formatBudgetChoice(w.monthlyBudgetCad)}</strong>
          <span className="preapproval-budgetSuffix">/month</span>
        </div>
        <div className="preapproval-budgetScale">
          <span className="preapproval-budgetScaleEnd" aria-hidden>
            ${BUDGET_SLIDER_MIN}
          </span>
          <div className="preapproval-budgetScaleTrack">
            <input
              className="preapproval-budgetRange"
              type="range"
              min={0}
              max={BUDGET_OVER_POSITION}
              step={1}
              value={positionFromBudget(w.monthlyBudgetCad)}
              onChange={(e) => onBudgetPosition(Number(e.target.value))}
              aria-valuemin={BUDGET_SLIDER_MIN}
              aria-valuemax={BUDGET_SENTINEL_OVER}
              aria-valuenow={w.monthlyBudgetCad}
              aria-valuetext={formatBudgetChoice(w.monthlyBudgetCad)}
              aria-label="Monthly budget in Canadian dollars"
            />
          </div>
          <span className="preapproval-budgetScaleEnd" aria-hidden>
            $1000+
          </span>
        </div>
      </div>
    </>
  );

  return (
    <div className="preapproval">
      <Seo title={PREAPPROVAL_SEO.title} description={PREAPPROVAL_SEO.description} path="/apply" />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(preapprovalFaqJsonLd())}</script>
      </Helmet>
      <div className="preapproval-shell">
        <div className="preapproval-mobileHero" aria-hidden="true">
          <p className="preapproval-mobileHeroKicker">Fast and simple</p>
          <p className="preapproval-mobileHeroTitle">Start your application</p>
        </div>
        <div className="preapproval-mainGrid">
          <div className="preapproval-decorLayer" aria-hidden>
            <img
              className="preapproval-decorBg preapproval-decorBg--1"
              src={preapprovalBg1}
              alt=""
              aria-hidden
              loading="lazy"
              decoding="async"
            />
            <img
              className="preapproval-decorBg preapproval-decorBg--2"
              src={preapprovalBg2}
              alt=""
              aria-hidden
              loading="lazy"
              decoding="async"
            />
          </div>
          <svg
            className="preapproval-guideArrow"
            viewBox="0 0 1000 420"
            preserveAspectRatio="xMinYMid meet"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
            focusable="false"
          >
            <defs>
              <linearGradient id="preapprovalArrowStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffb38e" />
                <stop offset="55%" stopColor="#ff7a3d" />
                <stop offset="100%" stopColor="#f05d22" />
              </linearGradient>
            </defs>
            <path
              className="preapproval-guideArrowGlow"
              d="M 92 255 C 115 405, 248 242, 418 252"
            />
            <path
              className="preapproval-guideArrowPath"
              d="M 92 255 C 115 405, 248 242, 418 252"
            />
            <g className="preapproval-guideArrowTip" transform="translate(418 252) rotate(-9)">
              <polygon className="preapproval-guideArrowTipShadow" points="0 -34 72 0 0 34" />
              <polygon className="preapproval-guideArrowTipShape" points="0 -34 72 0 0 34" />
            </g>
          </svg>

          <div className="preapproval-visual" aria-label="Financing application highlights">
            <div className="preapproval-promo">
              <p className="preapproval-promoKicker">Fast and simple</p>
              <h2 className="preapproval-promoTitle">
                Takes about
                <br />
                2 minutes
              </h2>
              <p className="preapproval-promoLead">
                Quick form. Clear steps. We help with all credit situations.
              </p>
              <p className="preapproval-promoMobileCue" aria-hidden>
                ↓
              </p>
            </div>
          </div>

          <div ref={wizardScrollRef} className="preapproval-form card card-pad preapproval-wizard">
            <div className="preapproval-wizardIntro">
              <h2 className="preapproval-wizardIntroTitle">{PREAPPROVAL_WIZARD_INTRO.title}</h2>
              <p className="preapproval-wizardIntroSubline">{PREAPPROVAL_WIZARD_INTRO.subline}</p>
            </div>
            <nav className="preapproval-wizardProgress" aria-label="Application progress">
              <p className="preapproval-wizardProgressMobileStep" aria-live="polite">
                Step {step + 1} of {TOTAL_STEPS} · {PREAPPROVAL_WIZARD_STEPS[step].shortLabel}
              </p>
              <p className="visually-hidden">
                Step {step + 1} of {TOTAL_STEPS}: {PREAPPROVAL_WIZARD_STEPS[step].shortLabel}
              </p>
              <div className="preapproval-wizardProgressTrack">
                <div
                  className="preapproval-wizardProgressLineFill"
                  style={{ width: `${progressLinePct}%` }}
                  aria-hidden
                />
                <ol className="preapproval-wizardProgressDots">
                  {PREAPPROVAL_WIZARD_STEPS.map((wizardStep, i) => {
                    const isLast = i === TOTAL_STEPS - 1;
                    const isComplete = i < step;
                    const isCurrent = i === step;
                    const dotClass = [
                      "preapproval-wizardProgressDot",
                      isLast ? "preapproval-wizardProgressDot--finish" : "",
                      isComplete ? "preapproval-wizardProgressDot--complete" : "",
                      isCurrent ? "preapproval-wizardProgressDot--current" : ""
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <li key={wizardStep.shortLabel} className="preapproval-wizardProgressDotCell">
                        <button
                          type="button"
                          className="preapproval-wizardProgressStepBtn"
                          onClick={() => goToStep(i)}
                          disabled={submitting}
                          aria-current={isCurrent ? "step" : undefined}
                          aria-label={
                            isCurrent
                              ? `${wizardStep.shortLabel}, current step`
                              : `Go to ${wizardStep.shortLabel}`
                          }
                        >
                          <span className={dotClass}>
                            {isLast ? (
                              <PreapprovalProgressCheckIcon />
                            ) : (
                              <span className="preapproval-wizardProgressDotNum" aria-hidden>
                                {i + 1}
                              </span>
                            )}
                          </span>
                          <span
                            className={`preapproval-wizardProgressName${isCurrent ? " preapproval-wizardProgressName--current" : ""}${isComplete ? " preapproval-wizardProgressName--complete" : ""}`}
                          >
                            {wizardStep.shortLabel}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </nav>

        {skipVehicleStep && w.vehicleInterest ? (
          <p className="preapproval-unitBanner" role="status">
            Applying for: <strong>{w.vehicleInterest}</strong>
            {unitParam ? (
              <>
                {" "}
                <Link to={`/inventory/${unitParam}`} className="preapproval-unitBannerLink">
                  View listing
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        {step === 0 ? (
          <>
            {!skipVehicleStep ? (
              <>
                <h2 className="preapproval-wizardStepTitle">What type of unit are you interested in?</h2>
                <div className="preapproval-wizardVehicleGrid" role="group" aria-label="Vehicle type">
                  {VEHICLE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`preapproval-wizardVehicleBtn${
                        w.hasChosenVehicle && w.vehicleInterest === cat ? " preapproval-wizardVehicleBtnActive" : ""
                      }`}
                      onClick={() => selectVehicle(cat)}
                    >
                      <VehicleCategoryPhoto category={cat} />
                      <span className="preapproval-wizardVehicleLabel">{cat}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={`preapproval-wizardVehicleBtn preapproval-wizardVehicleBtn--unsure${
                    w.hasChosenVehicle && w.vehicleInterest === "" ? " preapproval-wizardVehicleBtnActive" : ""
                  }`}
                  onClick={selectNotSureVehicle}
                >
                  Not sure yet
                </button>
              </>
            ) : null}
            {budgetBlock}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h2 className="preapproval-wizardStepTitle">Your details</h2>
            <div className="form-row">
              <label className="form-label" htmlFor="pa-fn">
                First name <span className="form-required">*</span>
              </label>
              <input
                id="pa-fn"
                className="input"
                type="text"
                autoComplete="given-name"
                value={w.firstName}
                onChange={(e) => update("firstName", e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="pa-ln">
                Last name <span className="form-required">*</span>
              </label>
              <input
                id="pa-ln"
                className="input"
                type="text"
                autoComplete="family-name"
                value={w.lastName}
                onChange={(e) => update("lastName", e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="pa-email">
                Email <span className="form-required">*</span>
              </label>
              <input
                id="pa-email"
                className="input"
                type="email"
                autoComplete="email"
                value={w.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="pa-phone">
                Phone <span className="preapproval-optional">(optional)</span>
              </label>
              <input
                id="pa-phone"
                className="input"
                type="tel"
                autoComplete="tel"
                value={w.phone}
                onChange={(e) => updateTracked("phone", e.target.value)}
              />
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="preapproval-wizardStepTitle">Income and employment</h2>
            <div className="form-row">
              <p className="form-label" id="pa-emp-st-label">
                Status <span className="form-required">*</span>
              </p>
              <div
                className="preapproval-choiceGrid preapproval-choiceGrid--2"
                role="radiogroup"
                aria-labelledby="pa-emp-st-label"
              >
                {EMPLOYMENT_STATUS_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={w.employmentStatus === o.value}
                    className={`preapproval-choiceBtn${w.employmentStatus === o.value ? " preapproval-choiceBtnActive" : ""}`}
                    onClick={() => setW((prev) => selectEmploymentStatus(prev, o.value))}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {requiresEmployerAndTitle(w.employmentStatus) ? (
              <div className="form-row">
                <label className="form-label" htmlFor="pa-empl">
                  {employerLabel} <span className="form-required">*</span>
                </label>
                <input
                  id="pa-empl"
                  className="input"
                  type="text"
                  autoComplete="organization"
                  value={w.employer}
                  onChange={(e) => update("employer", e.target.value)}
                />
              </div>
            ) : null}
            {requiresEmployerAndTitle(w.employmentStatus) ? (
              <div className="form-row">
                <label className="form-label" htmlFor="pa-job">
                  {jobLabel} <span className="form-required">*</span>
                </label>
                <input
                  id="pa-job"
                  className="input"
                  type="text"
                  autoComplete="organization-title"
                  value={w.jobTitle}
                  onChange={(e) => update("jobTitle", e.target.value)}
                />
              </div>
            ) : null}
            {requiresEmploymentType(w.employmentStatus) ? (
              <div className="form-row">
                <p className="form-label" id="pa-emptype-label">
                  Employment type <span className="form-required">*</span>
                </p>
                <div
                  className="preapproval-yesNoRow"
                  role="radiogroup"
                  aria-labelledby="pa-emptype-label"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={w.employmentType === "full_time"}
                    className={`preapproval-choiceBtn preapproval-yesNoBtn${w.employmentType === "full_time" ? " preapproval-choiceBtnActive" : ""}`}
                    onClick={() => update("employmentType", "full_time")}
                  >
                    Full-time
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={w.employmentType === "part_time"}
                    className={`preapproval-choiceBtn preapproval-yesNoBtn${w.employmentType === "part_time" ? " preapproval-choiceBtnActive" : ""}`}
                    onClick={() => update("employmentType", "part_time")}
                  >
                    Part-time
                  </button>
                </div>
              </div>
            ) : null}
            <div className="form-row">
              <label className="form-label" htmlFor="pa-main-inc">
                Main monthly income (CAD) <span className="form-required">*</span>
              </label>
              <input
                id="pa-main-inc"
                className="input"
                type="number"
                min={0}
                step={50}
                inputMode="decimal"
                value={w.mainIncome}
                onChange={(e) => update("mainIncome", e.target.value)}
              />
            </div>
            <div className="form-row">
              <p className="form-label" id="pa-inc-tenure-label">
                For how long? <span className="form-required">*</span>
              </p>
              <div
                className="preapproval-choiceGrid preapproval-choiceGrid--2"
                role="radiogroup"
                aria-labelledby="pa-inc-tenure-label"
              >
                {INCOME_TENURE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={w.incomeTenureBand === o.value}
                    className={`preapproval-choiceBtn${w.incomeTenureBand === o.value ? " preapproval-choiceBtnActive" : ""}`}
                    onClick={() => update("incomeTenureBand", o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="pa-oth-inc">
                Other monthly income (CAD) <span className="preapproval-optional">(optional)</span>
              </label>
              <input
                id="pa-oth-inc"
                className="input"
                type="number"
                min={0}
                step={50}
                inputMode="decimal"
                value={w.otherIncome}
                onChange={(e) => update("otherIncome", e.target.value)}
              />
            </div>
            {showOtherIncomeDescription ? (
              <div className="form-row">
                <label className="form-label" htmlFor="pa-oth-desc">
                  Describe other income <span className="form-required">*</span>
                </label>
                <input
                  id="pa-oth-desc"
                  className="input"
                  type="text"
                  autoComplete="off"
                  value={w.otherIncomeDescription}
                  onChange={(e) => update("otherIncomeDescription", e.target.value)}
                />
              </div>
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="preapproval-wizardStepTitle">{PREAPPROVAL_CREDIT_STEP.title}</h2>
            <p className="preapproval-wizardHint">{PREAPPROVAL_CREDIT_STEP.hint}</p>
            <div
              className="preapproval-tierGrid"
              role="radiogroup"
              aria-label="Estimated credit score range"
            >
              {CREDIT_BAND_OPTIONS.map((opt) => {
                const subtext = PREAPPROVAL_CREDIT_BAND_SUBTEXT[opt.value];
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={w.creditScoreBand === opt.value}
                    className={`preapproval-tierBtn${opt.value === "not_sure" ? " preapproval-tierBtn--wide" : ""}${w.creditScoreBand === opt.value ? " preapproval-tierBtnActive" : ""}`}
                    onClick={() => update("creditScoreBand", opt.value)}
                  >
                    <span className="preapproval-tierTitle">{opt.label}</span>
                    <span className="preapproval-tierHint">{opt.hint}</span>
                    {subtext ? <span className="preapproval-tierSubtext">{subtext}</span> : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h2 className="preapproval-wizardStepTitle">Your contact details</h2>
            <div className="form-row">
              <label className="form-label" htmlFor="pa-dob">
                Date of birth <span className="form-required">*</span>
              </label>
              <p className="preapproval-wizardHint preapproval-dobHint">
                Tap the field to open the calendar and pick your birthday.
              </p>
              <input
                id="pa-dob"
                className="input input--date"
                type="date"
                autoComplete="bday"
                min={dobBounds.min}
                max={dobBounds.max}
                value={w.dob}
                aria-describedby="pa-dob-format"
                onChange={(e) => update("dob", e.target.value)}
              />
              <p className="preapproval-dobFormat" id="pa-dob-format">
                MM/DD/YYYY
              </p>
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="pa-street">
                Street address <span className="form-required">*</span>
              </label>
              <input
                id="pa-street"
                className="input"
                type="text"
                autoComplete="street-address"
                value={w.street}
                onChange={(e) => update("street", e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="pa-city">
                City <span className="form-required">*</span>
              </label>
              <input
                id="pa-city"
                className="input"
                type="text"
                autoComplete="address-level2"
                value={w.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </div>
            <div className="form-row">
              <p className="form-label" id="pa-province-label">
                Province <span className="form-required">*</span>
              </p>
              <div
                className="preapproval-choiceGrid preapproval-choiceGrid--provinces"
                role="radiogroup"
                aria-labelledby="pa-province-label"
              >
                {CANADIAN_PROVINCES_FOR_SELECT.map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    role="radio"
                    aria-checked={w.province === p.code}
                    className={`preapproval-choiceBtn preapproval-choiceBtn--compact${w.province === p.code ? " preapproval-choiceBtnActive" : ""}`}
                    onClick={() => update("province", p.code)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-row">
              <p className="form-label" id="pa-address-tenure-label">
                Time at this address <span className="form-required">*</span>
              </p>
              <div
                className="preapproval-choiceGrid preapproval-choiceGrid--2"
                role="radiogroup"
                aria-labelledby="pa-address-tenure-label"
              >
                {INCOME_TENURE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={w.addressTenureBand === o.value}
                    className={`preapproval-choiceBtn${w.addressTenureBand === o.value ? " preapproval-choiceBtnActive" : ""}`}
                    onClick={() => update("addressTenureBand", o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="pa-sin">
                SIN <span className="preapproval-optional">(optional)</span>
              </label>
              <input
                id="pa-sin"
                className="input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={w.sin}
                onChange={(e) => updateTracked("sin", e.target.value)}
              />
            </div>
            <div className="form-row">
              <p className="form-label" id="pa-down-label">
                Down payment <span className="preapproval-optional">(optional)</span>
              </p>
              <div
                className="preapproval-choiceGrid preapproval-choiceGrid--2"
                role="radiogroup"
                aria-labelledby="pa-down-label"
              >
                {DOWN_PAYMENT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={w.downPaymentBand === o.value}
                    className={`preapproval-choiceBtn${w.downPaymentBand === o.value ? " preapproval-choiceBtnActive" : ""}`}
                    onClick={() => update("downPaymentBand", o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-row">
              <p className="form-label" id="pa-coapp-label">
                Co-applicant <span className="preapproval-optional">(optional)</span>
              </p>
              <div
                className="preapproval-yesNoRow"
                role="radiogroup"
                aria-labelledby="pa-coapp-label"
              >
                {CO_APPLICANT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={w.coApplicantIntent === o.value}
                    className={`preapproval-choiceBtn preapproval-yesNoBtn${w.coApplicantIntent === o.value ? " preapproval-choiceBtnActive" : ""}`}
                    onClick={() => update("coApplicantIntent", o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="preapproval-wizardConsent">
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={w.consentCredit}
                  onChange={(e) => update("consentCredit", e.target.checked)}
                />
                <span>
                  {PREAPPROVAL_CONSENT_LABEL} <span className="form-required">*</span>
                </span>
              </label>
              <p className="preapproval-wizardConsentFootnote">{PREAPPROVAL_CONSENT_FOOTNOTE}</p>
            </div>
          </>
        ) : null}

        {errorMessage ? (
          <p className="preapproval-error preapproval-wizardNavError" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="preapproval-wizardNav">
          <div className="preapproval-wizardNavStart">
            {step > 0 ? (
              <button type="button" className="btn btn-secondary" onClick={goBack} disabled={submitting}>
                Back
              </button>
            ) : null}
          </div>
          <div className="preapproval-wizardNavEnd">
            {step < TOTAL_STEPS - 1 ? (
              <button
                type="button"
                className="btn btn-primary preapproval-wizardNavPrimary"
                onClick={goNext}
                disabled={step0Blocked || submitting}
              >
                {primaryCtaLabel}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary preapproval-wizardNavPrimary"
                disabled={submitting}
                onClick={() => void onSubmit()}
              >
                {submitting ? PREAPPROVAL_SUBMITTING_LABEL : primaryCtaLabel}
              </button>
            )}
          </div>
        </div>
          </div>
        </div>
        <section className="preapproval-faq card card-pad" aria-labelledby="preapproval-faq-heading">
        <h2 id="preapproval-faq-heading" className="preapproval-faqTitle">
          Common questions
        </h2>
        <p className="preapproval-faqIntro">{PREAPPROVAL_FAQ_INTRO}</p>
        <dl className="preapproval-faqList">
          {PREAPPROVAL_FAQ.map((item) => (
            <div key={item.question} className="preapproval-faqItem">
              <dt className="preapproval-faqQuestion">{item.question}</dt>
              <dd className="preapproval-faqAnswer">{item.answer}</dd>
            </div>
          ))}
        </dl>
        </section>
      </div>
    </div>
  );
}

