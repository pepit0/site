import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { fetchUserCanManageInventory } from "../lib/inventoryAdminAccess";
import { supabase } from "../lib/supabase";
import { isMarketingOnlySite } from "../siteMode";
import { MarketingPixelsRouteSync } from "../components/MarketingPixelsRouteSync";
import { SiteChatMount } from "../components/chat/SiteChatMount";
import { TawkProvider } from "../components/chat/tawkContext";
import { SiteNavAdminToolsDropdown } from "../components/SiteNavAdminToolsDropdown";
import { SiteNavInventoryDropdown } from "../components/SiteNavInventoryDropdown";
import { SITE_CONTACT } from "../data/preapprovalCopy";
import { usePreapprovalNavCta } from "../hooks/usePreapprovalNavCta";
import tLogoUrl from "../assets/Tlogo.png";
import bikerLogoUrl from "../assets/bikerlogo.png";

function SiteLayoutChrome({ navVariant }: { navVariant: "crm" | "marketing" }) {
  const location = useLocation();
  const { label: preapprovalNavLabel, hasResumeDraft } = usePreapprovalNavCta();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="site-shell">
      <MarketingPixelsRouteSync />
      <header className={`site-header${mobileMenuOpen ? " site-headerMobileOpen" : ""}`}>
        <div className="site-headerInner">
          <NavLink to="/" className="site-brand" end>
            <img src={tLogoUrl} alt="Temptation Motorsports logo" className="site-brandMark" width={52} height={52} decoding="async" />
            <span>Temptation Motorsports</span>
          </NavLink>
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
              to="/pre-approval"
              className={({ isActive }) =>
                `site-navCta${hasResumeDraft ? " site-navCta--resume" : ""}${isActive ? " site-navCtaActive" : ""}`
              }
            >
              {preapprovalNavLabel}
            </NavLink>
            {navVariant === "crm" ? <SiteNavCrm /> : <SiteNavMarketing />}
          </nav>
        </div>
      </header>
      <main className="site-main" key={location.pathname}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="site-footerInner">
          <div className="site-footerCluster">
            <img
              src={bikerLogoUrl}
              alt="Temptation Motorsports"
              className="site-footerLogo"
              width={320}
              height={140}
              decoding="async"
            />
            <div className="site-footerMeta">
              <div className="site-footerLead">
                <p className="site-footerTagline">
                  We deliver all over Canada!{" "}
                  <a className="site-footerPhoneInline" href={`tel:${SITE_CONTACT.phoneTel}`}>
                    {SITE_CONTACT.phoneDisplay}
                  </a>
                </p>
                <p className="site-footerSeoBlurb">
                  Fast approvals for{" "}
                  <Link className="site-footerSeoLink" to="/pre-approval">
                    motorcycle, ATV, and snowmobile financing
                  </Link>
                  .
                </p>
                <p className="site-footerSeoBlurb">
                  Browse our{" "}
                  <Link className="site-footerSeoLink" to="/inventory">
                    Edmonton powersports inventory
                  </Link>
                  .
                </p>
              </div>
              <p className="site-footerText">
                © {new Date().getFullYear()} Temptation Motorsports. All rights reserved. Based in Edmonton.
              </p>
            </div>
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
