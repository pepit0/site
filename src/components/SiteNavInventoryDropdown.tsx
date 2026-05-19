import { useCallback, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  parseInventoryCategoryFromQuery,
  VEHICLE_CATEGORIES,
  type VehicleCategory
} from "../data/inventory";

const CLOSE_DELAY_MS = 150;

function inventoryCategoryHref(category: VehicleCategory): string {
  return `/inventory?category=${encodeURIComponent(category)}`;
}

function isInventoryListingPath(pathname: string): boolean {
  return pathname === "/inventory";
}

function isAllInventoryActive(pathname: string, search: string): boolean {
  if (!isInventoryListingPath(pathname)) return false;
  return parseInventoryCategoryFromQuery(new URLSearchParams(search).get("category")) === "all";
}

function isCategoryActive(pathname: string, search: string, category: VehicleCategory): boolean {
  if (!isInventoryListingPath(pathname)) return false;
  return parseInventoryCategoryFromQuery(new URLSearchParams(search).get("category")) === category;
}

export function SiteNavInventoryDropdown() {
  const location = useLocation();
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeMenu = useCallback(() => {
    clearCloseTimer();
    setOpen(false);
    setDismissed(true);
  }, [clearCloseTimer]);

  const handleMouseEnter = useCallback(() => {
    clearCloseTimer();
    setDismissed(false);
    setOpen(true);
  }, [clearCloseTimer]);

  const handleMouseLeave = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      setDismissed(false);
      closeTimerRef.current = null;
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const menuId = "site-nav-inventory-menu";
  const menuVisible = open && !dismissed;

  return (
    <div
      className={`site-navDropdown${menuVisible ? " site-navDropdown--open" : ""}${dismissed ? " site-navDropdown--dismissed" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <NavLink
        to="/inventory"
        end={false}
        className={({ isActive }) =>
          `site-navLink site-navDropdownTrigger${isActive ? " site-navLinkActive" : ""}`
        }
        aria-haspopup="menu"
        aria-expanded={menuVisible}
        aria-controls={menuId}
        onClick={closeMenu}
      >
        Inventory
        <span className="site-navDropdownChevron" aria-hidden>
          ▾
        </span>
      </NavLink>
      <div
        id={menuId}
        className="site-navDropdownMenu"
        role="menu"
        aria-label="Inventory categories"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <NavLink
          to="/inventory"
          role="menuitem"
          className={() =>
            `site-navDropdownItem${isAllInventoryActive(location.pathname, location.search) ? " site-navDropdownItemActive" : ""}`
          }
          onClick={closeMenu}
        >
          All inventory
        </NavLink>
        {VEHICLE_CATEGORIES.map((category) => (
          <NavLink
            key={category}
            to={inventoryCategoryHref(category)}
            role="menuitem"
            className={() =>
              `site-navDropdownItem${isCategoryActive(location.pathname, location.search, category) ? " site-navDropdownItemActive" : ""}`
            }
            onClick={closeMenu}
          >
            {category}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
