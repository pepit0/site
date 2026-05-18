import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PREAPPROVAL_COMPLETE, PREAPPROVAL_COMPLETE_LEGAL } from "../data/preapprovalCopy";
import { trackPreApprovalCompleteConversion } from "../lib/marketingPixels";
import {
  canViewPreApprovalCompletePage,
  getPreApprovalOutcomeVariant,
  hasPreApprovalLeadBeenTracked,
  markPreApprovalLeadTracked,
  readPreApprovalOutcomeBand
} from "../lib/preapprovalConversion";
import { Seo } from "../seo/Seo";

/**
 * Form completion page — Meta Lead + TikTok SubmitForm (after successful submit).
 * Only reachable right after a successful application submit.
 */
export function PreApprovalCompletePage() {
  const navigate = useNavigate();
  const band = readPreApprovalOutcomeBand();
  const variant = getPreApprovalOutcomeVariant(band);
  const copy = PREAPPROVAL_COMPLETE[variant];

  useEffect(() => {
    if (!canViewPreApprovalCompletePage()) {
      navigate("/pre-approval", { replace: true });
      return;
    }
    if (hasPreApprovalLeadBeenTracked()) return;

    trackPreApprovalCompleteConversion();
    markPreApprovalLeadTracked();
  }, [navigate]);

  const showOutcome = variant === "approved" || variant === "conditional";
  const outcomeHeadline = showOutcome && "headline" in copy ? copy.headline : null;
  const outcomeSubline = variant === "approved" && "subline" in copy ? copy.subline : null;

  return (
    <div className="preapproval">
      <Seo
        title="Application received"
        description="Thank you for completing your powersports financing pre-approval request with Temptation Motorsports."
        path="/pre-approval/complete"
        noindex
      />
      <div className="preapproval-success card card-pad" role="status">
        {showOutcome && outcomeHeadline ? (
          <div className={`preapproval-outcomeBlock preapproval-outcomeBlock--${variant}`}>
            <p className={`preapproval-outcomeHeadline preapproval-outcomeHeadline--${variant}`}>
              {outcomeHeadline}
            </p>
            {outcomeSubline ? (
              <p className={`preapproval-outcomeSubline preapproval-outcomeSubline--${variant}`}>
                {outcomeSubline}
              </p>
            ) : null}
            <p className="preapproval-completeLegal">{PREAPPROVAL_COMPLETE_LEGAL}</p>
          </div>
        ) : null}
        <h1 className="page-title">{copy.title}</h1>
        <p className="page-subtitle">{copy.lead}</p>
        <p className="preapproval-completeBody">{copy.subtitle}</p>
        <div className="home-actions preapproval-successActions">
          <Link to="/" className="btn btn-secondary">
            Back to home
          </Link>
          <Link to="/inventory" className="btn btn-primary">
            Browse inventory
          </Link>
        </div>
      </div>
    </div>
  );
}
