import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { InventoryPhotoCarousel } from "../components/InventoryPhotoCarousel";
import {
  INVENTORY_UNIT_DESCRIPTION,
  inventoryMakeModelTitle,
  inventoryStatusPillModifier,
  inventoryYearKmLine,
  parseInventoryPublicRow,
  type InventoryPublicRow,
  type VehicleCategory
} from "../data/inventory";
import { recordInventoryView } from "../lib/recentInventoryViews";
import { supabase } from "../lib/supabase";
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
        Take Next Steps:
        <br />
        📱 CALL / TEXT: <a href="tel:+15878064214">587-806-4214</a>
      </p>
      <Link
        to={`/pre-approval?unit=${encodeURIComponent(unitId)}`}
        className="btn btn-primary inventory-detailApplyBtn"
      >
        Apply Now!
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
  const seoPath = unitId ? `/inventory/${unitId}` : "/inventory";

  return (
    <div className="inventory inventory-detail">
      {row ? (
        <Seo
          title={`${row.year} ${title}`}
          description={`${row.year} ${title} — ${inventoryYearKmLine(row)}. View photos and details at Temptation Motorsports.`}
          path={seoPath}
        />
      ) : (
        <Seo title="Unit not found" description="This inventory unit could not be found." path={seoPath} noindex />
      )}

      <p className="inventory-detailBack">
        <Link to={backHref} className="inventory-detailBackLink">
          ← Back to inventory
        </Link>
      </p>

      {isLoading ? (
        <p className="inventory-empty" role="status">
          Loading unit…
        </p>
      ) : loadError ? (
        <p className="inventory-empty" role="alert">
          {loadError}
        </p>
      ) : !row ? (
        <p className="inventory-empty" role="status">
          This unit was not found or is no longer available.{" "}
          <Link to="/inventory" className="inventory-seoBlurbLink">
            Browse inventory
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
                <p className="inventory-cardMeta inventory-detailMeta">
                  <span className="inventory-cardCategory">{row.category}</span>
                  <span className={`inventory-status inventory-status${inventoryStatusPillModifier(row.status)}`}>
                    {row.status}
                  </span>
                </p>
                <h1 className="inventory-detailTitle">{title}</h1>
                <p className="inventory-detailYearKm">{inventoryYearKmLine(row)}</p>
              </header>

              <section className="inventory-detailDescription" aria-labelledby="inventory-detail-desc-heading">
                <h2 id="inventory-detail-desc-heading" className="inventory-detailSectionTitle">
                  About this unit
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
