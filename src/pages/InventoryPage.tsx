import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { InventoryUnitCard } from "../components/InventoryUnitCard";
import {
  inventoryDisplayTitle,
  parseInventoryCategoryFromQuery,
  parseInventoryPublicRow,
  VEHICLE_CATEGORIES,
  type InventoryPublicRow,
  type VehicleCategory
} from "../data/inventory";
import { inventoryRowMatchesSearch } from "../lib/inventorySearch";
import { supabase } from "../lib/supabase";
import { Seo } from "../seo/Seo";

type SortKey = "year-desc" | "year-asc" | "make-asc" | "stock-asc";

function inventoryEmptyMessage(category: VehicleCategory | "all", searchQuery: string): string {
  const q = searchQuery.trim();
  if (q && category !== "all") {
    return `No units match “${q}” in ${category}. Try different keywords or clear the search.`;
  }
  if (q) {
    return `No units match “${q}”. Try stock number, year, make, model, or a category like ATV or jetski.`;
  }
  if (category !== "all") {
    return "No units in this category yet. Try another filter.";
  }
  return "No units available yet.";
}

export function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromUrl = parseInventoryCategoryFromQuery(searchParams.get("category"));
  const searchFromUrl = searchParams.get("q") ?? "";
  const [category, setCategory] = useState<VehicleCategory | "all">(categoryFromUrl);
  const [searchQuery, setSearchQuery] = useState(searchFromUrl);
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
    void Promise.resolve().then(() => load());
  }, [load]);

  useEffect(() => {
    queueMicrotask(() => {
      setCategory(categoryFromUrl);
    });
  }, [categoryFromUrl]);

  useEffect(() => {
    queueMicrotask(() => {
      setSearchQuery(searchFromUrl);
    });
  }, [searchFromUrl]);

  const updateSearchParams = useCallback(
    (nextCategory: VehicleCategory | "all", nextSearch: string) => {
      const params = new URLSearchParams();
      if (nextCategory !== "all") {
        params.set("category", nextCategory);
      }
      const trimmed = nextSearch.trim();
      if (trimmed) {
        params.set("q", trimmed);
      }
      setSearchParams(params, { replace: true });
    },
    [setSearchParams]
  );

  const handleCategoryChange = useCallback(
    (next: VehicleCategory | "all") => {
      setCategory(next);
      updateSearchParams(next, searchQuery);
    },
    [searchQuery, updateSearchParams]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      updateSearchParams(category, value);
    },
    [category, updateSearchParams]
  );

  const categoryFiltered = useMemo(() => {
    if (category === "all") return rows;
    return rows.filter((i) => i.category === category);
  }, [category, rows]);

  const filteredSorted = useMemo(() => {
    const list = categoryFiltered.filter((row) => inventoryRowMatchesSearch(row, searchQuery));
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
  }, [categoryFiltered, searchQuery, sort]);

  const showResultCount = !isLoading && !loadError && rows.length > 0;
  const resultSummary =
    filteredSorted.length === categoryFiltered.length
      ? `${filteredSorted.length} unit${filteredSorted.length === 1 ? "" : "s"}`
      : `Showing ${filteredSorted.length} of ${categoryFiltered.length}`;

  return (
    <div className="inventory">
      <Seo
        title="Inventory"
        description="Browse motorcycles, ATVs, snowmobiles, side-by-sides, trailers, RVs, and more. Sold units marked; unlisted units hidden. Financing available through Temptation Motorsports."
        path="/inventory"
      />
      <header className="page-header">
        <h1 className="page-title">Inventory</h1>
      </header>

      <section className="inventory-seoBlurb" aria-labelledby="inventory-seo-heading">
        <h2 id="inventory-seo-heading" className="inventory-seoBlurbTitle">
          ATVs, sleds, bikes, trailers &amp; RVs, and more
        </h2>
        <p className="inventory-seoBlurbText">
          Shop our lineup for your next ride, including trailers and RVs. Many buyers pair a unit with{" "}
          <Link className="inventory-seoBlurbLink" to="/pre-approval">
            powersports financing
          </Link>
          . We are based in Edmonton and work with customers across Canada.
        </p>
      </section>

      <div className="inventory-toolbar">
        <div className="inventory-search">
          <label className="inventory-toolbarLabel" htmlFor="inventory-search">
            Search inventory
          </label>
          <div className="inventory-searchField">
            <input
              id="inventory-search"
              type="search"
              className="input inventory-searchInput"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Stock #, year, make, model, ATV, jetski, dirt bike…"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
            />
            {searchQuery.trim() ? (
              <button
                type="button"
                className="inventory-searchClear"
                onClick={() => handleSearchChange("")}
                aria-label="Clear search"
              >
                Clear
              </button>
            ) : null}
          </div>
          {showResultCount ? (
            <p className="inventory-searchStatus" role="status" aria-live="polite">
              {resultSummary}
              {searchQuery.trim() ? ` for “${searchQuery.trim()}”` : category !== "all" ? ` in ${category}` : ""}
            </p>
          ) : null}
        </div>

        <div className="inventory-toolbarRow">
          <div className="inventory-filters" role="group" aria-label="Filter by vehicle type">
            <span className="inventory-toolbarLabel">Category</span>
            <div className="inventory-pills">
              <button
                type="button"
                className={`inventory-pill${category === "all" ? " inventory-pillActive" : ""}`}
                onClick={() => handleCategoryChange("all")}
              >
                All
              </button>
              {VEHICLE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`inventory-pill${category === c ? " inventory-pillActive" : ""}`}
                  onClick={() => handleCategoryChange(c)}
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
          {inventoryEmptyMessage(category, searchQuery)}
        </p>
      ) : (
        <ul className="inventory-grid">
          {filteredSorted.map((item) => (
            <li key={item.id}>
              <InventoryUnitCard item={item} fromCategory={category} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
