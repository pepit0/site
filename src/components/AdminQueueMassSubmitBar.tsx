import type { ReactNode } from "react";
import { AdminButtonBusyLabel } from "./AdminButtonBusyLabel";
import type { AdminMassPostProgressState } from "./AdminMassPostProgress";

export type AdminQueueMassSubmitBarProps = {
  selectedCount: number;
  itemLabel: string;
  onClearSelection: () => void;
  onMassSubmit: () => void;
  massSubmitting: boolean;
  massPostProgress?: AdminMassPostProgressState | null;
  massError: string | null;
  massResultSummary: string | null;
  children?: ReactNode;
  submitLabel?: string;
  onMassSkip?: () => void;
  skipLabel?: string;
  massSkipping?: boolean;
};

export function AdminQueueMassSubmitBar({
  selectedCount,
  itemLabel,
  onClearSelection,
  onMassSubmit,
  massSubmitting,
  massPostProgress = null,
  massError,
  massResultSummary,
  children,
  submitLabel = "Mass submit",
  onMassSkip,
  skipLabel = "Skip selected",
  massSkipping = false
}: AdminQueueMassSubmitBarProps) {
  if (selectedCount === 0) return null;

  const massBusy = massSubmitting || massSkipping;

  return (
    <div className="admin-massSubmitBar" role="region" aria-label="Mass submit">
      <div className="admin-massSubmitBarHead">
        <p className="admin-massSubmitBarCount">
          {selectedCount} {itemLabel}
          {selectedCount === 1 ? "" : "s"} selected
        </p>
        <div className="admin-massSubmitBarActions">
          <button type="button" className="btn btn-secondary admin-invMiniBtn" disabled={massBusy} onClick={onClearSelection}>
            Clear selection
          </button>
          {onMassSkip ? (
            <button type="button" className="btn btn-secondary admin-invMiniBtn" disabled={massBusy} onClick={onMassSkip}>
              {massSkipping ? <AdminButtonBusyLabel>Skipping…</AdminButtonBusyLabel> : skipLabel}
            </button>
          ) : null}
          <button type="button" className="btn btn-primary admin-invMiniBtn" disabled={massBusy} onClick={onMassSubmit}>
            {massSubmitting ? (
              massPostProgress ? (
                `${massPostProgress.completed}/${massPostProgress.total}`
              ) : (
                <AdminButtonBusyLabel>{submitLabel.toLowerCase().includes("post") ? "Posting…" : "Submitting…"}</AdminButtonBusyLabel>
              )
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </div>
      {children ? <div className="admin-massSubmitBarFields">{children}</div> : null}
      {massError ? (
        <div className="sell-ride-applyErrorBanner admin-massSubmitBarMessage" role="alert">
          <p className="sell-ride-applyError">{massError}</p>
        </div>
      ) : null}
      {massResultSummary ? (
        <p className="admin-massSubmitBarSummary" role="status">
          {massResultSummary}
        </p>
      ) : null}
    </div>
  );
}
