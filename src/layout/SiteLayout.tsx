import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { fetchUserCanManageInventory } from "../lib/inventoryAdminAccess";
import { supabase } from "../lib/supabase";
import { isMarketingOnlySite } from "../siteMode";
import tLogoUrl from "../assets/Tlogo.png";
import bikerLogoUrl from "../assets/bikerlogo.png";

function SiteLayoutChrome({ navVariant }: { navVariant: "crm" | "marketing" }) {
  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="site-headerInner">
          <NavLink to="/" className="site-brand" end>
            <img src={tLogoUrl} alt="" className="site-brandMark" width={52} height={52} decoding="async" />
            <span>Temptation Motorsports</span>
          </NavLink>
          <nav className="site-nav" aria-label="Main">
            <NavLink to="/" className={({ isActive }) => `site-navLink${isActive ? " site-navLinkActive" : ""}`} end>
              Home
            </NavLink>
            <NavLink
              to="/inventory"
              className={({ isActive }) => `site-navLink${isActive ? " site-navLinkActive" : ""}`}
            >
              Inventory
            </NavLink>
            <NavLink
              to="/sell-your-ride"
              className={({ isActive }) => `site-navLink${isActive ? " site-navLinkActive" : ""}`}
            >
              Sell your ride
            </NavLink>
            <NavLink
              to="/pre-approval"
              className={({ isActive }) => `site-navCta${isActive ? " site-navCtaActive" : ""}`}
            >
              Get pre-approved
            </NavLink>
            {navVariant === "crm" ? <SiteNavCrm /> : <SiteNavMarketing />}
          </nav>
        </div>
      </header>
      <main className="site-main">
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
              <p className="site-footerContact">
                <span>Based in Edmonton</span>
                <span className="site-footerContactSep" aria-hidden>
                  ·
                </span>
                <a href="tel:+15877411945">(587) 741-1945</a>
              </p>
              <p className="site-footerTagline">We deliver all over Canada!</p>
              <p className="site-footerText">
                © {new Date().getFullYear()} Temptation Motorsports. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
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
      setCanManageInventory(false);
      setInventoryCheckDone(true);
      return;
    }
    let cancelled = false;
    setInventoryCheckDone(false);
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
          {canManageInventory ? (
            <NavLink
              to="/admin/inventory"
              className={({ isActive }) => `site-navLink${isActive ? " site-navLinkActive" : ""}`}
            >
              Admin inventory
            </NavLink>
          ) : null}
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
  if (isMarketingOnlySite()) {
    return <SiteLayoutChrome navVariant="marketing" />;
  }
  return <SiteLayoutChrome navVariant="crm" />;
}
