import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { VehicleSilhouette } from "../components/VehicleSilhouette";
import { VEHICLE_CATEGORIES, type VehicleCategory } from "../data/inventory";
import { normalizePhoneForStorage } from "../lib/phoneFormat";
import { submitPublicPreapprovalLead } from "../lib/submitPublicPreapprovalLead";

const TOTAL_STEPS = 6;

type WizardState = {
  vehicleInterest: string;
  hasChosenVehicle: boolean;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dob: string;
  street: string;
  unit: string;
  city: string;
  province: string;
  employer: string;
  income: string;
  consentContact: boolean;
  consentCredit: boolean;
};

const emptyWizard = (): WizardState => ({
  vehicleInterest: "",
  hasChosenVehicle: false,
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  dob: "",
  street: "",
  unit: "",
  city: "",
  province: "",
  employer: "",
  income: "",
  consentContact: false,
  consentCredit: false
});

function validateEmail(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function validateStep(step: number, w: WizardState): string | null {
  switch (step) {
    case 0:
      return null;
    case 1: {
      if (!w.firstName.trim()) return "Enter your first name.";
      if (!w.lastName.trim()) return "Enter your last name.";
      const phone = normalizePhoneForStorage(w.phone);
      if (phone.error || !phone.value) return phone.error ?? "Enter a valid phone number.";
      return null;
    }
    case 2: {
      if (!validateEmail(w.email)) return "Enter a valid email address.";
      if (!w.dob.trim()) return "Enter your date of birth.";
      return null;
    }
    case 3: {
      if (!w.street.trim()) return "Enter your street address.";
      if (!w.city.trim()) return "Enter your city.";
      if (!w.province.trim()) return "Enter your province.";
      return null;
    }
    case 4: {
      if (!w.employer.trim()) return "Enter your employer.";
      const income = Number.parseFloat(w.income);
      if (!Number.isFinite(income) || income < 0) return "Enter a valid gross monthly income (CAD).";
      return null;
    }
    case 5: {
      if (!w.consentContact || !w.consentCredit) return "Both consent checkboxes are required to submit.";
      return null;
    }
    default:
      return null;
  }
}

export function PreApprovalPage() {
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(0);
  const [w, setW] = useState<WizardState>(() => emptyWizard());
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const update = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setW((prev) => ({ ...prev, [key]: value }));
  }, []);

  const selectVehicle = (category: VehicleCategory) => {
    setW((prev) => ({ ...prev, vehicleInterest: category, hasChosenVehicle: true }));
  };

  const selectNotSureVehicle = () => {
    setW((prev) => ({ ...prev, vehicleInterest: "", hasChosenVehicle: true }));
  };

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
    setStep((s) => Math.max(0, s - 1));
  };

  const onSubmit = async () => {
    const err = validateStep(5, w);
    setErrorMessage(err);
    if (err) return;

    const phoneNorm = normalizePhoneForStorage(w.phone);
    if (phoneNorm.error || !phoneNorm.value) {
      setErrorMessage(phoneNorm.error ?? "Enter a valid phone number.");
      return;
    }
    const income = Number.parseFloat(w.income);
    if (!Number.isFinite(income) || income < 0) {
      setErrorMessage("Enter a valid gross monthly income.");
      return;
    }

    const displayName = `${w.firstName.trim()} ${w.lastName.trim()}`.trim();

    setSubmitting(true);
    const result = await submitPublicPreapprovalLead({
      displayName,
      email: w.email.trim(),
      phone: phoneNorm.value,
      dateOfBirth: w.dob.trim(),
      street: w.street.trim(),
      line2: w.unit.trim(),
      city: w.city.trim(),
      province: w.province.trim(),
      employer: w.employer.trim(),
      grossMonthlyIncomeCad: income,
      vehicleInterest: w.vehicleInterest.trim(),
      consentContact: w.consentContact,
      consentCredit: w.consentCredit
    });
    setSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    setSubmitted(true);
    setW(emptyWizard());
    setStep(0);
  };

  if (submitted) {
    return (
      <div className="preapproval">
        <div className="preapproval-success card card-pad" role="status">
          <h1 className="page-title">Thank you</h1>
          <p className="page-subtitle">
            We’ve received your pre-approval request. A member of our team will contact you shortly to discuss next
            steps.
          </p>
          <div className="home-actions preapproval-successActions">
            <Link to="/" className="btn btn-secondary">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <div className="preapproval">
      <header className="page-header">
        <h1 className="page-title">Credit pre-approval</h1>
        <p className="page-subtitle">
          A few short steps. This is not a final credit decision—we use this to prepare options before we reach out.
        </p>
      </header>

      <div className="preapproval-form card card-pad preapproval-wizard">
        <div className="preapproval-wizardProgressTrack" aria-hidden>
          <div className="preapproval-wizardProgressFill" style={{ width: `${progress}%` }} />
        </div>
        <p className="preapproval-wizardProgressLabel">
          Step {step + 1} of {TOTAL_STEPS}
        </p>

        {errorMessage ? (
          <p className="preapproval-error" role="alert">
            {errorMessage}
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
                  <VehicleSilhouette category={cat} className="inventory-placeholderSvg--compact" />
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
            <h2 className="preapproval-wizardStepTitle">Your name and phone</h2>
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
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="preapproval-wizardStepTitle">Email and date of birth</h2>
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
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="preapproval-wizardStepTitle">Address</h2>
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
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h2 className="preapproval-wizardStepTitle">Employment</h2>
            <div className="form-row">
              <label className="form-label" htmlFor="pa-employer">
                Employer <span className="form-required">*</span>
              </label>
              <input
                id="pa-employer"
                className="input"
                type="text"
                autoComplete="organization"
                value={w.employer}
                onChange={(e) => update("employer", e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="pa-income">
                Gross monthly income (CAD) <span className="form-required">*</span>
              </label>
              <input
                id="pa-income"
                className="input"
                type="number"
                min={0}
                step={100}
                inputMode="numeric"
                value={w.income}
                onChange={(e) => update("income", e.target.value)}
              />
            </div>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <h2 className="preapproval-wizardStepTitle">Consent and submit</h2>
            <label className="form-check">
              <input
                type="checkbox"
                checked={w.consentContact}
                onChange={(e) => update("consentContact", e.target.checked)}
              />
              <span>
                I confirm the information above is accurate to the best of my knowledge and I agree to be contacted by
                Temptation Motorsports regarding financing options. <span className="form-required">*</span>
              </span>
            </label>
            <label className="form-check form-checkSpaced">
              <input
                type="checkbox"
                checked={w.consentCredit}
                onChange={(e) => update("consentCredit", e.target.checked)}
              />
              <span>
                I consent to Temptation Motorsports pulling and viewing my consumer credit report in connection with this
                application. <span className="form-required">*</span>
              </span>
            </label>
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
              <button type="button" className="btn btn-primary" onClick={goNext}>
                Next
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => void onSubmit()}>
                {submitting ? "Submitting…" : "Submit application"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
