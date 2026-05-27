import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { VehicleCategoryPhoto } from "../components/VehicleCategoryPhoto";
import {
  PREAPPROVAL_CONSENT_SOFT_CHECK,
  PREAPPROVAL_CREDIT_BAND_SUBTEXT,
  PREAPPROVAL_CREDIT_STEP,
  PREAPPROVAL_CTA,
  PREAPPROVAL_FAQ_INTRO,
  PREAPPROVAL_SEO,
  PREAPPROVAL_SUBMIT_LABEL,
  PREAPPROVAL_SUBMITTING_LABEL,
  PREAPPROVAL_WIZARD_INTRO,
  preapprovalProgressSuffix
} from "../data/preapprovalCopy";
import { PREAPPROVAL_FAQ, preapprovalFaqJsonLd } from "../data/preapprovalFaq";
import { parseInventoryPublicRow, VEHICLE_CATEGORIES, type VehicleCategory } from "../data/inventory";
import { formatInventoryUnitInterest } from "../lib/inventoryUnitInterest";
import { normalizePhoneForStorage } from "../lib/phoneFormat";
import { markPreApprovalConversion } from "../lib/preapprovalConversion";
import {
  clearPreapprovalDraft,
  readPreapprovalDraft,
  savePreapprovalDraft,
  type PreapprovalWizardState
} from "../lib/preapprovalDraft";
import { submitPublicPreapprovalLead } from "../lib/submitPublicPreapprovalLead";
import { supabase } from "../lib/supabase";
import { Seo } from "../seo/Seo";

const TOTAL_STEPS = 6;

/** Slider range $200–$1000 (by $50). Sentinels stored in DB / RPC: under/over that range. */
const BUDGET_SLIDER_MIN = 200;
const BUDGET_SLIDER_MAX = 1000;
const BUDGET_STEP = 50;
const BUDGET_SENTINEL_UNDER = 199;
const BUDGET_SENTINEL_OVER = 1001;

type EmploymentStatus =
  | "employed"
  | "unemployed"
  | "retired_pension"
  | "disability_pension"
  | "aish"
  | "self_employed"
  | "student"
  | "spousal_income"
  | "other";

const EMPLOYMENT_OPTIONS: { value: EmploymentStatus; label: string }[] = [
  { value: "employed", label: "Employed" },
  { value: "unemployed", label: "Unemployed" },
  { value: "retired_pension", label: "Retired / pension" },
  { value: "disability_pension", label: "Disability / pension" },
  { value: "aish", label: "AISH" },
  { value: "self_employed", label: "Self-employed" },
  { value: "student", label: "Student" },
  { value: "spousal_income", label: "Spousal income" },
  { value: "other", label: "Other" }
];

const CREDIT_BAND_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "excellent_750_plus", label: "Excellent", hint: "750+" },
  { value: "great_670_750", label: "Great", hint: "670–750" },
  { value: "good_620_670", label: "Good", hint: "620–670" },
  { value: "decent_550_619", label: "Decent", hint: "550–619" },
  { value: "poor_300_549", label: "Rebuilding", hint: "300–549" },
  { value: "not_sure", label: "I'm really not sure", hint: "No problem" }
];

const ADDRESS_TENURE_OPTIONS: { value: string; label: string }[] = [
  { value: "under_1_year", label: "Under 1 year" },
  { value: "1_to_2_years", label: "1–2 years" },
  { value: "3_to_5_years", label: "3–5 years" },
  { value: "over_5_years", label: "5+ years" },
  { value: "prefer_not_to_say", label: "Prefer not to say" }
];

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

function snapBudget(raw: number): number {
  const clamped = Math.min(BUDGET_SLIDER_MAX, Math.max(BUDGET_SLIDER_MIN, raw));
  const steps = Math.round((clamped - BUDGET_SLIDER_MIN) / BUDGET_STEP);
  return BUDGET_SLIDER_MIN + steps * BUDGET_STEP;
}

function sliderValueFromBudget(budget: number): number {
  if (budget === BUDGET_SENTINEL_UNDER) return BUDGET_SLIDER_MIN;
  if (budget === BUDGET_SENTINEL_OVER) return BUDGET_SLIDER_MAX;
  return snapBudget(budget);
}

