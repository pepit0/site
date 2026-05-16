import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  INVENTORY_PUBLIC_STATUS_VALUES,
  inventoryComplianceLabel,
  inventoryDisplayTitle,
  inventoryStatusPillModifier,
  parseInventoryUnitRow,
  type InventoryUnitRow
} from "../data/inventory";
import { formatPhoneDisplay } from "../lib/formatPhone";
import { inventoryPhotoPublicUrl } from "../lib/inventoryPhotos";
import { supabase } from "../lib/supabase";

type SellRideJoin = {
  seller_first_name: string | null;
  seller_last_name: string | null;
  seller_phone: string | null;
  seller_email: string | null;
  submitted_at: string | null;
};

type CustomerUnitRow = InventoryUnitRow & {
  submission: SellRideJoin | null;
};

function parseSellRideJoin(raw: unknown): SellRideJoin | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  return {
    seller_first_name: typeof s.seller_first_name === "string" ? s.seller_first_name : null,
    seller_last_name: typeof s.seller_last_name === "string" ? s.seller_last_name : null,
    seller_phone: typeof s.seller_phone === "string" ? s.seller_phone : null,
    seller_email: typeof s.seller_email === "string" ? s.seller_email : null,
    submitted_at: typeof s.submitted_at === "string" ? s.submitted_at : null
  };
}

function sellerLabel(row: CustomerUnitRow): string {
  if (!row.submission) return "Catalog";
  const first = row.submission.seller_first_name?.trim() ?? "";
  const last = row.submission.seller_last_name?.trim() ?? "";
  const name = `${first} ${last}`.trim();
  if (name) return name;
  if (row.submission.seller_phone) return formatPhoneDisplay(row.submission.seller_phone);
  return row.submission.seller_email ?? "Sell your ride";
}

export function AdminCustomerUnitsPanel() {
  const [rows, setRows] = useState<CustomerUnitRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data: unitData, error: unitError } = await supabase
      .from("inventory_units")
      .select("*")
      .eq("is_customer_unit", true)
      .order("updated_at", { ascending: false });
    if (unitError) {
      setLoadError(unitError.message);
      setRows([]);
      setLoading(false);
      return;
    }
    const units = (unitData ?? [])
      .map((r) => parseInventoryUnitRow(r))
      .filter((r): r is InventoryUnitRow => r != null && r.is_customer_unit);

    const submissionIds = [...new Set(units.map((u) => u.sell_ride_submission_id).filter((id): id is string => id != null))];
    const submissionById = new Map<string, SellRideJoin>();
    if (submissionIds.length > 0) {
      const { data: subData, error: subError } = await supabase
        .from("sell_ride_submissions")
        .select("id, seller_first_name, seller_last_name, seller_phone, seller_email, submitted_at")
        .in("id", submissionIds);
      if (subError) {
        setLoadError(subError.message);
        setRows([]);
        setLoading(false);
        return;
      }
      for (const raw of subData ?? []) {
        if (!raw || typeof raw !== "object") continue;
        const r = raw as Record<string, unknown>;
        const id = r.id;
        if (typeof id !== "string") continue;
        const join = parseSellRideJoin(r);
        if (join) submissionById.set(id, join);
      }
    }

    setRows(
      units.map((unit) => ({
        ...unit,
        submission: unit.sell_ride_submission_id ? submissionById.get(unit.sell_ride_submission_id) ?? null : null
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  return (
    <section className="admin-sell-queueIntegrated" aria-labelledby="admin-customer-units-heading">
      <h2 id="admin-customer-units-heading" className="sell-ride-applySectionTitle admin-sell-queueIntegratedTitle">
        Customer units
      </h2>
      <p className="admin-invPanelIntro">
        Units listed on behalf of customers — published from sell-your-ride submissions or marked as customer units in the
        catalog.
      </p>
      {loadError ? (
        <div className="sell-ride-applyErrorBanner" role="alert">
          <p className="sell-ride-applyError">{loadError}</p>
        </div>
      ) : loading ? (
        <p className="sell-ride-applyMuted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="sell-ride-applyMuted">No customer units yet.</p>
      ) : (
        <div className="admin-invTableScroll">
          <table className="admin-invTable">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Stock</th>
                <th>Unit</th>
                <th>VIN</th>
                <th>Reg / ins</th>
                <th>Seller</th>
                <th>Status</th>
                <th className="admin-invTableActionsCol">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const publicListing = (INVENTORY_PUBLIC_STATUS_VALUES as readonly string[]).includes(row.status);
                return (
                  <tr key={row.id}>
                    <td>
                      {row.photo_paths[0] ? (
                        <img className="admin-invThumb" src={inventoryPhotoPublicUrl(supabase, row.photo_paths[0]!)} alt="" />
                      ) : (
                        <span className="sell-ride-applyMuted">—</span>
                      )}
                    </td>
                    <td>{row.stock_number}</td>
                    <td>
                      {row.year} {inventoryDisplayTitle(row)}
                      <div className="admin-invTableCategory">{row.category}</div>
                    </td>
                    <td>{row.vin?.trim() ? row.vin : "—"}</td>
                    <td>{inventoryComplianceLabel(row)}</td>
                    <td>{sellerLabel(row)}</td>
                    <td>
                      <span className={`inventory-status inventory-status${inventoryStatusPillModifier(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="admin-invTableActionsCol">
                      <div className="admin-invRowActions">
                        <Link className="btn btn-secondary admin-invMiniBtn" to={`/admin/inventory?edit=${row.id}`}>
                          Edit in catalog
                        </Link>
                        {publicListing ? (
                          <Link className="btn btn-secondary admin-invMiniBtn" to={`/inventory/${row.id}`}>
                            View on site
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
