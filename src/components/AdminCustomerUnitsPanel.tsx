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

export type AdminCustomerUnitsPanelProps = {
  onInventoryChanged?: () => void;
};

export function AdminCustomerUnitsPanel({ onInventoryChanged: _onInventoryChanged }: AdminCustomerUnitsPanelProps) {
  const [rows, setRows] = useState<CustomerUnitRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  useEffect(() => {
    if (loading) return;
    if (rows.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((id) => (id && rows.some((r) => r.id === id) ? id : rows[0]!.id));
  }, [loading, rows]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const publicListing = selected
    ? (INVENTORY_PUBLIC_STATUS_VALUES as readonly string[]).includes(selected.status)
    : false;

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
        <div className="admin-invCatalogLayout">
          <section className="sell-ride-applyForm admin-sell-queueCard admin-invListPanel" aria-label="Customer units list">
            <h3 className="sell-ride-applyPhotosTitle">Units</h3>
            <div className="admin-invUnitListScroll">
              <ul className="admin-invUnitItems">
                {rows.map((row) => {
                  const active = row.id === selectedId;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        className={`admin-invUnitItem${active ? " admin-invUnitItemActive" : ""}`}
                        onClick={() => setSelectedId(row.id)}
                      >
                        {row.photo_paths[0] ? (
                          <img
                            className="admin-invUnitItemThumb"
                            src={inventoryPhotoPublicUrl(supabase, row.photo_paths[0]!)}
                            alt=""
                          />
                        ) : (
                          <span className="admin-invUnitItemThumbPlaceholder" aria-hidden>
                            —
                          </span>
                        )}
                        <span className="admin-invUnitItemText">
                          <span className="admin-invUnitItemTitle">
                            #{row.stock_number} · {inventoryDisplayTitle(row)}
                          </span>
                          <span className="admin-invUnitItemMeta">
                            {row.year} · {row.category} · {sellerLabel(row)}
                          </span>
                          <span
                            className={`inventory-status inventory-status${inventoryStatusPillModifier(row.status)} admin-invUnitItemStatus`}
                          >
                            {row.status}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <section className="sell-ride-applyForm admin-sell-queueCard admin-invDetailPanel" aria-label="Customer unit detail">
            {!selected ? (
              <p className="sell-ride-applyMuted admin-sell-detailEmpty">Select a unit to view details.</p>
            ) : (
              <>
                <h3 className="sell-ride-applyPhotosTitle">
                  #{selected.stock_number} · {inventoryDisplayTitle(selected)}
                </h3>
                <dl className="sell-ride-applyDl">
                  <div className="sell-ride-applyDlRow">
                    <dt>Year</dt>
                    <dd>{selected.year}</dd>
                  </div>
                  <div className="sell-ride-applyDlRow">
                    <dt>Category</dt>
                    <dd>{selected.category}</dd>
                  </div>
                  <div className="sell-ride-applyDlRow">
                    <dt>VIN</dt>
                    <dd>{selected.vin?.trim() ? selected.vin : "—"}</dd>
                  </div>
                  <div className="sell-ride-applyDlRow">
                    <dt>Reg / insurance</dt>
                    <dd>{inventoryComplianceLabel(selected)}</dd>
                  </div>
                  <div className="sell-ride-applyDlRow">
                    <dt>Seller</dt>
                    <dd>{sellerLabel(selected)}</dd>
                  </div>
                  {selected.submission?.seller_phone ? (
                    <div className="sell-ride-applyDlRow">
                      <dt>Phone</dt>
                      <dd>
                        <a className="admin-sell-detailPhone" href={`tel:${selected.submission.seller_phone}`}>
                          {formatPhoneDisplay(selected.submission.seller_phone)}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {selected.submission?.seller_email ? (
                    <div className="sell-ride-applyDlRow">
                      <dt>Email</dt>
                      <dd>
                        <a href={`mailto:${selected.submission.seller_email}`}>{selected.submission.seller_email}</a>
                      </dd>
                    </div>
                  ) : null}
                  <div className="sell-ride-applyDlRow">
                    <dt>Status</dt>
                    <dd>
                      <span className={`inventory-status inventory-status${inventoryStatusPillModifier(selected.status)}`}>
                        {selected.status}
                      </span>
                    </dd>
                  </div>
                </dl>
                <div className="admin-invRowActions admin-customerUnitDetailActions">
                  <Link className="btn btn-secondary admin-invMiniBtn" to={`/admin/inventory?edit=${selected.id}`}>
                    Edit in catalog
                  </Link>
                  {publicListing ? (
                    <Link className="btn btn-secondary admin-invMiniBtn" to={`/inventory/${selected.id}`}>
                      View on site
                    </Link>
                  ) : null}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
