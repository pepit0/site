import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trackPreApprovalLead } from "../lib/metaPixel";
import { consumePreApprovalConversion } from "../lib/preapprovalConversion";
import { Seo } from "../seo/Seo";

/**
 * Dedicated conversion URL for Meta Ads (e.g. custom conversion: URL = /pre-approval/complete).
 * Only reachable right after a successful application submit.
 */
export function PreApprovalCompletePage() {
  const navigate = useNavigate();
  const tracked = useRef(false);

  useEffect(() => {
    if (!consumePreApprovalConversion()) {
      navigate("/pre-approval", { replace: true });
      return;
    }
    if (tracked.current) return;
    tracked.current = true;
    trackPreApprovalLead();
  }, [navigate]);

  return (
    <div className="preapproval">
      <Seo
        title="Application received"
        description="Thank you for completing your powersports financing pre-approval request with Temptation Motorsports."
        path="/pre-approval/complete"
        noindex
      />
      <div className="preapproval-success card card-pad" role="status">
        <h1 className="page-title">Thank you</h1>
        <p className="page-subtitle">
          We’ve received your pre-approval request. A member of our team will contact you shortly to discuss next steps.
        </p>
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