function formatBudgetChoice(budget: number): string {
  if (budget === BUDGET_SENTINEL_UNDER) return "Less than $200";
  if (budget === BUDGET_SENTINEL_OVER) return "$1000+";
  return `$${budget}`;
}

function requiresEmploymentType(status: EmploymentStatus | ""): boolean {
  return status === "employed" || status === "self_employed" || status === "student";
}

function requiresEmployerAndTitle(status: EmploymentStatus | ""): boolean {
  return status === "employed" || status === "self_employed";
}

function loadInitialFromDraft(): { step: number; skipVehicleStep: boolean; wizard: WizardState } | null {
  const draft = readPreapprovalDraft();
  if (!draft) return null;
  const w = draft.wizard;
  return {
    step: draft.step,
    skipVehicleStep: draft.skipVehicleStep,
    wizard: {
      ...w,
      employmentStatus: w.employmentStatus as WizardState["employmentStatus"],
      employmentType: w.employmentType as WizardState["employmentType"],
      tradeIntent: w.tradeIntent
    }
  };
}

const emptyWizard = (): WizardState => ({
  vehicleInterest: "",
  hasChosenVehicle: false,
  monthlyBudgetCad: 600,
  tradeIntent: "unset",
  tradeYear: "",
  tradeMake: "",
  tradeModel: "",
  tradeKms: "",
  employmentStatus: "",
  employmentOtherDescription: "",
  employmentType: "",
  mainIncome: "",
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
  addressTenure: "",
  consentContact: false,
  consentCredit: false
});

