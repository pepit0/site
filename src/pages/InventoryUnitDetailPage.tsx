import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { InventoryCallForPricingLink } from "../components/InventoryCallForPricingLink";
import { InventoryMessageUsLink } from "../components/InventoryMessageUsLink";
import { InventoryPhotoCarousel } from "../components/InventoryPhotoCarousel";
import { InventorySimilarUnits } from "../components/InventorySimilarUnits";
import {
  INVENTORY_UNIT_DESCRIPTION,
  inventoryMakeModelTitle,
  inventoryOdometerLabel,
  inventoryStatusPillModifier,
  parseInventoryPublicRow,
  type InventoryPublicRow,
  type VehicleCategory
} from "../data/inventory";
import { SITE_CONTACT } from "../data/preapprovalCopy";
import {
  financingNavLabelForCategory,
  financingPathForCategory
} from "../lib/inventoryFinancingRoutes";
import { buildInventoryUnitListingParagraphs } from "../lib/inventoryUnitPageCopy";
import { inventoryCategoryHref } from "../lib/inventoryRoutes";
import { pickSimilarInventoryUnits } from "../lib/inventorySimilarUnits";
import { recordInventoryView } from "../lib/recentInventoryViews";
import { supabase } from "../lib/supabase";
import { InventoryProductJsonLd } from "../seo/InventoryProductJsonLd";
import {
  formatInventoryPriceCad,
  inventoryPublicListPriceCad
} from "../lib/inventoryPublicPrice";
import { BreadcrumbJsonLd } from "../seo/BreadcrumbJsonLd";
import {
  inventoryUnitCanonicalPath,
  inventoryUnitPrimaryImage,
  inventoryUnitSeoDescription,
  inventoryUnitSeoDocumentTitle
} from "../seo/inventoryStructuredData";
import { Seo } from "../seo/Seo";

type LocationState = { fromCategory?: VehicleCategory | "all" } | null;

function inventoryBackHref(fromCategory: VehicleCategory | "all" | undefined): string {
  if (fromCategory && fromCategory !== "all") {
    return `/inventory?category=${encodeURIComponent(fromCategory)}`;
  }
  return "/inventory";
}

function InventoryUnitDescriptionBlock({ row, unitId }: { row: InventoryPublicRow; unitId: string }) {
  const listingParagraphs = buildInventoryUnitListingParagraphs(row);
  const financingPath = financingPathForCategory(row.category);
  const financingLabel = financingNavLabelForCategory(row.category);

  return (
    <>
      {listingParagraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 48)} className="inventory-detailListingCopy">
          {paragraph}
        </p>
      ))}

      <h3 className="inventory-detailFinancingHeading">Financing this ride</h3>
      <p className="inventory-detailDescriptionText">{INVENTORY_UNIT_DESCRIPTION}</p>
      <p className="inventory-detailDescriptionText">
        Learn about{" "}
        <Link to={financingPath} className="inventory-seoBlurbLink">
          {financingLabel.toLowerCase()}
        </Link>{" "}
        for this category.
      </p>
      <p className="inventory-detailDescriptionCtas">
        What&apos;s next?
        <br />
        📱 CALL / TEXT: <a href={`tel:${SITE_CONTACT.phoneTel}`}>{SITE_CONTACT.phoneDisplay}</a>
      </p>
      <Link
        to={`/apply?unit=${encodeURIComponent(unitId)}`}
        className="btn btn-primary inventory-detailApplyBtn"
      >
        Apply for this ride!
      </Link>
      <p className="inventory-detailRelatedLinks">
        More help: <Link to="/financing">Financing guides</Link> ·{" "}
        <Link to="/faq">FAQ</Link> · <Link to="/payment-calculator">Payment calculator</Link>
      </p>
    </>
  );
}

