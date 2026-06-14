import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import {
  buildFacebookMarketplaceSearchUrl,
  buildMarketplaceQueryText,
  MARKETPLACE_LOCATION_OPTIONS,
  normalizeLocationSlug,
  type MarketplaceCompResultRow,
  type MarketplaceCompSearchRow
} from "../lib/marketplaceCompSearch";
import { supabase } from "../lib/supabase";
import { Seo } from "../seo/Seo";

function parseOptionalMoney(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseFloat(t.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function formatMoneyCad(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type SearchForm = {
  year: string;
  make: string;
  model: string;
  locationSlug: string;
  minPrice: string;
  maxPrice: string;
};

const DEFAULT_FORM: SearchForm = {
  year: "",
  make: "",
  model: "",
  locationSlug: "edmonton",
  minPrice: "",
  maxPrice: ""
};

export function AdminMarketplaceCompPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSearchId = searchParams.get("search") ?? "";

  const [form, setForm] = useState<SearchForm>(DEFAULT_FORM);
  const [activeSearch, setActiveSearch] = useState<MarketplaceCompSearchRow | null>(null);
  const [results, setResults] = useState<MarketplaceCompResultRow[]>([]);
  const [recentSearches, setRecentSearches] = useState<MarketplaceCompSearchRow[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);

  const unitIdParam = searchParams.get("unitId");

  const previewQuery = useMemo(() => {
    const year = form.year.trim() ? Number.parseInt(form.year, 10) : null;
    if (!form.make.trim() || !form.model.trim()) return null;
    return buildMarketplaceQueryText({
      year: year != null && Number.isFinite(year) ? year : null,
      make: form.make,
      model: form.model
    });
  }, [form.make, form.model, form.year]);

  const previewUrl = useMemo(() => {
    const year = form.year.trim() ? Number.parseInt(form.year, 10) : null;
    if (form.year.trim() && !Number.isFinite(year)) return null;
    if (!form.make.trim() || !form.model.trim()) return null;
    return buildFacebookMarketplaceSearchUrl({
      year: year != null && Number.isFinite(year) ? year : null,
      make: form.make,
      model: form.model,
      locationSlug: form.locationSlug,
      minPriceCad: parseOptionalMoney(form.minPrice),
      maxPriceCad: parseOptionalMoney(form.maxPrice)
    });
  }, [form]);

  const loadRecentSearches = useCallback(async () => {
    const { data, error } = await supabase
      .from("marketplace_comp_searches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(12);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setRecentSearches((data ?? []) as MarketplaceCompSearchRow[]);
  }, []);

  const loadSearchBundle = useCallback(async (searchId: string) => {
    if (!searchId) {
      setActiveSearch(null);
      setResults([]);
      return;
    }
    setLoadingResults(true);
    setLoadError(null);
    const [{ data: searchData, error: searchError }, { data: resultData, error: resultError }] =
      await Promise.all([
        supabase.from("marketplace_comp_searches").select("*").eq("id", searchId).maybeSingle(),
        supabase
          .from("marketplace_comp_results")
          .select("*")
          .eq("search_id", searchId)
          .order("similarity_score", { ascending: false, nullsFirst: false })
          .order("scraped_at", { ascending: false })
      ]);

    setLoadingResults(false);

    if (searchError) {
      setLoadError(searchError.message);
      return;
    }
    if (resultError) {
      setLoadError(resultError.message);
      return;
    }

    const search = (searchData as MarketplaceCompSearchRow | null) ?? null;
    setActiveSearch(search);
    setResults((resultData ?? []) as MarketplaceCompResultRow[]);

    if (search) {
      setForm({
        year: search.year != null ? String(search.year) : "",
        make: search.make,
        model: search.model,
        locationSlug: search.location_slug,
        minPrice: search.min_price_cad != null ? String(search.min_price_cad) : "",
        maxPrice: search.max_price_cad != null ? String(search.max_price_cad) : ""
      });
    }
  }, []);

  useEffect(() => {
    void loadRecentSearches();
  }, [loadRecentSearches]);

  useEffect(() => {
    void loadSearchBundle(activeSearchId);
  }, [activeSearchId, loadSearchBundle]);

  useEffect(() => {
    if (!unitIdParam) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("inventory_units")
        .select("year, make, model")
        .eq("id", unitIdParam)
        .maybeSingle();
      if (cancelled || error || !data) return;
      setForm((prev) => ({
        ...prev,
        year: data.year != null ? String(data.year) : prev.year,
        make: typeof data.make === "string" ? data.make : prev.make,
        model: typeof data.model === "string" ? data.model : prev.model
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [unitIdParam]);

  const selectSearch = (searchId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("search", searchId);
    setSearchParams(params, { replace: true });
  };

  const runSearch = async () => {
    setFormError(null);
    const year = form.year.trim() ? Number.parseInt(form.year, 10) : null;
    if (form.year.trim() && (!Number.isFinite(year) || year! < 1970 || year! > 2100)) {
      setFormError("Enter a valid year, or leave it blank.");
      return;
    }
    if (!form.make.trim()) {
      setFormError("Make is required.");
      return;
    }
    if (!form.model.trim()) {
      setFormError("Model is required.");
      return;
    }

    const searchInput = {
      year: year != null && Number.isFinite(year) ? year : null,
      make: form.make,
      model: form.model,
      locationSlug: normalizeLocationSlug(form.locationSlug) || "edmonton",
      minPriceCad: parseOptionalMoney(form.minPrice),
      maxPriceCad: parseOptionalMoney(form.maxPrice)
    };

    const facebookUrl = buildFacebookMarketplaceSearchUrl(searchInput);
    const queryText = buildMarketplaceQueryText(searchInput);

    setSubmitting(true);
    const { data, error } = await supabase
      .from("marketplace_comp_searches")
      .insert({
        inventory_unit_id: unitIdParam || null,
        year: searchInput.year,
        make: searchInput.make.trim(),
        model: searchInput.model.trim(),
        query_text: queryText,
        location_slug: searchInput.locationSlug,
        min_price_cad: searchInput.minPriceCad,
        max_price_cad: searchInput.maxPriceCad,
        facebook_search_url: facebookUrl,
        created_by: user?.id ?? null
      })
      .select("*")
      .single();

    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    const row = data as MarketplaceCompSearchRow;
    await loadRecentSearches();
    selectSearch(row.id);
    window.open(facebookUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="admin-comp">
      <Seo title="Facebook comp search" description="Search Facebook Marketplace for similar listings." path="/admin/marketplace-comps" noindex />
      <header className="page-header">
        <h1 className="page-title">Facebook comp search</h1>
        <p className="page-subtitle">
          Search year / make / model on Facebook Marketplace (newest first). Use the capture extension to import visible
          listings, then refresh results here.
        </p>
      </header>

      {loadError ? (
        <p className="admin-compError" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="admin-compGrid">
        <section className="card card-pad admin-compFormCard">
          <h2 className="admin-compSectionTitle">New search</h2>
          <div className="admin-compFormGrid">
            <div className="form-row">
              <label className="form-label" htmlFor="comp-year">
                Year
              </label>
              <input
                id="comp-year"
                className="input"
                inputMode="numeric"
                placeholder="2022"
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="comp-make">
                Make <span className="form-required">*</span>
              </label>
              <input
                id="comp-make"
                className="input"
                placeholder="Can-Am"
                value={form.make}
                onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="comp-model">
                Model <span className="form-required">*</span>
              </label>
              <input
                id="comp-model"
                className="input"
                placeholder="Outlander 850"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                required
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="comp-location">
                Marketplace city
              </label>
              <select
                id="comp-location"
                className="select"
                value={form.locationSlug}
                onChange={(e) => setForm((f) => ({ ...f, locationSlug: e.target.value }))}
              >
                {MARKETPLACE_LOCATION_OPTIONS.map((opt) => (
                  <option key={opt.slug} value={opt.slug}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="comp-min">
                Min price (CAD)
              </label>
              <input
                id="comp-min"
                className="input"
                inputMode="decimal"
                placeholder="Optional"
                value={form.minPrice}
                onChange={(e) => setForm((f) => ({ ...f, minPrice: e.target.value }))}
              />
            </div>
            <div className="form-row">
              <label className="form-label" htmlFor="comp-max">
                Max price (CAD)
              </label>
              <input
                id="comp-max"
                className="input"
                inputMode="decimal"
                placeholder="Optional"
                value={form.maxPrice}
                onChange={(e) => setForm((f) => ({ ...f, maxPrice: e.target.value }))}
              />
            </div>
          </div>

          {formError ? (
            <p className="admin-compError" role="alert">
              {formError}
            </p>
          ) : null}

          {previewQuery ? (
            <p className="form-hint admin-compPreview">
              Facebook query: <code>{previewQuery}</code>
            </p>
          ) : null}

          <div className="admin-compActions">
            <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => void runSearch()}>
              {submitting ? "Saving…" : "Search on Facebook"}
            </button>
            {previewUrl ? (
              <a className="btn btn-secondary" href={previewUrl} target="_blank" rel="noopener noreferrer">
                Open link only
              </a>
            ) : null}
          </div>

          {unitIdParam ? (
            <p className="form-hint">
              Pre-filled from inventory unit.{" "}
              <Link to={`/admin/inventory?edit=${encodeURIComponent(unitIdParam)}`}>Back to unit</Link>
            </p>
          ) : null}
        </section>

        <section className="card card-pad admin-compSideCard">
          <h2 className="admin-compSectionTitle">Capture extension</h2>
          <p className="form-hint">
            Load the unpacked extension from <code>extension/marketplace-comp-capture/</code>. On Facebook search results,
            click <strong>Capture visible listings</strong>. See <code>docs/MARKETPLACE_COMP_SEARCH.md</code>.
          </p>
          {activeSearch ? (
            <div className="admin-compActiveSearch">
              <p className="admin-compActiveLabel">Active search ID</p>
              <code className="admin-compSearchId">{activeSearch.id}</code>
              <p className="form-hint">Created {formatWhen(activeSearch.created_at)}</p>
              <button
                type="button"
                className="btn btn-secondary admin-compRefreshBtn"
                disabled={loadingResults}
                onClick={() => void loadSearchBundle(activeSearch.id)}
              >
                {loadingResults ? "Refreshing…" : "Refresh results"}
              </button>
            </div>
          ) : (
            <p className="form-hint">Run a search to get a search ID for the extension.</p>
          )}

          {recentSearches.length > 0 ? (
            <>
              <h3 className="admin-compSubTitle">Recent searches</h3>
              <ul className="admin-compRecentList">
                {recentSearches.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`admin-compRecentBtn${s.id === activeSearchId ? " admin-compRecentBtnActive" : ""}`}
                      onClick={() => selectSearch(s.id)}
                    >
                      <span className="admin-compRecentQuery">{s.query_text}</span>
                      <span className="admin-compRecentMeta">
                        {MARKETPLACE_LOCATION_OPTIONS.find((o) => o.slug === s.location_slug)?.label ?? s.location_slug} ·{" "}
                        {formatWhen(s.created_at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>

      <section className="card card-pad admin-compResultsCard">
        <div className="admin-compResultsHeader">
          <h2 className="admin-compSectionTitle">Captured listings</h2>
          {activeSearch ? (
            <a
              className="btn btn-secondary"
              href={activeSearch.facebook_search_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Facebook search
            </a>
          ) : null}
        </div>

        {!activeSearchId ? (
          <p className="inventory-empty" role="status">
            Run a search to see comp results here.
          </p>
        ) : loadingResults ? (
          <p className="inventory-empty" role="status">
            Loading…
          </p>
        ) : results.length === 0 ? (
          <p className="inventory-empty" role="status">
            No listings captured yet. Open Facebook, scroll the results, then use the extension.
          </p>
        ) : (
          <div className="admin-compTableWrap">
            <table className="admin-compTable">
              <thead>
                <tr>
                  <th scope="col">Match</th>
                  <th scope="col">Title</th>
                  <th scope="col">Price</th>
                  <th scope="col">Location</th>
                  <th scope="col">Posted</th>
                  <th scope="col">Captured</th>
                  <th scope="col">Link</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr key={row.id}>
                    <td>{row.similarity_score != null ? `${row.similarity_score}%` : "—"}</td>
                    <td>{row.title}</td>
                    <td>{row.price_text ?? formatMoneyCad(row.price_cad)}</td>
                    <td>{row.location_text ?? "—"}</td>
                    <td>{row.posted_label ?? "—"}</td>
                    <td>{formatWhen(row.scraped_at)}</td>
                    <td>
                      <a href={row.listing_url} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
