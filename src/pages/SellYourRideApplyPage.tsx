import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { VEHICLE_CATEGORIES, type VehicleCategory } from "../data/inventory";
import { SELL_RIDE_APPLY } from "../data/sellRideCopy";
import { SELL_RIDE_PHOTOS_BUCKET } from "../data/sellRide";
import { normalizePhoneForStorage } from "../lib/phoneFormat";
import {
  clearSellRideApplyFileDraft,
  clearSellRideApplySessionDraft,
  MAX_FILE_BYTES,
  readSellRideApplyFileDraft,
  readSellRideApplySessionDraft,
  writeSellRideApplyFileDraft,
  writeSellRideApplySessionDraft,
  type FileDraftItem
} from "../lib/sellRideApplyDraft";
import { sellRideBeginDraft, sellRideSubmit } from "../lib/sellRideSubmission";
import { supabase } from "../lib/supabase";
import { Seo } from "../seo/Seo";
import { SellRideApplyBreadcrumbJsonLd } from "../seo/SellRideApplyBreadcrumbJsonLd";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

function validateEmailOptional(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email address, or leave it blank.";
  return null;
}

type Step = 1 | 2;

type FormState = {
  sellerFirstName: string;
  sellerLastName: string;
  sellerPhone: string;
  sellerEmail: string;
  year: string;
  make: string;
  model: string;
  odometerKm: string;
  category: VehicleCategory;
  sellerNotes: string;
};

const emptyForm = (): FormState => ({
  sellerFirstName: "",
  sellerLastName: "",
  sellerPhone: "",
  sellerEmail: "",
  year: new Date().getFullYear().toString(),
  make: "",
  model: "",
  odometerKm: "",
  category: "Motorcycle",
  sellerNotes: ""
});

function loadInitialForm(): FormState {
  const d = readSellRideApplySessionDraft();
  if (!d) return emptyForm();
  return { ...emptyForm(), ...d.form };
}

function loadInitialStep(): Step {
  const d = readSellRideApplySessionDraft();
  return d?.step === 2 ? 2 : 1;
}

const ACCEPT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "image/jpg"]);

function looksLikeImageFile(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (ACCEPT_TYPES.has(t)) return true;
  return /\.(jpe?g|png|webp|gif|hei[cf])$/i.test(file.name);
}

function isRetriableStorageMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("network") ||
    m.includes("fetch") ||
    m.includes("timeout") ||
    m.includes("502") ||
    m.includes("503") ||
    m.includes("504") ||
    m.includes("429") ||
    m.includes("failed to fetch")
  );
}

async function uploadSellRidePhotoWithRetry(path: string, file: File): Promise<void> {
  let last = "Upload failed.";
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await supabase.storage.from(SELL_RIDE_PHOTOS_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });
    if (!error) return;
    last = error.message || last;
    if (!isRetriableStorageMessage(last) || attempt === 2) break;
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  throw new Error(last);
}

