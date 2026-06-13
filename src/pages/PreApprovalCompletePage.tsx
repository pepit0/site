import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PREAPPROVAL_COMPLETE, PREAPPROVAL_COMPLETE_SEO } from "../data/preapprovalCopy";
import { trackPreApprovalCompleteConversion } from "../lib/marketingPixels";
import {
  canViewPreApprovalCompletePage,
  hasPreApprovalLeadBeenTracked,
  markPreApprovalLeadTracked
} from "../lib/preapprovalConversion";
import { Seo } from "../seo/Seo";

/**
 * Form completion page — Meta Lead + TikTok SubmitForm (after successful submit).
 * Only reachable right after a successful application submit.
 */
export function PreApprovalCompletePage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!canViewPreApprovalCompletePage()) {
      navigate("/apply", { replace: true });
      return;
    }
    if (hasPreApprovalLeadBeenTracked()) return;

    trackPreApprovalCompleteConversion();
    markPreApprovalLeadTracked();
  }, [navigate]);

  return (
    <div className="preapproval">
      <Seo
        title={PREAPPROVAL_COMPLETE_SEO.title}
        description={PREAPPROVAL_COMPLETE_SEO.description}
        path="/apply/complete"
        noindex
      />
      <div className="preapproval-complete card card-pad" role="status">
        <svg
          className="preapproval-completeCheck"
          viewBox="0 0 64 64"
          width={72}
          height={72}
          aria-hidden
          focusable="false"
        >
          <circle cx="32" cy="32" r="30" className="preapproval-completeCheckCircle" />
          <path
            className="preapproval-completeCheckMark"
            d="M20 33.5 28.2 41.5 44.5 24.5"
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h1 className="preapproval-completeTitle">{PREAPPROVAL_COMPLETE.title}</h1>
        <p className="preapproval-completeLead">{PREAPPROVAL_COMPLETE.lead}</p>
        <div className="home-actions preapproval-completeActions">
          <Link to="/" className="btn btn-secondary">
            Back home
          </Link>
          <Link to="/inventory" className="btn btn-primary">
            See rides for sale
          </Link>
        </div>
      </div>
    </div>
  );
}
