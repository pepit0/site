import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { InventoryPlaceholder } from "../components/InventoryPlaceholder";
import {
  inventoryDisplayTitle,
  inventoryStatusPillModifier,
  parseInventoryCategoryFromQuery,
  parseInventoryPublicRow,
  VEHICLE_CATEGORIES,
  type InventoryPublicRow,
  type VehicleCategory
} from "../data/inventory";
import { inventoryPhotoPublicUrl } from "../lib/inventoryPhotos";
import { supabase } from "../lib/supabase";

type SortKey = "year-desc" | "year-asc" | "make-asc" | "stock-asc";

export function InventoryPage() {
  const [searchParams] = useSearchParams();
  const categoryFromUrl = parseInventoryCategoryFromQuery(searchParams.get("category"));
  const [category, setCategory] = useState<VehicleCategory | "all">(categoryFromUrl);
  const [sort, setSort] = useState<SortKey>("year-desc");
  const [rows, setRows] = useState<InventoryPublicRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.from("inventory_units_public").select("*").order("year", { ascending: false });
    if (error) {
      setLoadError(error.message);
      setRows([]);
      setIsLoading(false);
      return;
    }
    const parsed = (data ?? []).map((r) => parseInventoryPublicRow(r)).filter((r): r is InventoryPublicRow => r != null);
    setRows(parsed);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCategory(categoryFromUrl);
  }, [categoryFromUrl]);

  const filteredSorted = useMemo(() => {
    const list = category === "all" ? [...rows] : rows.filter((i) => i.category === category);
    list.sort((a, b) => {
      switch (sort) {
        case "year-desc":
          return b.year - a.year;
        case "year-asc":
          return a.year - b.year;
        case "make-asc":
          return inventoryDisplayTitle(a).localeCompare(inventoryDisplayTitle(b), undefined, { sensitivity: "base" });
        case "stock-asc":
          return a.stock_number.localeCompare(b.stock_number, undefined, { sensitivity: "base" });
        default:
          return 0;
      }
    });
    return list;
  }, [category, rows, sort]);

  return (
    <div className="inventory">
      <header className="page-header">
        <h1 className="page-title">Inventory</h1>
        <p className="page-subtitle">
          Browse units by category. Sold units show a banner on the photo. Unlisted units are hidden here. Sort by year,
          stock number, or name.
        </p>
      </header>

      <div className="inventory-toolbar">
        <div className="inventory-filters" role="group" aria-label="Filter by vehicle type">
          <span className="inventory-toolbarLabel">Category</span>
          <div className="inventory-pills">
            <button
              type="button"
              className={`inventory-pill${category === "all" ? " inventory-pillActive" : ""}`}
              onClick={() => setCategory("all")}
            >
              All
            </button>
            {VEHICLE_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`inventory-pill${category === c ? " inventory-pillActive" : ""}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="inventory-sort">
          <label className="inventory-sortLabel" htmlFor="inv-sort">
            Sort by
          </label>
          <select id="inv-sort" className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="year-desc">Year (newest first)</option>
            <option value="year-asc">Year (oldest first)</option>
            <option value="make-asc">Make / model (A–Z)</option>
            <option value="stock-asc">Stock number (A–Z)</option>
          </select>
        </div>
      </div>

      {loadError ? (
        <p className="inventory-empty" role="alert">
          Could not load inventory ({loadError}). If this is a new project, run the SQL in <code className="staff-code">sql/marketing/</code> in Supabase.
        </p>
      ) : isLoading ? (
        <p className="inventory-empty" role="status">
          Loading inventory…
        </p>
      ) : filteredSorted.length === 0 ? (
        <p className="inventory-empty" role="status">
          No units in this category yet. Try another filter.
        </p>
      ) : (
        <ul className="inventory-grid">
          {filteredSorted.map((item) => (
            <li key={item.id} className="inventory-card">
              <div
                className={`inventory-cardMedia${item.status === "Sold" ? " inventory-cardMediaSold" : ""}`}
              >
                <div className="inventory-cardMediaFill">
                  {item.photo_paths.length > 0 ? (
                    <img
                      src={inventoryPhotoPublicUrl(supabase, item.photo_paths[0]!)}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <InventoryPlaceholder category={item.category} />
                  )}
                </div>
                {item.status === "Sold" ? (
                  <span className="inventory-soldRibbon" aria-hidden>
                    Sold
                  </span>
                ) : null}
              </div>
              <p className="inventory-cardMeta">
                <span className="inventory-cardCategory">{item.category}</span>
                <span
                  className={`inventory-status inventory-status${inventoryStatusPillModifier(item.status)}`}
                >
                  {item.status}
                </span>
              </p>
              <h2 className="inventory-cardTitle">{inventoryDisplayTitle(item)}</h2>
              <p className="inventory-cardYear">{item.year}</p>
              <p className="inventory-cardDetail">Stock #{item.stock_number}</p>
              <p className="inventory-cardDetail">
                {item.odometer_km != null ? `${item.odometer_km.toLocaleString()} km` : "Kms TBD"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