function validateEmail(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function parseMoney(raw: string): { ok: false; error: string } | { ok: true; value: number } {
  const t = raw.trim();
  if (!t) return { ok: true, value: 0 };
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Enter a valid dollar amount." };
  return { ok: true, value: n };
}

function validateTradeKms(raw: string): string | null {
  const t = raw.trim();
  if (!t) return "Enter the vehicle’s mileage (km).";
  const n = Number.parseInt(t.replace(/[, ]/g, ""), 10);
  if (!Number.isFinite(n) || n < 0 || n > 999_999) return "Enter a realistic odometer reading (km).";
  return null;
}

function validateStep(step: number, w: WizardState): string | null {
  switch (step) {
    case 0: {
      if (!w.hasChosenVehicle) return "Choose a unit type (or Not sure yet).";
      return null;
    }
    case 1:
      return null;
    case 2: {
      if (w.tradeIntent === "unset") return "Let us know if you have a trade-in.";
      if (w.tradeIntent === "yes") {
        if (!w.tradeYear.trim()) return "Enter the trade-in year.";
        if (!w.tradeMake.trim()) return "Enter the trade-in make.";
        if (!w.tradeModel.trim()) return "Enter the trade-in model.";
        const kmErr = validateTradeKms(w.tradeKms);
        if (kmErr) return kmErr;
      }
      return null;
    }
    case 3: {
      if (!w.employmentStatus) return "Select your employment / income type.";
      if (w.employmentStatus === "other" && !w.employmentOtherDescription.trim()) {
        return "Describe your income situation.";
      }
      if (requiresEmploymentType(w.employmentStatus) && !w.employmentType) {
        return "Select full-time or part-time.";
      }
      const main = parseMoney(w.mainIncome);
      if (!main.ok) return main.error;
      if (w.employmentStatus === "unemployed") {
        /* allow zero */
      } else if (main.value <= 0) {
        return "Enter your main monthly income (CAD).";
      }
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
    case 4: {
      if (!w.creditScoreBand) return "Select the range that best matches your credit.";
      return null;
    }
    case 5: {
      if (!w.firstName.trim()) return "Enter your first name.";
      if (!w.lastName.trim()) return "Enter your last name.";
      const phone = normalizePhoneForStorage(w.phone);
      if (phone.error || !phone.value) return phone.error ?? "Enter a valid phone number.";
      if (!validateEmail(w.email)) return "Enter a valid email address, or leave it blank.";
      if (!w.dob.trim()) return "Enter your date of birth.";
      if (!w.street.trim()) return "Enter your street address.";
      if (!w.city.trim()) return "Enter your city.";
      if (!w.province.trim()) return "Enter your province.";
      if (!w.addressTenure) return "Select how long you’ve lived at this address.";
      if (!w.consentCredit) {
        return "Please check the box to authorize communications and the soft credit inquiry.";
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

  const [step, setStep] = useState(() => loadInitialFromDraft()?.step ?? 0);
  const [w, setW] = useState<WizardState>(() => loadInitialFromDraft()?.wizard ?? emptyWizard());
  const [skipVehicleStep, setSkipVehicleStep] = useState(
    () => loadInitialFromDraft()?.skipVehicleStep ?? false
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const otherIncomeParsed = parseMoney(w.otherIncome);
  const showOtherIncomeDescription = otherIncomeParsed.ok && otherIncomeParsed.value > 0;

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
      setStep(1);
    })();
    return () => {
      cancelled = true;
    };
  }, [unitParam]);

  useEffect(() => {
    if (submitting) return;
    const handle = window.setTimeout(() => {
      savePreapprovalDraft({
        step,
        skipVehicleStep,
        wizard: w as PreapprovalWizardState
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [w, step, skipVehicleStep, submitting]);

  const update = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setW((prev) => ({ ...prev, [key]: value }));
  }, []);

  const selectVehicle = (category: VehicleCategory) => {
    setW((prev) => ({ ...prev, vehicleInterest: category, hasChosenVehicle: true }));
  };

  const selectNotSureVehicle = () => {
    setW((prev) => ({ ...prev, vehicleInterest: "", hasChosenVehicle: true }));
  };

  const setTradeYes = () => {
    setW((prev) => ({ ...prev, tradeIntent: "yes" }));
  };

  const setTradeNo = () => {
    setW((prev) => ({
      ...prev,
      tradeIntent: "no",
      tradeYear: "",
      tradeMake: "",
      tradeModel: "",
      tradeKms: ""
    }));
  };

  const onBudgetInput = (raw: number) => {
    update("monthlyBudgetCad", snapBudget(raw));
  };

  const setBudgetUnder = () => update("monthlyBudgetCad", BUDGET_SENTINEL_UNDER);
  const setBudgetOver = () => update("monthlyBudgetCad", BUDGET_SENTINEL_OVER);

  const goNext = () => {
    const err = validateStep(step, w);
    if (err) {
      setErrorMessage(err);
      return;
    }
    setErrorMessage(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const goBack = () => {
    setErrorMessage(null);
    const minStep = skipVehicleStep ? 1 : 0;
    setStep((s) => Math.max(minStep, s - 1));
  };

  const onSubmit = async () => {
    const err = validateStep(TOTAL_STEPS - 1, w);
    setErrorMessage(err);
    if (err) return;

    const phoneNorm = normalizePhoneForStorage(w.phone);
    if (phoneNorm.error || !phoneNorm.value) {
      setErrorMessage(phoneNorm.error ?? "Enter a valid phone number.");
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
    const otherAmt = otherParsed.value > 0 ? otherParsed.value : null;
    const otherDesc = otherAmt != null ? w.otherIncomeDescription.trim() || null : null;

    setSubmitting(true);
    const result = await submitPublicPreapprovalLead({
      displayName,
      email: emailTrim.length > 0 ? emailTrim : null,
      phone: phoneNorm.value,
      dateOfBirth: w.dob.trim(),
      street: w.street.trim(),
      line2: w.unit.trim(),
      city: w.city.trim(),
      province: w.province.trim(),
      employer: w.employer.trim(),
      jobTitle: w.jobTitle.trim() ? w.jobTitle.trim() : null,
      grossMonthlyIncomeCad: main.value,
      otherMonthlyIncomeCad: otherAmt,
      otherIncomeDescription: otherDesc,
      vehicleInterest: w.vehicleInterest.trim(),
      monthlyBudgetCad: w.monthlyBudgetCad,
      hasTrade: w.tradeIntent === "yes",
      tradeYear: w.tradeIntent === "yes" ? w.tradeYear.trim() : null,
      tradeMake: w.tradeIntent === "yes" ? w.tradeMake.trim() : null,
      tradeModel: w.tradeIntent === "yes" ? w.tradeModel.trim() : null,
      tradeKms: w.tradeIntent === "yes" ? w.tradeKms.trim() : null,
      employmentStatus: w.employmentStatus,
      employmentOtherDescription:
        w.employmentStatus === "other" ? w.employmentOtherDescription.trim() : null,
      employmentType: requiresEmploymentType(w.employmentStatus) ? w.employmentType : null,
      creditScoreBand: w.creditScoreBand,
      addressTenure: w.addressTenure,
      consentContact: true,
      consentCredit: w.consentCredit
    });
    setSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    clearPreapprovalDraft();
    markPreApprovalConversion();
    navigate("/pre-approval/complete", { replace: true });
  };

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  const empStatus = w.employmentStatus;
  const employerLabel =
    empStatus === "self_employed" ? "Business name" : empStatus === "employed" ? "Employer" : "Employer";
  const jobLabel = empStatus === "self_employed" ? "Your role" : "Job title";

  const primaryCtaLabel =
    step < TOTAL_STEPS - 1 ? PREAPPROVAL_CTA.nextByStep[step] : PREAPPROVAL_SUBMIT_LABEL;
  const primaryCtaHint = PREAPPROVAL_CTA.nextHintByStep[step];
  const step0Blocked = step === 0 && !w.hasChosenVehicle;

  return (
    <div className="preapproval">
      <Seo title={PREAPPROVAL_SEO.title} description={PREAPPROVAL_SEO.description} path="/pre-approval" />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(preapprovalFaqJsonLd())}</script>
      </Helmet>
      <div className="preapproval-shell">
        <div className="preapproval-mainGrid">
          <svg
            className="preapproval-guideArrow"
            viewBox="0 0 1000 420"
            preserveAspectRatio="none"
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

          <div className="preapproval-visual" aria-label="Pre-approval highlights">
            <div className="preapproval-promo">
              <p className="preapproval-promoKicker">Fast and simple</p>
              <h2 className="preapproval-promoTitle">
                Take 2 minutes
                <br />
                to see if you qualify!
              </h2>
              <p className="preapproval-promoLead">
                Quick form. Clear steps. We help with all credit situations.
              </p>
              <ul className="preapproval-promoPoints" aria-label="Why apply now">
                <li>No hard-to-read fluff</li>
                <li>Just the info needed to help you</li>
                <li>A team member follows up fast</li>
              </ul>
              <p className="preapproval-promoMobileCue" aria-hidden>
                ↓
              </p>
            </div>
          </div>

          <div className="preapproval-form card card-pad preapproval-wizard">
            <div className="preapproval-wizardIntro">
              <h2 className="preapproval-wizardIntroTitle">{PREAPPROVAL_WIZARD_INTRO.title}</h2>
              <p className="preapproval-wizardIntroSubline">{PREAPPROVAL_WIZARD_INTRO.subline}</p>
            </div>
            <div className="preapproval-wizardProgressTrack" aria-hidden>
              <div className="preapproval-wizardProgressFill" style={{ width: `${progress}%` }} />
            </div>
            <p className="preapproval-wizardProgressLabel">
              Step {step + 1} of {TOTAL_STEPS}
              {preapprovalProgressSuffix(step)}
            </p>

            {errorMessage ? (
          <p className="preapproval-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

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
                  {cat}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`preapproval-wizardVehicleBtn${w.hasChosenVehicle && w.vehicleInterest === "" ? " preapproval-wizardVehicleBtnActive" : ""}`}
              onClick={selectNotSureVehicle}
              style={{ width: "100%", minHeight: "auto", padding: "0.65rem 1rem" }}
            >
              Not sure yet
            </button>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h2 className="preapproval-wizardStepTitle">Monthly payment budget</h2>
            <p className="preapproval-wizardHint">
              Roughly what monthly payment fits your budget? Pick an end option or drag between ${BUDGET_SLIDER_MIN} and
              ${BUDGET_SLIDER_MAX} (steps of ${BUDGET_STEP}).
            </p>
            <div className="preapproval-budgetBlock">
              <div className="preapproval-budgetValue" aria-live="polite">
                <strong>{formatBudgetChoice(w.monthlyBudgetCad)}</strong>
                <span className="preapproval-budgetSuffix">/month</span>
              </div>
              <div className="preapproval-budgetSliderRow">
                <button
                  type="button"
                  className={`preapproval-budgetEndpoint${w.monthlyBudgetCad === BUDGET_SENTINEL_UNDER ? " preapproval-budgetEndpointActive" : ""}`}
                  onClick={setBudgetUnder}
                  aria-pressed={w.monthlyBudgetCad === BUDGET_SENTINEL_UNDER}
                >
                  &lt;&nbsp;$200
                </button>
                <input
                  className="preapproval-budgetRange"
                  type="range"
                  min={BUDGET_SLIDER_MIN}
                  max={BUDGET_SLIDER_MAX}
                  step={BUDGET_STEP}
                  value={sliderValueFromBudget(w.monthlyBudgetCad)}
                  onChange={(e) => onBudgetInput(Number(e.target.value))}
                  aria-valuemin={BUDGET_SLIDER_MIN}
                  aria-valuemax={BUDGET_SLIDER_MAX}
                  aria-valuenow={sliderValueFromBudget(w.monthlyBudgetCad)}
                  aria-valuetext={formatBudgetChoice(w.monthlyBudgetCad)}
                  aria-label="Monthly budget in Canadian dollars"
                />
                <button
                  type="button"
                  className={`preapproval-budgetEndpoint${w.monthlyBudgetCad === BUDGET_SENTINEL_OVER ? " preapproval-budgetEndpointActive" : ""}`}
                  onClick={setBudgetOver}
                  aria-pressed={w.monthlyBudgetCad === BUDGET_SENTINEL_OVER}
                >
                  $1000+
                </button>
              </div>
              <div className="preapproval-budgetTicks" aria-hidden>
                <span>Less than $200</span>
                <span>$1000+</span>
              </div>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="preapproval-wizardStepTitle">Trade-in</h2>
            <p className="preapproval-wizardHint">Do you have a vehicle to trade?</p>
            <div className="preapproval-yesNoRow" role="group" aria-label="Trade-in">
              <button
                type="button"
                className={`preapproval-wizardVehicleBtn preapproval-yesNoBtn${
                  w.tradeIntent === "yes" ? " preapproval-wizardVehicleBtnActive" : ""
                }`}
                onClick={setTradeYes}
              >
                Yes
              </button>
              <button
                type="button"
                className={`preapproval-wizardVehicleBtn preapproval-yesNoBtn${
                  w.tradeIntent === "no" ? " preapproval-wizardVehicleBtnActive" : ""
                }`}
                onClick={setTradeNo}
              >
                No
              </button>
            </div>
            {w.tradeIntent === "yes" ? (
              <>
                <div className="form-row">
                  <label className="form-label" htmlFor="pa-ty">
                    Year <span className="form-required">*</span>
                  </label>
                  <input
                    id="pa-ty"
                    className="input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={w.tradeYear}
                    onChange={(e) => update("tradeYear", e.target.value)}
                  />
                </div>
                <div className="form-row form-rowSplit">
                  <div>
                    <label className="form-label" htmlFor="pa-tmk">
                      Make <span className="form-required">*</span>
                    </label>
                    <input
                      id="pa-tmk"
                      className="input"
                      type="text"
                      autoComplete="off"
                      value={w.tradeMake}
                      onChange={(e) => update("tradeMake", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="pa-tmd">
                      Model <span className="form-required">*</span>
                    </label>
                    <input
                      id="pa-tmd"
                      className="input"
                      type="text"
                      autoComplete="off"
                      value={w.tradeModel}
                      onChange={(e) => update("tradeModel", e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label className="form-label" htmlFor="pa-tkm">
                    Odometer (km) <span className="form-required">*</span>
                  </label>
                  <input
                    id="pa-tkm"
                    className="input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={w.tradeKms}
                    onChange={(e) => update("tradeKms", e.target.value)}
                  />
                </div>
              </>
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="preapproval-wizardStepTitle">Income and employment</h2>
            <div className="form-row">
              <label className="form-label" htmlFor="pa-emp-st">
                Status <span className="form-required">*</span>
              </label>
              <select
                id="pa-emp-st"
                className="input"
                value={w.employmentStatus}
                onChange={(e) => {
                  const v = e.target.value as EmploymentStatus | "";
                  setW((prev) => ({
                    ...prev,
                    employmentStatus: v,
                    employmentType: requiresEmploymentType(v) ? prev.employmentType : "",
                    employer: requiresEmployerAndTitle(v) ? prev.employer : "",
                    jobTitle: requiresEmployerAndTitle(v) ? prev.jobTitle : ""
                  }));
                }}
              >
                <option value="">Select…</option>
                {EMPLOYMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {w.employmentStatus === "other" ? (
              <div className="form-row">
                <label className="form-label" htmlFor="pa-emp-oth">
                  Describe <span className="form-required">*</span>
                </label>
                <input
                  id="pa-emp-oth"
                  className="input"
                  type="text"
                  autoComplete="off"
                  value={w.employmentOtherDescription}
                  onChange={(e) => update("employmentOtherDescription", e.target.value)}
                />
              </div>
            ) : null}
            {requiresEmploymentType(w.employmentStatus) ? (
              <fieldset className="form-fieldset">
                <legend className="form-label">
                  Employment type <span className="form-required">*</span>
                </legend>
                <div className="preapproval-inlineRadios">
                  <label className="form-check">
                    <input
                      type="radio"
                      name="pa-emptype"
                      checked={w.employmentType === "full_time"}
                      onChange={() => update("employmentType", "full_time")}
                    />
                    <span>Full-time</span>
                  </label>
                  <label className="form-check">
                    <input
                      type="radio"
                      name="pa-emptype"
                      checked={w.employmentType === "part_time"}
                      onChange={() => update("employmentType", "part_time")}
                    />
                    <span>Part-time</span>
                  </label>
                </div>
              </fieldset>
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
            {requiresEmployerAndTitle(w.employmentStatus) ? (
              <>
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
              </>
            ) : w.employmentStatus === "student" ? (
              <>
                <div className="form-row">
                  <label className="form-label" htmlFor="pa-empl-opt">
                    Employer <span className="preapproval-optional">(optional)</span>
                  </label>
                  <input
                    id="pa-empl-opt"
                    className="input"
                    type="text"
                    autoComplete="organization"
                    value={w.employer}
                    onChange={(e) => update("employer", e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <label className="form-label" htmlFor="pa-job-opt">
                    Job title <span className="preapproval-optional">(optional)</span>
                  </label>
                  <input
                    id="pa-job-opt"
                    className="input"
                    type="text"
                    autoComplete="organization-title"
                    value={w.jobTitle}
                    onChange={(e) => update("jobTitle", e.target.value)}
                  />
                </div>
              </>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
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

        {step === 5 ? (
          <>
            <h2 className="preapproval-wizardStepTitle">Your contact details</h2>
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
              <label className="form-label" htmlFor="pa-phone">
                Phone <span className="form-required">*</span>
              </label>
              <input
                id="pa-phone"
                className="input"
                type="tel"
                autoComplete="tel"
                value={w.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="pa-dob">
                Date of birth <span className="form-required">*</span>
              </label>
              <input
                id="pa-dob"
                className="input"
                type="date"
                autoComplete="bday"
                value={w.dob}
                onChange={(e) => update("dob", e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="pa-email">
                Email <span className="preapproval-optional">(optional)</span>
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
              <label className="form-label" htmlFor="pa-unit">
                Unit / suite (optional)
              </label>
              <input
                id="pa-unit"
                className="input"
                type="text"
                autoComplete="address-line2"
                value={w.unit}
                onChange={(e) => update("unit", e.target.value)}
              />
            </div>
            <div className="form-row form-rowSplit">
              <div>
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
              <div>
                <label className="form-label" htmlFor="pa-province">
                  Province <span className="form-required">*</span>
                </label>
                <input
                  id="pa-province"
                  className="input"
                  type="text"
                  autoComplete="address-level1"
                  value={w.province}
                  onChange={(e) => update("province", e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="pa-tenure">
                Time at this address <span className="form-required">*</span>
              </label>
              <select
                id="pa-tenure"
                className="input"
                value={w.addressTenure}
                onChange={(e) => update("addressTenure", e.target.value)}
              >
                <option value="">Select…</option>
                {ADDRESS_TENURE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="preapproval-wizardConsent">
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={w.consentCredit}
                  onChange={(e) => update("consentCredit", e.target.checked)}
                />
                <span>
                  {PREAPPROVAL_CONSENT_SOFT_CHECK} <span className="form-required">*</span>
                </span>
              </label>
              <p className="preapproval-wizardConsentFootnote">{PREAPPROVAL_CTA.consentFootnote}</p>
            </div>
          </>
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
            <p className="preapproval-ctaHint" role="note">
              {step0Blocked ? PREAPPROVAL_CTA.step0BlockedHint : primaryCtaHint}
            </p>
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

