import type { ReactNode } from "react";

export type AdminQueueMassSubmitBarProps = {
  selectedCount: number;
  itemLabel: string;
  onClearSelection: () => void;
  onMassSubmit: () => void;
  massSubmitting: boolean;
  massError: string | null;
  massResultSummary: string | null;
  children?: ReactNode;
  submitLabel?: string;
};

export function AdminQueueMassSubmitBar({
  selectedCount,
  itemLabel,
  onClearSelection,
  onMassSubmit,
  massSubmitting,
  massError,
  massResultSummary,
  children,
  submitLabel = "Mass submit"
}: AdminQueueMassSubmitBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="admin-massSubmitBar" role="region" aria-label="Mass submit">
      <div className="admin-massSubmitBarHead">
        <p className="admin-massSubmitBarCount">
          {selectedCount} {itemLabel}
          {selectedCount === 1 ? "" : "s"} selected
        </p>
        <div className="admin-massSubmitBarActions">
          <button type="button" className="btn btn-secondary admin-invMiniBtn" disabled={massSubmitting} onClick={onClearSelection}>
            Clear selection
          </button>
          <button type="button" className="btn btn-primary admin-invMiniBtn" disabled={massSubmitting} onClick={onMassSubmit}>
            {massSubmitting ? "Submitting…" : submitLabel}
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
