import { Link } from "react-router-dom";
import { InventoryMessageUsLink } from "./InventoryMessageUsLink";
import {
  formatBusinessAddressLines,
  formatBusinessAddressOneLine,
  getPublicBusinessProfile,
  type PublicBusinessProfile
} from "../lib/businessPublic";
import { contactMailtoHref } from "../data/aboutContactCopy";

function BusinessNapPhoneIcon() {
  return (
    <svg className="business-napLinkIcon" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BusinessNapEmailIcon() {
  return (
    <svg className="business-napLinkIcon" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path
        d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m22 6-10 7L2 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type BusinessNapBlockProps = {
  profile?: PublicBusinessProfile;
  variant?: "full" | "compact" | "footer";
  showDirections?: boolean;
  showChatButton?: boolean;
  className?: string;
};

export function BusinessNapBlock({
  profile = getPublicBusinessProfile(),
  variant = "full",
  showDirections = true,
  showChatButton = false,
  className = ""
}: BusinessNapBlockProps) {
  const addressLines = formatBusinessAddressLines(profile);
  const rootClass = `business-nap business-nap--${variant}${className ? ` ${className}` : ""}`;

  if (variant === "footer") {
    return (
      <address className={rootClass}>
        <span className="business-napLine">{formatBusinessAddressOneLine(profile)}</span>
        <a className="business-napLine business-napLink business-napContactLink" href={`tel:${profile.phoneTel}`}>
          <BusinessNapPhoneIcon />
          {profile.phoneDisplay}
        </a>
        <a className="business-napLine business-napLink business-napContactLink" href={contactMailtoHref()}>
          <BusinessNapEmailIcon />
          {profile.email}
        </a>
      </address>
    );
  }

  if (variant === "compact") {
    return (
      <address className={rootClass}>
        <span className="business-napName">{profile.name}</span>
        {addressLines.map((line) => (
          <span key={line} className="business-napLine">
            {line}
          </span>
        ))}
        <a className="business-napLine business-napLink business-napContactLink" href={`tel:${profile.phoneTel}`}>
          <BusinessNapPhoneIcon />
          {profile.phoneDisplay}
        </a>
        <Link className="business-napLine business-napLink" to="/contact">
          Contact us
        </Link>
      </address>
    );
  }

  return (
    <address className={rootClass}>
      <span className="business-napName">{profile.name}</span>
      {addressLines.map((line) => (
        <span key={line} className="business-napLine">
          {line}
        </span>
      ))}
      {!profile.streetAddress ? (
        <span className="business-napHint">Visit by appointment. Call or apply online first.</span>
      ) : null}
      {profile.hoursLabel ? <span className="business-napLine">Hours: {profile.hoursLabel}</span> : null}
      <a className="business-napLine business-napLink business-napContactLink" href={`tel:${profile.phoneTel}`}>
        <BusinessNapPhoneIcon />
        {profile.phoneDisplay}
      </a>
      <a className="business-napLine business-napLink business-napContactLink" href={contactMailtoHref()}>
        <BusinessNapEmailIcon />
        {profile.email}
      </a>
      {showChatButton ? (
        <InventoryMessageUsLink
          className="business-napChatBtn"
          label="Chat with us"
          ariaLabel="Chat with us — open live chat"
        />
      ) : null}
      {showDirections && profile.googleMapsUrl ? (
        <a
          className="business-napDirections btn btn-secondary"
          href={profile.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Get directions
        </a>
      ) : null}
    </address>
  );
}