export function InventoryUnitDetailPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const location = useLocation();
  const fromCategory = (location.state as LocationState)?.fromCategory;

  const [row, setRow] = useState<InventoryPublicRow | null>(null);
  const [peerRows, setPeerRows] = useState<InventoryPublicRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!unitId) {
      setRow(null);
      setPeerRows([]);
      setLoadError("Invalid unit.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    const [unitResult, peersResult] = await Promise.all([
      supabase.from("inventory_units_public").select("*").eq("id", unitId).maybeSingle(),
      supabase
        .from("inventory_units_public")
        .select("*")
        .neq("id", unitId)
        .neq("status", "Sold")
        .order("year", { ascending: false })
    ]);
    const { data, error } = unitResult;
    if (error) {
      setLoadError(error.message);
      setRow(null);
      setPeerRows([]);
      setIsLoading(false);
      return;
    }
    const parsed = data ? parseInventoryPublicRow(data) : null;
    if (!parsed) {
      setRow(null);
      setPeerRows([]);
      setLoadError(null);
    } else {
      setRow(parsed);
      recordInventoryView(parsed.id);
      const peers = (peersResult.data ?? [])
        .map((peer) => parseInventoryPublicRow(peer))
        .filter((peer): peer is InventoryPublicRow => peer != null);
      setPeerRows(peers);
    }
    setIsLoading(false);
  }, [unitId]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const backHref = inventoryBackHref(fromCategory);
  const title = row ? inventoryMakeModelTitle(row) : "Unit";
  const similarUnits = useMemo(
    () => (row ? pickSimilarInventoryUnits(row, peerRows, 4) : []),
    [row, peerRows]
  );
  const listPriceCad = row ? inventoryPublicListPriceCad(row) : null;
  const seoPath = unitId ? inventoryUnitCanonicalPath(unitId) : "/inventory";
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
  const isSold = row?.status === "Sold";
  const unitOgImage =
    row && !isSold && supabaseUrl ? inventoryUnitPrimaryImage(row, supabaseUrl) : undefined;
  const unitOgAlt = row ? `${row.year} ${inventoryMakeModelTitle(row)}` : undefined;
  const seoTitle = row
    ? inventoryUnitSeoDocumentTitle(row)
    : unitId
      ? "Ride for sale"
      : "Ride not found";
  const seoDescription = row
    ? inventoryUnitSeoDescription(row)
    : unitId
      ? "View this ride at Temptation Motorsports in Edmonton. Call for pricing. Financing available across Canada."
      : "We could not find this ride.";
  const seoNoindex = row ? isSold : true;

  return (
    <div className="inventory inventory-detail">
      <Seo
        title={seoTitle}
        description={seoDescription}
        path={seoPath}
        noindex={seoNoindex}
        ogImageUrl={unitOgImage}
        ogImageAlt={unitOgAlt}
      />
      {row ? (
        <>
          <BreadcrumbJsonLd
            items={[
              { name: "Inventory", path: "/inventory" },
              { name: row.category, path: inventoryCategoryHref(row.category) },
              { name: title, path: seoPath }
            ]}
          />
          <InventoryProductJsonLd row={row} />
        </>
      ) : null}

      <p className="inventory-detailBack">
        <Link to={backHref} className="inventory-detailBackLink">
          ← Back to rides for sale
        </Link>
      </p>

      {isLoading ? (
        <>
          <h1 className="inventory-detailTitle" role="status">
            Loading ride details…
          </h1>
          <p className="inventory-empty">Loading…</p>
        </>
      ) : loadError ? (
        <p className="inventory-empty" role="alert">
          {loadError}
        </p>
      ) : !row ? (
        <p className="inventory-empty" role="status">
          This ride was not found or is no longer for sale.{" "}
          <Link to="/inventory" className="inventory-seoBlurbLink">
            See rides for sale
          </Link>
        </p>
      ) : (
        <article className="inventory-detailArticle">
          <div className="inventory-detailHero">
            <InventoryPhotoCarousel
              photoPaths={row.photo_paths}
              category={row.category}
              alt={`${title} photo`}
              variant="detail"
              soldOverlay={row.status === "Sold"}
            />

            <div className="inventory-detailAside">
              <header className="inventory-detailHeader">
                <div className="inventory-detailHeaderMain">
                  <div className="inventory-detailMetaRow">
                    <Link to={inventoryCategoryHref(row.category)} className="inventory-cardCategory inventory-cardCategoryLink">
                      {row.category}
                    </Link>
                    <span className={`inventory-status inventory-status${inventoryStatusPillModifier(row.status)}`}>
                      {row.status}
                    </span>
                  </div>
                  <p className="inventory-detailYear">{row.year}</p>
                  <h1 className="inventory-detailTitle">{title}</h1>
                </div>
                <p className="inventory-detailKm">{inventoryOdometerLabel(row)}</p>
                <p className="inventory-detailPrice">
                  {listPriceCad != null ? (
                    formatInventoryPriceCad(listPriceCad)
                  ) : (
                    <span className="inventory-detailPriceContact">
                      <InventoryCallForPricingLink />
                      <InventoryMessageUsLink />
                    </span>
                  )}
                </p>
              </header>

              <section className="inventory-detailDescription" aria-labelledby="inventory-detail-desc-heading">
                <h2 id="inventory-detail-desc-heading" className="inventory-detailSectionTitle">
                  About this ride
                </h2>
                <InventoryUnitDescriptionBlock row={row} unitId={row.id} />
              </section>

              <p className="inventory-detailStock">Stock #{row.stock_number}</p>
            </div>
          </div>

          {similarUnits.length > 0 ? <InventorySimilarUnits current={row} units={similarUnits} /> : null}
        </article>
      )}
    </div>
  );
}
