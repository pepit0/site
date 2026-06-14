import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import heroBackgroundPng from "../assets/background.png";
import heroBackgroundWebp from "../assets/background.webp";
import logoUrl from "../assets/logo.png";
import { PageSlideLink } from "../components/PageSlideLink";
import { HOME_PREVIEW_SLIDESHOW, HOME_PREVIEW_SLIDESHOW_MS } from "../data/homePreviewSlideshow";
import { HOME_PREVIEW_HERO } from "../data/homePreviewHeroCopy";
import { homeHeroHotspotsForSidebar, HOME_HERO_HOTSPOTS } from "../data/homeHeroHotspots";
import { getHomeHeroLayerUrl } from "../lib/homeHeroLayerUrls";
import { LocalBusinessJsonLd } from "../seo/LocalBusinessJsonLd";
import { Seo } from "../seo/Seo";

export function HomePage() {
  const [sidebarGlow, setSidebarGlow] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [showroomInView, setShowroomInView] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [mobileHome, setMobileHome] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : false
  );
  const sidebarNavRef = useRef<HTMLElement>(null);
  const slideshowTopRef = useRef<HTMLElement>(null);
  const showroomStageRef = useRef<HTMLDivElement>(null);

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
        if (!h.layerFile || !h.placement) return [];
        const url = getHomeHeroLayerUrl(h.layerFile);
        return url ? [{ ...h, layerUrl: url, placement: h.placement }] : [];
      }),
    []
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setMobileHome(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduceMotion || HOME_PREVIEW_SLIDESHOW.length < 2) return;
    const timer = window.setInterval(() => {
      setSlideIndex((i) => (i + 1) % HOME_PREVIEW_SLIDESHOW.length);
    }, HOME_PREVIEW_SLIDESHOW_MS);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  useEffect(() => {
    if (mobileHome) {
      setShowroomInView(false);
      setSidebarGlow(null);
      setSidebarCollapsed(false);
      return;
    }

    const slideshow = slideshowTopRef.current;
    const stage = showroomStageRef.current;
    if (!slideshow || !stage) return;

    const update = () => {
      const vh = window.innerHeight;
      const slideBottom = slideshow.getBoundingClientRect().bottom;
      const stageRect = stage.getBoundingClientRect();
      const visiblePx = Math.min(stageRect.bottom, vh) - Math.max(stageRect.top, 0);

      const passedSlideshow = slideBottom < vh * 0.42;
      const stageOnPage = visiblePx > vh * 0.1 && stageRect.bottom > 72;

      const visible = passedSlideshow && stageOnPage;
      setShowroomInView(visible);
      if (!visible) {
        setSidebarGlow(null);
        setSidebarCollapsed(false);
      }
    };

    const observer = new IntersectionObserver(update, {
      threshold: [0, 0.05, 0.1, 0.15, 0.25, 0.4]
    });
    observer.observe(stage);

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [mobileHome]);

  const showSidebar = !mobileHome && showroomInView;
  const activeSlide = HOME_PREVIEW_SLIDESHOW[slideIndex] ?? HOME_PREVIEW_SLIDESHOW[0];

  return (
    <div className="home home-preview">
      <Seo
        title="Powersports financing in Canada"
        description="ATV, motorcycle, and snowmobile financing nationwide. Edmonton-based. Good credit, bad credit, or no credit — free online application."
        path="/"
      />
      <LocalBusinessJsonLd />
      <div className="home-backdropAmbience" aria-hidden />
      <div className="home-backdropWarmth" aria-hidden />

      <section ref={slideshowTopRef} className="home-previewTop" aria-label="Hero">
        <div className="home-previewSlideshow" aria-hidden>
          <img
            src={activeSlide.src}
            alt=""
            className="home-previewSlideshowSizer"
            decoding="async"
            draggable={false}
          />
          {HOME_PREVIEW_SLIDESHOW.map((slide, index) => (
            <div
              key={slide.id}
              className={`home-previewSlideshowSlide home-previewSlideshowSlide--${slide.id}${
                index === slideIndex ? " home-previewSlideshowSlide--active" : ""
              }`}
              style={
                { "--home-preview-slide-focus": slide.mobileObjectPosition } as React.CSSProperties
              }
            >
              <img src={slide.src} alt="" className="home-previewSlideshowImg" decoding="async" draggable={false} />
            </div>
          ))}
        </div>

        <img
          src={logoUrl}
          alt="Temptation Motorsports"
          className="home-previewHeroLogo home-previewHeroLogo--overlay"
          width={400}
          height={200}
          decoding="async"
        />

        <div className="home-content home-previewContent">
          <div className="home-previewContentInner">
            <section className="home-previewHero" aria-labelledby="home-hook">
              <img
                src={logoUrl}
                alt=""
                className="home-previewHeroLogo home-previewHeroLogo--inline"
                width={400}
                height={200}
                decoding="async"
                aria-hidden
              />

              <h1 id="home-hook" className="home-previewHook">
                <span className="home-previewHookDisplay">{HOME_PREVIEW_HERO.hook}</span>
                <span className="visually-hidden">{HOME_PREVIEW_HERO.seoH1}</span>
              </h1>
              <p className="home-previewSubhook">{HOME_PREVIEW_HERO.subhook}</p>
              <p className="home-previewLede">{HOME_PREVIEW_HERO.lede}</p>

              <div className="home-previewCtaBlock">
                <div className="home-previewCtaRow">
                  <PageSlideLink
                    to="/apply"
                    className="home-previewQualifyCta"
                    aria-label={HOME_PREVIEW_HERO.qualifyAria}
                  >
                    <span className="home-previewQualifyCopy">
                      <span className="home-previewQualifyText">{HOME_PREVIEW_HERO.qualifyPrompt}</span>
                      <span className="home-previewQualifySubtext">{HOME_PREVIEW_HERO.noCreditCheck}</span>
                    </span>
                    <span className="home-previewQualifyArrow" aria-hidden>
                      →
                    </span>
                  </PageSlideLink>

                  <PageSlideLink to="/inventory" className="home-previewInventoryCta">
                    {HOME_PREVIEW_HERO.inventoryLink}
                  </PageSlideLink>
                </div>

                <ul className="home-previewHighlights" aria-label="Why apply">
                  {HOME_PREVIEW_HERO.highlights.map((item) => (
                    <li key={item.label} className="home-previewHighlight">
                      <span className="home-previewHighlightValue">{item.value}</span>
                      <span className="home-previewHighlightLabel">{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </div>

        {!reduceMotion && HOME_PREVIEW_SLIDESHOW.length > 1 ? (
          <div className="home-previewSlideshowDots" role="tablist" aria-label="Hero backgrounds">
            {HOME_PREVIEW_SLIDESHOW.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                className={`home-previewSlideshowDot${index === slideIndex ? " home-previewSlideshowDot--active" : ""}`}
                aria-selected={index === slideIndex}
                aria-label={slide.label}
                onClick={() => setSlideIndex(index)}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className="home-previewShowroom" aria-label="Showroom floor">
        <div ref={showroomStageRef} className="home-previewShowroomStage">
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
          <picture>
            <source type="image/webp" srcSet={heroBackgroundWebp} />
            <img
              src={heroBackgroundPng}
              alt=""
              className="home-backdropImg home-previewShowroomImg"
              decoding="async"
              draggable={false}
            />
          </picture>
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
              <img className="home-heroUnitGlowImg" src={h.layerUrl} alt="" decoding="async" draggable={false} />
            </div>
          ))}
          <div className="home-backdropFade" aria-hidden />
        </div>
      </section>

      {!mobileHome ? (
        <div
          className={`home-unitsSidebarDock${sidebarCollapsed ? " home-unitsSidebarDock--collapsed" : ""}${showSidebar ? " home-unitsSidebarDock--showroomVisible" : " home-unitsSidebarDock--showroomHidden"}`}
          aria-hidden={!showSidebar}
          inert={!showSidebar ? true : undefined}
        >
          <aside
          id="home-categories-panel"
          className="home-unitsSidebar"
          aria-label="Showroom categories"
          aria-hidden={sidebarCollapsed || !showSidebar}
          inert={sidebarCollapsed || !showSidebar ? true : undefined}
        >
          <p className="home-unitsSidebarTitle">Shop floor</p>
          <p className="home-unitsSidebarHint">Move your mouse over a name to see it in the photo.</p>
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
          tabIndex={showSidebar ? 0 : -1}
        >
          <span className="home-unitsSidebarToggleIcon" aria-hidden />
        </button>
        </div>
      ) : null}
    </div>
  );
}
