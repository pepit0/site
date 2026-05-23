import { useCallback, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ADMIN_TOOLS_HOME, ADMIN_TOOLS_NAV } from "../data/adminToolsNav";

const CLOSE_DELAY_MS = 150;

function isAdminToolsActive(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

function isAdminToolItemActive(pathname: string, prefix: string): boolean {
  if (prefix === "/admin/inventory") {
    return pathname === "/admin/inventory" || pathname.startsWith("/admin/inventory/");
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function SiteNavAdminToolsDropdown() {
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

  const menuId = "site-nav-admin-tools-menu";
  const menuVisible = open && !dismissed;

  return (
    <div
      className={`site-navDropdown${menuVisible ? " site-navDropdown--open" : ""}${dismissed ? " site-navDropdown--dismissed" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <NavLink
        to={ADMIN_TOOLS_HOME}
        end={false}
        className={() =>
          `site-navLink site-navDropdownTrigger${isAdminToolsActive(location.pathname) ? " site-navLinkActive" : ""}`
        }
        aria-haspopup="menu"
        aria-expanded={menuVisible}
        aria-controls={menuId}
        onClick={closeMenu}
      >
        Admin tools
        <span className="site-navDropdownChevron" aria-hidden>
          ▾
        </span>
      </NavLink>
      <div
        id={menuId}
        className="site-navDropdownMenu"
        role="menu"
        aria-label="Admin tools"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {ADMIN_TOOLS_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            role="menuitem"
            className={() =>
              `site-navDropdownItem${isAdminToolItemActive(location.pathname, item.activePrefix) ? " site-navDropdownItemActive" : ""}`
            }
            onClick={closeMenu}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
