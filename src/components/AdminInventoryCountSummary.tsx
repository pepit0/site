import { INVENTORY_STATUS_VALUES } from "../data/inventory";
import { formatAdminCount, type AdminInventoryCounts } from "../lib/adminInventoryCounts";

export type AdminInventoryCountSummaryProps = {
  counts: AdminInventoryCounts | null;
  loading?: boolean;
  error?: string | null;
};

export function AdminInventoryCountSummary({ counts, loading, error }: AdminInventoryCountSummaryProps) {
  if (error) {
    return (
      <div className="admin-invCountSummary admin-invCountSummaryError" role="status">
        <p className="sell-ride-applyError">Counts unavailable: {error}</p>
      </div>
    );
  }

  if (loading || !counts) {
    return (
      <div className="admin-invCountSummary" role="status" aria-live="polite">
        <p className="sell-ride-applyMuted">Loading counts…</p>
      </div>
    );
  }

  const { catalog, import: imp, sell, customer } = counts;

  return (
    <div className="admin-invCountSummary" role="region" aria-label="Inventory counts">
      <div className="admin-invCountSummaryBlock">
        <p className="admin-invCountSummaryTitle">Catalog</p>
        <p className="admin-invCountSummaryTotal">{formatAdminCount(catalog.total)} units</p>
        <ul className="admin-invCountSummaryList">
          {INVENTORY_STATUS_VALUES.map((status) => (
            <li key={status}>
              <span className="admin-invCountSummaryLabel">{status}</span>
              <span className="admin-invCountSummaryValue">{formatAdminCount(catalog.byStatus[status])}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="admin-invCountSummaryBlock">
        <p className="admin-invCountSummaryTitle">MSF import queue</p>
        <p className="admin-invCountSummaryTotal">{formatAdminCount(imp.total)} rows</p>
        <ul className="admin-invCountSummaryList">
          <li>
            <span className="admin-invCountSummaryLabel">Pending</span>
            <span className="admin-invCountSummaryValue">{formatAdminCount(imp.pending)}</span>
          </li>
          <li>
            <span className="admin-invCountSummaryLabel">Posted</span>
            <span className="admin-invCountSummaryValue">{formatAdminCount(imp.posted)}</span>
          </li>
          <li>
            <span className="admin-invCountSummaryLabel">Skipped</span>
            <span className="admin-invCountSummaryValue">{formatAdminCount(imp.skipped)}</span>
          </li>
        </ul>
      </div>
      <div className="admin-invCountSummaryBlock">
        <p className="admin-invCountSummaryTitle">Sell submissions</p>
        <p className="admin-invCountSummaryTotal">{formatAdminCount(sell.total)} rows</p>
        <ul className="admin-invCountSummaryList">
          <li>
            <span className="admin-invCountSummaryLabel">Submitted</span>
            <span className="admin-invCountSummaryValue">{formatAdminCount(sell.submitted)}</span>
          </li>
          <li>
            <span className="admin-invCountSummaryLabel">Rejected</span>
            <span className="admin-invCountSummaryValue">{formatAdminCount(sell.rejected)}</span>
          </li>
        </ul>
      </div>
      <div className="admin-invCountSummaryBlock">
        <p className="admin-invCountSummaryTitle">Customer units</p>
        <p className="admin-invCountSummaryTotal">{formatAdminCount(customer)} units</p>
      </div>
    </div>
  );
}
