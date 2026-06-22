import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { fetchUserCanManageInventory } from "../lib/inventoryAdminAccess";
import { supabase } from "../lib/supabase";
import { isMarketingOnlySite } from "../siteMode";
import { MarketingPixelsRouteSync } from "../components/MarketingPixelsRouteSync";
import { SiteChatMount } from "../components/chat/SiteChatMount";
import { PaymentCalculatorWidget } from "../components/PaymentCalculatorWidget";
import { TawkProvider } from "../components/chat/tawkContext";
import { SiteNavAdminToolsDropdown } from "../components/SiteNavAdminToolsDropdown";
import { SiteNavInventoryDropdown } from "../components/SiteNavInventoryDropdown";
import { VEHICLE_CATEGORIES } from "../data/inventory";
import { SITE_CONTACT } from "../data/preapprovalCopy";
import { contactMailtoHref } from "../data/aboutContactCopy";
import { usePreapprovalNavCta } from "../hooks/usePreapprovalNavCta";
import {
  INVENTORY_POPULAR_BRANDS,
  inventoryCategoryBrowseLabel,
  inventoryCategoryHref,
  inventoryMakeSearchHref
} from "../lib/inventoryRoutes";
import { formatBusinessAddressLines, getPublicBusinessProfile } from "../lib/businessPublic";
import textLogoUrl from "../assets/textlogo.png";
import bikerLogoUrl from "../assets/bikerlogo.png";

