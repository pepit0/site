export type AdminToolsNavItem = {
  label: string;
  to: string;
  /** Match active when pathname starts with this prefix */
  activePrefix: string;
};

export const ADMIN_TOOLS_NAV: AdminToolsNavItem[] = [
  { label: "Admin inventory", to: "/admin/inventory", activePrefix: "/admin/inventory" },
  { label: "Calculator", to: "/admin/calculator", activePrefix: "/admin/calculator" }
];

export const ADMIN_TOOLS_HOME = "/admin/inventory";
