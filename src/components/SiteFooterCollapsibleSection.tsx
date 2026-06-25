import type { ReactNode } from "react";

type SiteFooterCollapsibleSectionProps = {
  label: string;
  children: ReactNode;
};

export function SiteFooterCollapsibleSection({ label, children }: SiteFooterCollapsibleSectionProps) {
  return (
    <details className="site-footerCollapse">
      <summary className="site-footerCollapseSummary">{label}</summary>
      <div className="site-footerCollapsePanel">{children}</div>
    </details>
  );
}
