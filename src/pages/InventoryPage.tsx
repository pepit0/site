import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { InventoryUnitCard } from "../components/InventoryUnitCard";
import {
  INVENTORY_COMING_SOON_CATEGORIES,
  inventoryDisplayTitle,
  isInventoryComingSoonCategory,
  parseInventoryCategoryFromQuery,
  parseInventoryPublicRow,
  VEHICLE_CATEGORIES,
  type InventoryBrowseCategory,
  type InventoryPublicRow,
  type VehicleCategory
} from "../data/inventory";
import {
  financingNavLabelForCategory,
  financingPathForCategory
} from "../lib/inventoryFinancingRoutes";
import { inventoryRowMatchesSearch } from "../lib/inventorySearch";
import { supabase } from "../lib/supabase";
import { InventoryItemListJsonLd } from "../seo/InventoryItemListJsonLd";
import { INVENTORY_AUTO_COMING_SOON, INVENTORY_SOURCING_BLURB } from "../data/inventoryCopy";
import { inventoryPageSeoMeta } from "../lib/inventoryPageSeo";
import { Seo } from "../seo/Seo";

type SortKey = "year-desc" | "year-asc" | "make-asc" | "stock-asc";

function inventoryEmptyMessage(category: InventoryBrowseCategory, searchQuery: string): string {
  const q = searchQuery.trim();
  if (q && category !== "all") {
    return `Nothing matches “${q}” in ${category}. Try new words or clear the search.`;
  }
  if (q) {
    return `Nothing matches “${q}”. Try stock #, year, make, model, or ATV or jetski.`;
  }
  if (category !== "all") {
    return "Nothing in this group right now. Try another filter. Or ask us to find a ride for you.";
  }
  return "Nothing listed right now. We can still help you find a ride all over Canada.";
}

export function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromUrl = parseInventoryCategoryFromQuery(searchParams.get("category"));
  const searchFromUrl = searchParams.get("q") ?? "";
  const [category, setCategory] = useState<InventoryBrowseCategory>(categoryFromUrl);
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
    (nextCategory: InventoryBrowseCategory, nextSearch: string) => {
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
    (next: InventoryBrowseCategory) => {
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

  const isComingSoonCategory = isInventoryComingSoonCategory(category);

  const categoryFiltered = useMemo(() => {
    if (isInventoryComingSoonCategory(category)) return [];
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

  const showResultCount = !isLoading && !loadError && !isComingSoonCategory && rows.length > 0;
  const resultSummary =
    filteredSorted.length === categoryFiltered.length
      ? `${filteredSorted.length} unit${filteredSorted.length === 1 ? "" : "s"}`
      : `Showing ${filteredSorted.length} of ${categoryFiltered.length}`;
  const categoryFinancingPath =
    category !== "all" && !isComingSoonCategory
      ? financingPathForCategory(category as VehicleCategory)
      : null;
  const categoryFinancingLabel =
    category !== "all" && !isComingSoonCategory
      ? financingNavLabelForCategory(category as VehicleCategory)
      : null;
  const pageSeo = inventoryPageSeoMeta(category, searchFromUrl);

  return (
    <div className="inventory">
      <Seo
        title={pageSeo.title}
        description={pageSeo.description}
        path="/inventory"
        noindex={pageSeo.noindex}
      />
      {rows.length > 0 ? (
        <InventoryItemListJsonLd rows={rows.filter((row) => row.status !== "Sold")} />
      ) : null}
      <header className="page-header">
        <h1 className="page-title">Rides for sale</h1>
      </header>

      <section className="inventory-seoBlurb" aria-labelledby="inventory-seo-heading">
        <div className="inventory-seoBlurbRow">
          <div className="inventory-seoBlurbIntro">
            <h2 id="inventory-seo-heading" className="inventory-seoBlurbTitle">
              ATVs, sleds, bikes, trailers, RVs, and more
            </h2>
            <p className="inventory-seoBlurbText">
              Shop rides for your next adventure. Many buyers get a{" "}
              <Link className="inventory-seoBlurbLink" to="/apply">
                loan to pay for their ride
              </Link>
              . We are in Edmonton. We help buyers all over Canada. Start with our{" "}
              <Link className="inventory-seoBlurbLink" to="/financing">
                financing guides
              </Link>{" "}
              or read the{" "}
              <Link className="inventory-seoBlurbLink" to="/faq">
                FAQ
              </Link>
              .
            </p>
          </div>
          <aside className="inventory-seoBlurbAside" aria-labelledby="inventory-sourcing-heading">
            <h3 id="inventory-sourcing-heading" className="inventory-seoBlurbSubheading">
              {INVENTORY_SOURCING_BLURB.heading}
            </h3>
            <p className="inventory-seoBlurbText">
              {INVENTORY_SOURCING_BLURB.textBeforeCta}{" "}
              <span className="inventory-seoBlurbCtaLine">
                below.{" "}
                <Link className="inventory-seoBlurbLink" to="/apply">
                  {INVENTORY_SOURCING_BLURB.applyLinkText}
                </Link>
                .
              </span>
            </p>
          </aside>
        </div>
      </section>
      {categoryFinancingPath && categoryFinancingLabel ? (
        <p className="inventory-categoryFinancingLink">
          Shopping {category}? See our{" "}
          <Link className="inventory-seoBlurbLink" to={categoryFinancingPath}>
            {categoryFinancingLabel.toLowerCase()}
          </Link>{" "}
          guide.
        </p>
      ) : null}

      <div className="inventory-toolbar">
        <div className="inventory-search">
          <label className="inventory-toolbarLabel" htmlFor="inventory-search">
            Search rides
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
              {INVENTORY_COMING_SOON_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`inventory-pill inventory-pill--comingSoon${category === c ? " inventory-pillActive" : ""}`}
                  onClick={() => handleCategoryChange(c)}
                >
                  {c}
                  <span className="inventory-pillSoon">Coming soon</span>
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
      ) : isComingSoonCategory ? (
        <div className="inventory-comingSoon" role="status">
          <p className="inventory-comingSoonEyebrow">{INVENTORY_AUTO_COMING_SOON.eyebrow}</p>
          <h2 className="inventory-comingSoonTitle">{INVENTORY_AUTO_COMING_SOON.title}</h2>
          <p className="inventory-comingSoonText">{INVENTORY_AUTO_COMING_SOON.text}</p>
          <Link className="btn btn-primary inventory-comingSoonCta" to="/apply">
            {INVENTORY_AUTO_COMING_SOON.applyLinkText}
          </Link>
        </div>
      ) : filteredSorted.length === 0 ? (
        <div className="inventory-emptyBlock" role="status">
          <p className="inventory-empty">{inventoryEmptyMessage(category, searchQuery)}</p>
          <p className="inventory-emptySourcing">
            {INVENTORY_SOURCING_BLURB.textFull}{" "}
            <Link className="inventory-seoBlurbLink" to="/apply">
              {INVENTORY_SOURCING_BLURB.applyLinkText}
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="inventory-grid">
          {filteredSorted.map((item) => (
            <li key={item.id}>
              <InventoryUnitCard
                item={item}
                fromCategory={category === "all" || isInventoryComingSoonCategory(category) ? "all" : category}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
