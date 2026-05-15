import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import heroBackground from "../assets/background.png";
import logoUrl from "../assets/logo.png";
import { homeHeroHotspotsForSidebar, HOME_HERO_HOTSPOTS } from "../data/homeHeroHotspots";
import { getHomeHeroLayerUrl } from "../lib/homeHeroLayerUrls";

export function HomePage() {
  const [sidebarGlow, setSidebarGlow] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarNavRef = useRef<HTMLElement>(null);

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      if (!collapsed) setSidebarGlow(null);
      return !collapsed;
    });
  };

  const sidebarHotspots = useMemo(() => homeHeroHotspotsForSidebar(), []);

  const spotsWithLayer = useMemo(
    () =>
      HOME_HERO_HOTSPOTS.flatMap((h) => {
        const url = getHomeHeroLayerUrl(h.layerFile);
        return url ? [{ ...h, layerUrl: url }] : [];
      }),
    []
  );

  return (
    <div className="home">
      <div className="home-backdrop">
        <div className="home-backdropLedger" aria-hidden />
        <div className="home-backdropStage">
          <svg className="home-heroGlowFilters" aria-hidden focusable="false">
            <defs>
              <filter
                id="hero-unit-outline"
                colorInterpolationFilters="sRGB"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="outer" />
                <feMorphology in="SourceAlpha" operator="erode" radius="1" result="inner" />
                <feComposite in="outer" in2="inner" operator="out" result="ring" />
                <feFlood floodColor="#f05d22" floodOpacity="1" result="orange" />
                <feComposite in="orange" in2="ring" operator="in" result="stroke" />
                <feGaussianBlur in="stroke" stdDeviation="0.6" result="strokeSoft" />
                <feMerge>
                  <feMergeNode in="strokeSoft" />
                  <feMergeNode in="stroke" />
                </feMerge>
              </filter>
            </defs>
          </svg>
          <img src={heroBackground} alt="" className="home-backdropImg" decoding="async" aria-hidden />
          {spotsWithLayer.map((h) => (
            <div
              key={h.id}
              className={`home-heroUnitGlow${sidebarGlow === h.id ? " home-heroUnitGlow--active" : ""}`}
              style={{
                top: h.placement.top,
                left: h.placement.left,
                width: h.placement.width,
                height: h.placement.height
              }}
              aria-hidden
            >
              <img
                className="home-heroUnitGlowImg"
                src={h.layerUrl}
                alt=""
                decoding="async"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="home-content">
        <section className="home-hero">
          <img
            src={logoUrl}
            alt=""
            className="home-heroLogo"
            width={400}
            height={200}
            decoding="async"
          />
          <p className="home-eyebrow">Motorsports financing</p>
          <h1 className="home-title">Temptation Motorsports</h1>
          <p className="home-tagline">Serving motorsports customers since 2015</p>
          <p className="home-lede">
            Fast, friendly credit options for motorcycles, ATVs, snowmobiles, side-by-sides, and more—built for riders who
            want to get on the trail, not stuck in paperwork.
          </p>
          <div className="home-actions">
            <Link to="/pre-approval" className="btn btn-primary">
              Get pre-approved
            </Link>
            <Link to="/inventory" className="btn btn-secondary">
              View inventory
            </Link>
          </div>
        </section>
      </div>

      <div className={`home-unitsSidebarDock${sidebarCollapsed ? " home-unitsSidebarDock--collapsed" : ""}`}>
        <aside
          id="home-categories-panel"
          className="home-unitsSidebar"
          aria-label="Showroom categories"
          aria-hidden={sidebarCollapsed}
          inert={sidebarCollapsed ? true : undefined}
        >
          <p className="home-unitsSidebarTitle">Showroom floor</p>
          <p className="home-unitsSidebarHint">Hover to highlight in the photo.</p>
          <nav ref={sidebarNavRef} className="home-unitsNav" onMouseLeave={() => setSidebarGlow(null)}>
            {sidebarHotspots.map((h) => (
              <Link
                key={h.id}
                to={`/inventory?category=${encodeURIComponent(h.inventoryCategory)}`}
                className={`home-unitRow${sidebarGlow === h.id ? " home-unitRow--active" : ""}`}
                onMouseEnter={() => setSidebarGlow(h.id)}
                onFocus={() => setSidebarGlow(h.id)}
                onBlur={(e) => {
                  const next = e.relatedTarget;
                  if (next instanceof Node && sidebarNavRef.current?.contains(next)) return;
                  setSidebarGlow(null);
                }}
              >
                {h.unitName}
              </Link>
            ))}
          </nav>
        </aside>
        <button
          type="button"
          className="home-unitsSidebarToggle"
          onClick={toggleSidebar}
          aria-expanded={!sidebarCollapsed}
          aria-controls="home-categories-panel"
          aria-label={sidebarCollapsed ? "Show showroom categories" : "Hide showroom categories"}
        >
          <span className="home-unitsSidebarToggleIcon" aria-hidden />
        </button>
      </div>
    </div>
  );
}