export function SellYourRideApplyPage() {
  const [step, setStep] = useState<Step>(loadInitialStep);
  const [form, setForm] = useState<FormState>(loadInitialForm);
  const [fileItems, setFileItems] = useState<FileDraftItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /** True once the user adds/changes photos — avoids a late IDB restore overwriting their new picks. */
  const userTouchedFilesRef = useRef(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const restored = await readSellRideApplyFileDraft();
        if (!cancelled && restored.length > 0 && !userTouchedFilesRef.current) {
          setFileItems(restored);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = window.setTimeout(() => {
      writeSellRideApplySessionDraft({ version: 1, step, form });
    }, 400);
    return () => window.clearTimeout(t);
  }, [hydrated, form, step]);

  useEffect(() => {
    if (!hydrated) return;
    const t = window.setTimeout(() => {
      void writeSellRideApplyFileDraft(fileItems);
    }, 400);
    return () => window.clearTimeout(t);
  }, [hydrated, fileItems]);

  const previewUrls = useMemo(() => fileItems.map((item) => URL.createObjectURL(item.file)), [fileItems]);

  useEffect(() => {
    const urls = previewUrls;
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, [previewUrls]);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    userTouchedFilesRef.current = true;
    const additions: FileDraftItem[] = [];
    const problems: string[] = [];
    for (const file of Array.from(list)) {
      if (!looksLikeImageFile(file)) {
        problems.push(`${file.name} is not a supported image type.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        problems.push(`${file.name} is over 5 MB.`);
        continue;
      }
      if (file.size === 0) {
        problems.push(`${file.name} is empty.`);
        continue;
      }
      additions.push({ clientId: crypto.randomUUID(), file });
    }
    if (problems.length) {
      setPhotoError(problems.slice(0, 3).join(" ") + (problems.length > 3 ? " …" : ""));
    } else {
      setPhotoError(null);
    }
    if (additions.length) {
      setFileItems((prev) => [...prev, ...additions]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFileById = (clientId: string) => {
    userTouchedFilesRef.current = true;
    setFileItems((prev) => prev.filter((x) => x.clientId !== clientId));
  };

  const validateStep1 = (): string | null => {
    if (!form.sellerFirstName.trim()) return "Enter your first name.";
    if (!form.sellerLastName.trim()) return "Enter your last name.";
    const phone = normalizePhoneForStorage(form.sellerPhone);
    if (phone.error || !phone.value) return phone.error ?? "Enter a valid phone number.";
    const emailErr = validateEmailOptional(form.sellerEmail);
    if (emailErr) return emailErr;

    const year = Number.parseInt(form.year, 10);
    if (!Number.isFinite(year) || year < 1900 || year > 2100) return "Enter a valid year.";
    if (!form.make.trim() || !form.model.trim()) return "Make and model are required.";
    const km = Number.parseInt(form.odometerKm, 10);
    if (!Number.isFinite(km) || km < 0) return "Enter odometer (km).";
    if (fileItems.length < 3) return "Add at least three photos of your ride.";
    return null;
  };

  const goReview = () => {
    const err = validateStep1();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setStep(2);
  };

  const goEdit = () => {
    setFormError(null);
    setStep(1);
  };

  const handleFinalSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const err = validateStep1();
    if (err) {
      setFormError(err);
      setStep(1);
      return;
    }
    setFormError(null);
    setSubmitting(true);

    const year = Number.parseInt(form.year, 10);
    const km = Number.parseInt(form.odometerKm, 10);
    const phone = normalizePhoneForStorage(form.sellerPhone);
    if (!phone.value) {
      setFormError(phone.error ?? "Phone required.");
      setSubmitting(false);
      return;
    }

    const draft = await sellRideBeginDraft();
    if (!draft.ok) {
      setFormError(draft.error);
      setSubmitting(false);
      return;
    }
    const submissionId = draft.id;
    const uploadedPaths: string[] = [];

    try {
      for (const item of fileItems) {
        const path = `${submissionId}/${crypto.randomUUID()}-${sanitizeFileName(item.file.name)}`;
        await uploadSellRidePhotoWithRetry(path, item.file);
        uploadedPaths.push(path);
      }

      const submit = await sellRideSubmit({
        id: submissionId,
        sellerFirstName: form.sellerFirstName.trim(),
        sellerLastName: form.sellerLastName.trim(),
        sellerPhone: phone.value,
        sellerEmail: form.sellerEmail.trim(),
        year,
        make: form.make.trim(),
        model: form.model.trim(),
        odometerKm: km,
        category: form.category,
        sellerNotes: form.sellerNotes.trim(),
        photoPaths: uploadedPaths
      });

      if (!submit.ok) {
        throw new Error(submit.error);
      }

      clearSellRideApplySessionDraft();
      void clearSellRideApplyFileDraft();
      userTouchedFilesRef.current = false;

      setSuccessOpen(true);
      setForm(emptyForm());
      setFileItems([]);
      setStep(1);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Submission failed.");
      if (uploadedPaths.length) {
        await supabase.storage.from(SELL_RIDE_PHOTOS_BUCKET).remove(uploadedPaths);
      }
    }
    setSubmitting(false);
  };

  const reviewSummary = useMemo(() => {
    if (step !== 2) return null;
    const phone = normalizePhoneForStorage(form.sellerPhone);
    return {
      ...form,
      phoneDisplay: phone.value ? phone.value : form.sellerPhone.trim()
    };
  }, [form, step]);

  return (
    <div className="sell-ride-apply">
      <SellRideApplyBreadcrumbJsonLd />
      <Seo
        title="Sell your ride application"
        description="Submit your sled, bike, ATV, or powersports listing to Temptation Motorsports. Photos and details help us connect financed buyers with your ride."
        path="/sell-your-ride/apply"
      />
      <nav className="sell-ride-applyBreadcrumbs" aria-label="Breadcrumb">
        <Link className="sell-ride-applyBreadcrumbsLink" to="/">
          Home
        </Link>
        <span className="sell-ride-applyBreadcrumbsSep" aria-hidden>
          /
        </span>
        <Link className="sell-ride-applyBreadcrumbsLink" to="/sell-your-ride">
          Sell your ride
        </Link>
        <span className="sell-ride-applyBreadcrumbsSep" aria-hidden>
          /
        </span>
        <span className="sell-ride-applyBreadcrumbsCurrent">Apply</span>
      </nav>
      <header className="sell-ride-applyHeader page-header">
        <h1 className="page-title">Sell your ride — application</h1>
        <nav className="sell-ride-applyStepper" aria-label="Form progress">
          <span className={step === 1 ? "sell-ride-applyStep sell-ride-applyStepCurrent" : "sell-ride-applyStep sell-ride-applyStepDone"}>
            1. Your details
          </span>
          <span className="sell-ride-applyStepDivider" aria-hidden />
          <span className={step === 2 ? "sell-ride-applyStep sell-ride-applyStepCurrent" : "sell-ride-applyStep"}>2. Review</span>
        </nav>
        <p className="page-subtitle sell-ride-applyIntro">
          {`We will contact you at the number you provide. We may ask for your driver's licence and registration to confirm ownership before we list your unit.`}
        </p>
        <p className="sell-ride-applyHint">
          Your answers and selected photos are saved on this device until you submit (refresh or come back later). This is not sent to our team until you finish step 2.
        </p>
      </header>

      {formError ? (
        <div className="sell-ride-applyErrorBanner" role="alert">
          <p className="sell-ride-applyError">{formError}</p>
        </div>
      ) : null}

      {photoError ? (
        <div className="sell-ride-applyErrorBanner" role="status" aria-live="polite">
          <p className="sell-ride-applyError">{photoError}</p>
        </div>
      ) : null}

      {step === 1 ? (
        <form
          className="sell-ride-applyForm"
          onSubmit={(e) => {
            e.preventDefault();
            goReview();
          }}
        >
          <h2 className="sell-ride-applySectionTitle">Your contact</h2>
          <div className="sell-ride-applyGrid">
            <div className="form-row">
              <label className="loginLabel" htmlFor="sr-first">
                First name
              </label>
              <input
                id="sr-first"
                className="loginInput"
                autoComplete="given-name"
                value={form.sellerFirstName}
                onChange={(e) => setForm((f) => ({ ...f, sellerFirstName: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <label className="loginLabel" htmlFor="sr-last">
                Last name
              </label>
              <input
                id="sr-last"
                className="loginInput"
                autoComplete="family-name"
                value={form.sellerLastName}
                onChange={(e) => setForm((f) => ({ ...f, sellerLastName: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <label className="loginLabel" htmlFor="sr-phone">
                Phone
              </label>
              <input
                id="sr-phone"
                className="loginInput"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={form.sellerPhone}
                onChange={(e) => setForm((f) => ({ ...f, sellerPhone: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <label className="loginLabel" htmlFor="sr-email">
                Email (optional)
              </label>
              <input
                id="sr-email"
                className="loginInput"
                type="email"
                autoComplete="email"
                value={form.sellerEmail}
                onChange={(e) => setForm((f) => ({ ...f, sellerEmail: e.target.value }))}
              />
            </div>
          </div>

          <h2 className="sell-ride-applySectionTitle">Your ride</h2>
          <div className="sell-ride-applyGrid">
            <div className="form-row">
              <label className="loginLabel" htmlFor="sr-year">
                Year
              </label>
              <input
                id="sr-year"
                className="loginInput"
                type="number"
                min={1900}
                max={2100}
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <label className="loginLabel" htmlFor="sr-make">
                Make
              </label>
              <input
                id="sr-make"
                className="loginInput"
                value={form.make}
                onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <label className="loginLabel" htmlFor="sr-model">
                Model
              </label>
              <input
                id="sr-model"
                className="loginInput"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <label className="loginLabel" htmlFor="sr-km">
                Odometer (km)
              </label>
              <input
                id="sr-km"
                className="loginInput"
                type="number"
                min={0}
                value={form.odometerKm}
                onChange={(e) => setForm((f) => ({ ...f, odometerKm: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <label className="loginLabel" htmlFor="sr-cat">
                Category
              </label>
              <select
                id="sr-cat"
                className="select sell-ride-applySelect"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as VehicleCategory }))}
              >
                {VEHICLE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row sell-ride-applyFullWidth">
              <label className="loginLabel" htmlFor="sr-notes">
                Notes (optional)
              </label>
              <textarea
                id="sr-notes"
                className="loginInput textarea"
                rows={3}
                placeholder={SELL_RIDE_APPLY.notesPlaceholder}
                value={form.sellerNotes}
                onChange={(e) => setForm((f) => ({ ...f, sellerNotes: e.target.value }))}
              />
            </div>
          </div>

          <h2 className="sell-ride-applySectionTitle">Photos (minimum 3)</h2>
          <p className="sell-ride-applyHint">Clear exterior shots help us respond faster. You can also drag files onto the box below.</p>
          <div className="sell-ride-applyPhotos">
            <label
              className="sell-ride-applyDropzone"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                addFiles(e.dataTransfer.files);
              }}
            >
              <span className="sell-ride-applyDropzoneText">Choose photos</span>
              <span className="sell-ride-applyDropzoneHint">JPEG, PNG, WebP, GIF, HEIC · up to 5 MB each</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                multiple
                className="sell-ride-applyFileInput"
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>
            {fileItems.length ? (
              <ul className="sell-ride-applyPhotoList">
                {fileItems.map((item, i) => (
                  <li key={item.clientId} className="sell-ride-applyPhotoItem">
                    <img src={previewUrls[i]} alt="" className="sell-ride-applyPhotoThumb" />
                    <div className="sell-ride-applyPhotoMeta">
                      <span className="sell-ride-applyPhotoName">{item.file.name}</span>
                      <button type="button" className="btn btn-secondary sell-ride-applyPhotoRemove" onClick={() => removeFileById(item.clientId)}>
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sell-ride-applyMuted">No photos added yet.</p>
            )}
          </div>

          <div className="sell-ride-applyActions sell-ride-applyActionsEnd">
            <Link to="/sell-your-ride" className="btn btn-secondary">
              Back
            </Link>
            <button type="submit" className="btn btn-primary">
              Continue to review
            </button>
          </div>
        </form>
      ) : (
        <form className="sell-ride-applyReview" onSubmit={(e) => void handleFinalSubmit(e)}>
          <h2 className="sell-ride-applySectionTitle">Review your application</h2>
          {reviewSummary ? (
            <dl className="sell-ride-applyDl">
              <div className="sell-ride-applyDlRow">
                <dt>Name</dt>
                <dd>
                  {reviewSummary.sellerFirstName.trim()} {reviewSummary.sellerLastName.trim()}
                </dd>
              </div>
              <div className="sell-ride-applyDlRow">
                <dt>Phone</dt>
                <dd>{reviewSummary.phoneDisplay}</dd>
              </div>
              {reviewSummary.sellerEmail.trim() ? (
                <div className="sell-ride-applyDlRow">
                  <dt>Email</dt>
                  <dd>{reviewSummary.sellerEmail.trim()}</dd>
                </div>
              ) : null}
              <div className="sell-ride-applyDlRow">
                <dt>Vehicle</dt>
                <dd>
                  {reviewSummary.year} {reviewSummary.make} {reviewSummary.model}
                </dd>
              </div>
              <div className="sell-ride-applyDlRow">
                <dt>Odometer</dt>
                <dd>{reviewSummary.odometerKm} km</dd>
              </div>
              <div className="sell-ride-applyDlRow">
                <dt>Category</dt>
                <dd>{reviewSummary.category}</dd>
              </div>
              {reviewSummary.sellerNotes.trim() ? (
                <div className="sell-ride-applyDlRow">
                  <dt>Notes</dt>
                  <dd>{reviewSummary.sellerNotes.trim()}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <h3 className="sell-ride-applyPhotosTitle">Photos</h3>
          <div className="sell-ride-applyReviewGrid">
            {fileItems.map((item, i) => (
              <figure key={`${item.clientId}-rv`} className="sell-ride-applyReviewFigure">
                <img src={previewUrls[i]} alt={item.file.name} className="sell-ride-applyReviewImg" />
                <figcaption className="sell-ride-applyReviewCaption">{item.file.name}</figcaption>
              </figure>
            ))}
          </div>

          <div className="sell-ride-applyActions sell-ride-applyActionsEnd">
            <button type="button" className="btn btn-secondary" onClick={goEdit} disabled={submitting}>
              Edit
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit application"}
            </button>
          </div>
        </form>
      )}

      {successOpen ? (
        <dialog className="sell-ride-applyDialog" open>
          <div className="sell-ride-applyDialogInner">
            <h2 className="page-title sell-ride-applyDialogTitle">{`You're all set`}</h2>
            <p className="page-subtitle">
              We received your submission. Someone will be in touch shortly at the phone number you provided.
            </p>
            <div className="sell-ride-applyActions">
              <Link to="/" className="btn btn-primary" onClick={() => setSuccessOpen(false)}>
                Return home
              </Link>
            </div>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
