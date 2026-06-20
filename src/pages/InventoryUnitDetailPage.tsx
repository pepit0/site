import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { InventoryCallForPricingLink } from "../components/InventoryCallForPricingLink";
import { InventoryMessageUsLink } from "../components/InventoryMessageUsLink";
import { InventoryPhotoCarousel } from "../components/InventoryPhotoCarousel";
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
  inventoryUnitSeoTitle
} from "../seo/inventoryStructuredData";
import { Seo } from "../seo/Seo";

type LocationState = { fromCategory?: VehicleCategory | "all" } | null;

function inventoryBackHref(fromCategory: VehicleCategory | "all" | undefined): string {
  if (fromCategory && fromCategory !== "all") {
    return `/inventory?category=${encodeURIComponent(fromCategory)}`;
  }
  return "/inventory";
}

function InventoryUnitDescriptionBlock({ unitId }: { unitId: string }) {
  return (
    <>
      <p className="inventory-detailDescriptionText">{INVENTORY_UNIT_DESCRIPTION}</p>
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
    </>
  );
}

export function InventoryUnitDetailPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const location = useLocation();
  const fromCategory = (location.state as LocationState)?.fromCategory;

  const [row, setRow] = useState<InventoryPublicRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!unitId) {
      setRow(null);
      setLoadError("Invalid unit.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("inventory_units_public")
      .select("*")
      .eq("id", unitId)
      .maybeSingle();
    if (error) {
      setLoadError(error.message);
      setRow(null);
      setIsLoading(false);
      return;
    }
    const parsed = data ? parseInventoryPublicRow(data) : null;
    if (!parsed) {
      setRow(null);
      setLoadError(null);
    } else {
      setRow(parsed);
      recordInventoryView(parsed.id);
    }
    setIsLoading(false);
  }, [unitId]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const backHref = inventoryBackHref(fromCategory);
  const title = row ? inventoryMakeModelTitle(row) : "Unit";
  const listPriceCad = row ? inventoryPublicListPriceCad(row) : null;
  const seoPath = unitId ? inventoryUnitCanonicalPath(unitId) : "/inventory";
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
  const isSold = row?.status === "Sold";
  const unitOgImage =
    row && !isSold && supabaseUrl ? inventoryUnitPrimaryImage(row, supabaseUrl) : undefined;
  const unitOgAlt = row ? `${row.year} ${inventoryMakeModelTitle(row)}` : undefined;

  return (
    <div className="inventory inventory-detail">
      {row ? (
        <>
          <Seo
            title={inventoryUnitSeoTitle(row)}
            description={inventoryUnitSeoDescription(row)}
            path={seoPath}
            noindex={isSold}
            ogImageUrl={unitOgImage}
            ogImageAlt={unitOgAlt}
          />
          <BreadcrumbJsonLd
            items={[
              { name: "Inventory", path: "/inventory" },
              { name: title, path: seoPath }
            ]}
          />
          <InventoryProductJsonLd row={row} />
        </>
      ) : (
        <Seo title="Ride not found" description="We could not find this ride." path={seoPath} noindex />
      )}

      <p className="inventory-detailBack">
        <Link to={backHref} className="inventory-detailBackLink">
          ← Back to rides for sale
        </Link>
      </p>

      {isLoading ? (
        <p className="inventory-empty" role="status">
          Loading…
        </p>
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
                    <span className="inventory-cardCategory">{row.category}</span>
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
                <InventoryUnitDescriptionBlock unitId={row.id} />
              </section>

              <p className="inventory-detailStock">Stock #{row.stock_number}</p>
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
