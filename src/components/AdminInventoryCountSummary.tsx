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
  const catalogOther = Math.max(0, catalog.total - catalog.fromImport);
  const catalogMatchesImport = catalog.fromImport === imp.postedInCatalog;

  return (
    <div className="admin-invCountSummary" role="region" aria-label="Inventory counts">
      <div className="admin-invCountSummaryBlock">
        <p className="admin-invCountSummaryTitle">Catalog</p>
        <p className="admin-invCountSummaryTotal">{formatAdminCount(catalog.total)} units</p>
        <ul className="admin-invCountSummaryList">
          <li>
            <span className="admin-invCountSummaryLabel">From import</span>
            <span className="admin-invCountSummaryValue">{formatAdminCount(catalog.fromImport)}</span>
          </li>
          {catalogOther > 0 ? (
            <li>
              <span className="admin-invCountSummaryLabel">Sell / manual</span>
              <span className="admin-invCountSummaryValue">{formatAdminCount(catalogOther)}</span>
            </li>
          ) : null}
          {INVENTORY_STATUS_VALUES.map((status) => (
            <li key={status}>
              <span className="admin-invCountSummaryLabel">{status}</span>
              <span className="admin-invCountSummaryValue">{formatAdminCount(catalog.byStatus[status])}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="admin-invCountSummaryBlock">
        <p className="admin-invCountSummaryTitle">Import queue</p>
        <p className="admin-invCountSummaryTotal">{formatAdminCount(imp.total)} rows</p>
        <ul className="admin-invCountSummaryList">
          <li>
            <span className="admin-invCountSummaryLabel">Pending</span>
            <span className="admin-invCountSummaryValue">{formatAdminCount(imp.pending)}</span>
          </li>
          <li>
            <span className="admin-invCountSummaryLabel">Posted (in catalog)</span>
            <span className="admin-invCountSummaryValue">{formatAdminCount(imp.postedInCatalog)}</span>
          </li>
          {imp.postedRemoved > 0 ? (
            <li>
              <span className="admin-invCountSummaryLabel">Posted (removed)</span>
              <span className="admin-invCountSummaryValue">{formatAdminCount(imp.postedRemoved)}</span>
            </li>
          ) : null}
          <li>
            <span className="admin-invCountSummaryLabel">Skipped</span>
            <span className="admin-invCountSummaryValue">{formatAdminCount(imp.skipped)}</span>
          </li>
        </ul>
        {imp.postedRemoved > 0 ? (
          <p className="admin-invCountSummaryNote">
            {formatAdminCount(imp.posted)} total import posts in the log — {formatAdminCount(imp.postedRemoved)} no
            longer in the catalog. Posted (in catalog) matches live import units
            {catalogMatchesImport ? "" : " when counts are reconciled"} ({formatAdminCount(imp.postedInCatalog)}).
          </p>
        ) : null}
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
