import { useCallback, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  INVENTORY_COMING_SOON_CATEGORIES,
  parseInventoryCategoryFromQuery,
  VEHICLE_CATEGORIES,
  type InventoryBrowseCategory
} from "../data/inventory";

const CLOSE_DELAY_MS = 150;

function inventoryCategoryHref(category: Exclude<InventoryBrowseCategory, "all">): string {
  return `/inventory?category=${encodeURIComponent(category)}`;
}

function isInventoryListingPath(pathname: string): boolean {
  return pathname === "/inventory";
}

function isAllInventoryActive(pathname: string, search: string): boolean {
  if (!isInventoryListingPath(pathname)) return false;
  return parseInventoryCategoryFromQuery(new URLSearchParams(search).get("category")) === "all";
}

function isCategoryActive(pathname: string, search: string, category: Exclude<InventoryBrowseCategory, "all">): boolean {
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
          All rides
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
        {INVENTORY_COMING_SOON_CATEGORIES.map((category) => (
          <NavLink
            key={category}
            to={inventoryCategoryHref(category)}
            role="menuitem"
            className={() =>
              `site-navDropdownItem site-navDropdownItem--comingSoon${isCategoryActive(location.pathname, location.search, category) ? " site-navDropdownItemActive" : ""}`
            }
            onClick={closeMenu}
          >
            <span>{category}</span>
            <span className="site-navDropdownSoon">Coming soon</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
