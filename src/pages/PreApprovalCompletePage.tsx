import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  PREAPPROVAL_COMPLETE,
  PREAPPROVAL_COMPLETE_SEO,
  SITE_CONTACT
} from "../data/preapprovalCopy";
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
      navigate("/pre-approval", { replace: true });
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
        path="/pre-approval/complete"
        noindex
      />
      <div className="preapproval-success card card-pad" role="status">
        <h1 className="page-title">{PREAPPROVAL_COMPLETE.title}</h1>
        <p className="page-subtitle">{PREAPPROVAL_COMPLETE.lead}</p>
        <p className="preapproval-completeBody">{PREAPPROVAL_COMPLETE.body}</p>
        <div className="preapproval-completeContact">
          <p className="preapproval-completeContactIntro">{PREAPPROVAL_COMPLETE.contactIntro}</p>
          <ul className="preapproval-completeContactList">
            <li>
              <span className="preapproval-completeContactLabel">Phone</span>
              <a href={`tel:${SITE_CONTACT.phoneTel}`} className="preapproval-completeContactLink">
                {SITE_CONTACT.phoneDisplay}
              </a>
            </li>
            <li>
              <span className="preapproval-completeContactLabel">Email</span>
              <a href={`mailto:${SITE_CONTACT.email}`} className="preapproval-completeContactLink">
                {SITE_CONTACT.email}
              </a>
            </li>
          </ul>
        </div>
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
