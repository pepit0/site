import { useState } from "react";
import type { ImportUrlPreview } from "../lib/importUrlToQueue";

export type AdminImportUrlModalProps = {
  open: boolean;
  busy: boolean;
  preview: ImportUrlPreview | null;
  error: string | null;
  onClose: () => void;
  onCheck: (url: string) => void;
  onImport: (url: string) => void;
};

export function AdminImportUrlModal({
  open,
  busy,
  preview,
  error,
  onClose,
  onCheck,
  onImport
}: AdminImportUrlModalProps) {
  const [url, setUrl] = useState("");

  if (!open) return null;

  const trimmed = url.trim();
  const canSubmit = trimmed.length > 0 && !busy;

  return (
    <div className="admin-usImportOverlay" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="admin-usImportModal admin-importUrlModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-import-url-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="admin-import-url-title" className="admin-usImportTitle">
          Import from link
        </h3>
        <p className="sell-ride-applyHint admin-usImportIntro">
          Paste a listing URL from a dealer site. We detect Dealer Spike, WordPress Listivo/WooCommerce, or
          structured page data, then pull photos, year, make, model, and odometer when available.
        </p>

        <div className="form-row sell-ride-applyFullWidth">
          <label className="loginLabel" htmlFor="admin-import-url-input">
            Listing URL
          </label>
          <input
            id="admin-import-url-input"
            className="loginInput"
            type="url"
            inputMode="url"
            placeholder="https://www.example-dealer.com/inventory/..."
            value={url}
            disabled={busy}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        {error ? (
          <div className="sell-ride-applyErrorBanner" role="alert">
            <p className="sell-ride-applyError">{error}</p>
          </div>
        ) : null}

        {preview ? (
          <div className="admin-importUrlPreview" role="status">
            <p className="admin-importUrlPreviewTitle">Ready to import</p>
            <dl className="sell-ride-applyDl admin-importUrlPreviewDl">
              <div className="sell-ride-applyDlRow">
                <dt>Vehicle</dt>
                <dd>
                  {preview.year} {preview.make} {preview.model}
                </dd>
              </div>
              <div className="sell-ride-applyDlRow">
                <dt>Category</dt>
                <dd>{preview.category}</dd>
              </div>
              <div className="sell-ride-applyDlRow">
                <dt>Photos</dt>
                <dd>{preview.photoCount}</dd>
              </div>
              {preview.odometerKm != null ? (
                <div className="sell-ride-applyDlRow">
                  <dt>Odometer</dt>
                  <dd>{preview.odometerKm.toLocaleString()} km</dd>
                </div>
              ) : null}
              <div className="sell-ride-applyDlRow">
                <dt>Detected via</dt>
                <dd>{preview.adapter}</dd>
              </div>
            </dl>
          </div>
        ) : null}

        <div className="admin-usImportActions">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-secondary" disabled={!canSubmit} onClick={() => onCheck(trimmed)}>
            {busy && !preview ? "Checking…" : "Check link"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSubmit || !preview}
            onClick={() => onImport(trimmed)}
          >
            {busy && preview ? "Importing…" : "Add to queue"}
          </button>
        </div>
      </div>
    </div>
  );
}
