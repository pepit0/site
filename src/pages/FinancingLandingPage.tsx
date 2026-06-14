import { Link, useParams } from "react-router-dom";
import { getFinancingPageBySlug } from "../data/financingPages";
import { FinancingPageView } from "../components/FinancingPageView";
import { Seo } from "../seo/Seo";

export function FinancingLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const page = getFinancingPageBySlug(slug);

  if (!page) {
    return (
      <div className="financing-page">
        <Seo title="Financing page not found" description="Browse powersports financing options." path="/financing" noindex />
        <p className="inventory-empty" role="status">
          That financing page was not found.{" "}
          <Link to="/financing">See all financing options</Link>.
        </p>
      </div>
    );
  }

  return <FinancingPageView page={page} />;
}