function SiteLayoutChrome({ navVariant }: { navVariant: "crm" | "marketing" }) {
  const location = useLocation();
  const businessProfile = getPublicBusinessProfile();
  const businessAddressLines = formatBusinessAddressLines(businessProfile);
  const { label: preapprovalNavLabel, hasResumeDraft } = usePreapprovalNavCta();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  return (
    <div className={`site-shell${mobileMenuOpen ? " site-shellMobileNavOpen" : ""}`}>
      <MarketingPixelsRouteSync />
      <button
        type="button"
        className={`site-navBackdrop${mobileMenuOpen ? " site-navBackdrop--visible" : ""}`}
        aria-hidden={!mobileMenuOpen}
        tabIndex={mobileMenuOpen ? 0 : -1}
        aria-label="Close menu"
        onClick={() => setMobileMenuOpen(false)}
      />
      <header className={`site-header${mobileMenuOpen ? " site-headerMobileOpen" : ""}`}>
        <div className="site-headerInner">
          <NavLink to="/" className="site-brand" end>
            <img
              src={textLogoUrl}
              alt="Temptation Motorsports"
              className="site-brandLogo"
              width={240}
              height={160}
              decoding="async"
            />
          </NavLink>
          <nav id="site-main-nav" className={`site-nav${mobileMenuOpen ? " site-navOpen" : ""}`} aria-label="Main">
            <NavLink to="/" className={({ isActive }) => `site-navLink${isActive ? " site-navLinkActive" : ""}`} end>
              Home
            </NavLink>
            <NavLink to="/inventory" className={({ isActive }) => `site-navLink site-navLinkMobileOnly${isActive ? " site-navLinkActive" : ""}`}>
              Inventory
            </NavLink>
            <SiteNavInventoryDropdown />
            <NavLink
              to="/sell-your-ride"
              className={({ isActive }) => `site-navLink${isActive ? " site-navLinkActive" : ""}`}
            >
              Sell your ride
            </NavLink>
            <NavLink
              to="/blog"
              className={({ isActive, isPending }) =>
                `site-navLink${isActive || (location.pathname.startsWith("/blog/") && !isPending) ? " site-navLinkActive" : ""}`
              }
            >
              Blog
            </NavLink>
            <NavLink
              to="/contact"
              className={({ isActive }) => `site-navLink${isActive ? " site-navLinkActive" : ""}`}
            >
              Contact
            </NavLink>
            <NavLink
              to="/apply"
              className={({ isActive }) =>
                `site-navCta${hasResumeDraft ? " site-navCta--resume" : ""}${isActive ? " site-navCtaActive" : ""}`
              }
            >
              {preapprovalNavLabel}
            </NavLink>
            {navVariant === "crm" ? <SiteNavCrm /> : <SiteNavMarketing />}
          </nav>
          <div className="site-headerActions">
            <NavLink
              to="/apply"
              className={`site-headerBarCta${hasResumeDraft ? " site-headerBarCta--resume" : ""}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {hasResumeDraft ? "Resume" : "Apply"}
            </NavLink>
            <PaymentCalculatorWidget />
            <button
              type="button"
              className="site-navToggle"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="site-main-nav"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>
      <main className="site-main" key={location.pathname}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="site-footerInner">
          <div className="site-footerTop">
            <div className="site-footerBrand">
              <div className="site-footerBrandRow">
                <img
                  src={bikerLogoUrl}
                  alt="Temptation Motorsports"
                  className="site-footerLogo"
                  width={320}
                  height={140}
                  decoding="async"
                />
                <Link to="/apply" className="site-footerCta">
                  Apply for financing
                </Link>
              </div>
              <p className="site-footerTagline">Powersports, leisure, marine and auto financing in Alberta and across Canada. We help people get approved, good, bad or no credit.</p>
            </div>

            <div className="site-footerNavGrid">
              <nav className="site-footerCol" aria-label="Shop">
                <p className="site-footerColLabel">Shop</p>
                <ul className="site-footerLinks">
                  <li>
                    <Link to="/inventory">Inventory</Link>
                  </li>
                  <li>
                    <Link to="/apply">Apply</Link>
                  </li>
                  <li>
                    <Link to="/sell-your-ride">Sell your ride</Link>
                  </li>
                </ul>
                <p className="site-footerSublistLabel">Browse by type</p>
                <ul className="site-footerLinks site-footerSublist">
                  {VEHICLE_CATEGORIES.map((category) => (
                    <li key={category}>
                      <Link to={inventoryCategoryHref(category)}>{inventoryCategoryBrowseLabel(category)}</Link>
                    </li>
                  ))}
                </ul>
                <p className="site-footerSublistLabel">Popular brands</p>
                <ul className="site-footerLinks site-footerSublist">
                  {INVENTORY_POPULAR_BRANDS.map((brand) => (
                    <li key={brand}>
                      <Link to={inventoryMakeSearchHref(brand)}>{brand}</Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <nav className="site-footerCol" aria-label="Learn">
                <p className="site-footerColLabel">Learn</p>
                <ul className="site-footerLinks">
                  <li>
                    <Link to="/about">About</Link>
                  </li>
                  <li>
                    <Link to="/financing">Financing</Link>
                  </li>
                  <li>
                    <Link to="/reviews">Reviews</Link>
                  </li>
                </ul>
              </nav>

              <nav className="site-footerCol" aria-label="Help">
                <p className="site-footerColLabel">Help</p>
                <ul className="site-footerLinks">
                  <li>
                    <Link to="/contact">Contact us</Link>
                  </li>
                  <li>
                    <Link to="/faq">FAQ</Link>
                  </li>
                  <li>
                    <Link to="/chat">Chat</Link>
                  </li>
                </ul>
              </nav>
            </div>

            <div className="site-footerCol site-footerColContact">
              <p className="site-footerColLabel">Get in touch</p>
              <ul className="site-footerLinks site-footerContactList">
                <li>
                  <a href={`tel:${SITE_CONTACT.phoneTel}`}>{SITE_CONTACT.phoneDisplay}</a>
                </li>
                <li>
                  <a href={contactMailtoHref()}>{SITE_CONTACT.email}</a>
                </li>
              </ul>
              <address className="site-footerAddress">
                {businessAddressLines.map((line) => (
                  <span key={line} className="site-footerAddressLine">
                    {line}
                  </span>
                ))}
                {businessProfile.googleMapsUrl ? (
                  <a
                    className="site-footerDirections"
                    href={businessProfile.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Directions
                  </a>
                ) : null}
              </address>
            </div>
          </div>

          <div className="site-footerBar">
            <p className="site-footerCopyright">
              © {new Date().getFullYear()} Temptation Motorsports. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
      <SiteChatMount />
    </div>
  );
}

function SiteNavCrm() {
  const { user, isLoading, signOut } = useAuth();

  return (
    <span className="site-navAuth" aria-label="Account">
      {isLoading ? (
        <span className="site-navMuted">…</span>
      ) : user ? (
        <>
          <NavLink to="/staff" className={({ isActive }) => `site-navLink${isActive ? " site-navLinkActive" : ""}`}>
            Staff
          </NavLink>
          <button type="button" className="site-navSignOut" onClick={() => void signOut()}>
            Sign out
          </button>
        </>
      ) : (
        <NavLink to="/login" className={({ isActive }) => `site-navLink${isActive ? " site-navLinkActive" : ""}`}>
          Sign in
        </NavLink>
      )}
    </span>
  );
}

function SiteNavMarketing() {
  const { user, isLoading, signOut } = useAuth();
  const [canManageInventory, setCanManageInventory] = useState(false);
  const [inventoryCheckDone, setInventoryCheckDone] = useState(false);

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => {
        setCanManageInventory(false);
        setInventoryCheckDone(true);
      });
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setInventoryCheckDone(false);
      }
    });
    void fetchUserCanManageInventory(supabase).then(({ allowed }) => {
      if (cancelled) return;
      setCanManageInventory(allowed);
      setInventoryCheckDone(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <span className="site-navAuth" aria-label="Account">
      {isLoading || (user && !inventoryCheckDone) ? (
        <span className="site-navMuted">…</span>
      ) : user ? (
        <>
          {canManageInventory ? <SiteNavAdminToolsDropdown /> : null}
          <button type="button" className="site-navSignOut" onClick={() => void signOut()}>
            Sign out
          </button>
        </>
      ) : (
        <NavLink to="/login" className={({ isActive }) => `site-navLink${isActive ? " site-navLinkActive" : ""}`}>
          Sign in
        </NavLink>
      )}
    </span>
  );
}

export function SiteLayout() {
  const chrome = isMarketingOnlySite() ? (
    <SiteLayoutChrome navVariant="marketing" />
  ) : (
    <SiteLayoutChrome navVariant="crm" />
  );
  return <TawkProvider>{chrome}</TawkProvider>;
}
